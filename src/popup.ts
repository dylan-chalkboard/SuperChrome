/**
 * Popup variant of the palette. Unlike the injected overlay, popups work on
 * every page — chrome:// settings, the Web Store, new tab — because they're
 * extension UI rather than content injected into the page.
 *
 * Querying and ranking live in the background service worker; this file only
 * renders results and executes selections.
 */

interface RemoteItem {
  kind: 'bookmark' | 'tab' | 'history' | 'command'
  label: string
  detail: string
  url?: string
  id?: string
  tabId?: number
  commandId?: string
  positions?: number[]
}

interface PaletteAction {
  id: string
  label: string
  danger?: boolean
}

const BOOKMARK_SVG =
  '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 2.5h8V14l-4-2.5L4 14V2.5z" stroke="currentColor" stroke-linejoin="round"/></svg>'
const COMMAND_SVG =
  '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M5 4l4 4-4 4" stroke="currentColor" stroke-linecap="round"/></svg>'
const CLOCK_SVG =
  '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor"/><path d="M8 5v3.2l2.2 1.6" stroke="currentColor" stroke-linecap="round"/></svg>'

const TYPE_LABELS: Record<string, string> = {
  bookmark: 'Bookmark',
  tab: 'Tab',
  history: 'History',
  command: 'Command',
}

const GROUP_LABELS: Record<string, string> = {
  bookmarks: 'Bookmarks',
  commands: 'Commands',
  tabs: 'Open Tabs',
  history: 'History',
}

// Page-local commands need the page's document; they can't run from a popup.
const PAGE_ONLY_COMMANDS = new Set(['print-page'])

const inputEl = document.getElementById('input') as HTMLInputElement
const listEl = document.getElementById('list')!

let flatItems: RemoteItem[] = []
let selectedIndex = 0
let queryToken = 0

function currentMode(): string {
  const raw = inputEl.value
  if (raw.startsWith('>')) return 'commands'
  if (raw.startsWith('@')) return 'tabs'
  if (raw.startsWith('#')) return 'history'
  return 'bookmarks'
}

let actionsEl: HTMLElement | null = null
let currentActions: PaletteAction[] = []
let actionIndex = 0
let actionTarget: RemoteItem | null = null

inputEl.addEventListener('input', () => {
  closeActions()
  void updateList()
})
inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
    e.preventDefault()
    if (actionsEl) closeActions()
    else openActions()
    return
  }
  if (actionsEl) {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      closeActions()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      actionIndex = (actionIndex + 1) % currentActions.length
      highlightActions()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      actionIndex = (actionIndex - 1 + currentActions.length) % currentActions.length
      highlightActions()
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const action = currentActions[actionIndex]
      if (action && actionTarget) void runAction(action, actionTarget)
    }
    return
  }
  if ((e.metaKey || e.ctrlKey) && e.key >= '1' && e.key <= '9') {
    e.preventDefault()
    const item = flatItems[Number(e.key) - 1]
    if (item) void executeItem(item, false)
    return
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    moveSelection(1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    moveSelection(-1)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const item = flatItems[selectedIndex]
    if (item) void executeItem(item, e.metaKey || e.ctrlKey)
  }
})

/* ---------- Actions panel (⌘K) ---------- */

function actionsFor(item: RemoteItem): PaletteAction[] {
  switch (item.kind) {
    case 'bookmark':
      return [
        { id: 'open', label: 'Open' },
        { id: 'open-new-tab', label: 'Open in New Tab' },
        { id: 'copy-url', label: 'Copy URL' },
        { id: 'copy-md', label: 'Copy Markdown Link' },
        { id: 'delete', label: 'Delete Bookmark', danger: true },
      ]
    case 'history':
      return [
        { id: 'open', label: 'Open' },
        { id: 'open-new-tab', label: 'Open in New Tab' },
        { id: 'copy-url', label: 'Copy URL' },
        { id: 'copy-md', label: 'Copy Markdown Link' },
        { id: 'delete-history', label: 'Remove from History', danger: true },
      ]
    case 'tab':
      return [
        { id: 'switch', label: 'Switch to Tab' },
        { id: 'copy-url', label: 'Copy URL' },
        { id: 'copy-md', label: 'Copy Markdown Link' },
        { id: 'close-tab', label: 'Close Tab', danger: true },
      ]
    default:
      return [{ id: 'run', label: 'Run Command' }]
  }
}

function openActions(): void {
  const item = flatItems[selectedIndex]
  if (!item) return
  actionTarget = item
  currentActions = actionsFor(item)
  actionIndex = 0
  actionsEl = document.createElement('div')
  actionsEl.className = 'actions'
  currentActions.forEach((action, index) => {
    const row = document.createElement('div')
    row.className = 'action-row' + (action.danger ? ' danger' : '')
    row.textContent = action.label
    row.addEventListener('mousedown', (e) => {
      e.preventDefault()
      void runAction(action, item)
    })
    row.addEventListener('mousemove', () => {
      if (actionIndex !== index) {
        actionIndex = index
        highlightActions()
      }
    })
    actionsEl!.appendChild(row)
  })
  document.body.appendChild(actionsEl)
  highlightActions()
}

function closeActions(): void {
  actionsEl?.remove()
  actionsEl = null
  actionTarget = null
}

function highlightActions(): void {
  actionsEl
    ?.querySelectorAll<HTMLElement>('.action-row')
    .forEach((row, i) => row.classList.toggle('selected', i === actionIndex))
}

async function runAction(action: PaletteAction, item: RemoteItem): Promise<void> {
  switch (action.id) {
    case 'open':
    case 'open-new-tab':
      recordUsage(item)
      await chrome.runtime.sendMessage({
        type: 'open-url',
        url: item.url,
        newTab: action.id === 'open-new-tab',
      })
      window.close()
      return
    case 'copy-url':
      await copyText(item.url ?? '')
      window.close()
      return
    case 'copy-md':
      await copyText(`[${item.label}](${item.url ?? ''})`)
      window.close()
      return
    case 'switch':
      await chrome.runtime.sendMessage({ type: 'activate-tab', tabId: item.tabId })
      window.close()
      return
    case 'run':
      closeActions()
      await executeItem(item, false)
      return
    case 'delete':
      await chrome.runtime.sendMessage({ type: 'bookmark-delete', id: item.id })
      break
    case 'delete-history':
      await chrome.runtime.sendMessage({ type: 'history-delete', url: item.url })
      break
    case 'close-tab':
      await chrome.runtime.sendMessage({ type: 'close-tab-id', tabId: item.tabId })
      break
  }
  closeActions()
  void updateList()
}

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const area = document.createElement('textarea')
    area.value = text
    document.body.appendChild(area)
    area.select()
    document.execCommand('copy')
    area.remove()
  }
}

function moveSelection(delta: number): void {
  if (!flatItems.length) return
  selectedIndex = (selectedIndex + delta + flatItems.length) % flatItems.length
  highlightSelection()
}

function highlightSelection(): void {
  const rows = listEl.querySelectorAll<HTMLElement>('.item')
  rows.forEach((row, i) => row.classList.toggle('selected', i === selectedIndex))
  rows[selectedIndex]?.scrollIntoView({ block: 'nearest' })
}

function recordUsage(item: RemoteItem): void {
  const key =
    item.kind === 'bookmark'
      ? `bookmark:${item.url}`
      : item.kind === 'command'
        ? `command:${item.commandId}`
        : null
  if (key) void chrome.runtime.sendMessage({ type: 'record-usage', key })
}

async function executeItem(item: RemoteItem, altAction: boolean): Promise<void> {
  recordUsage(item)
  if (item.kind === 'bookmark' || item.kind === 'history') {
    await chrome.runtime.sendMessage({ type: 'open-url', url: item.url, newTab: altAction })
  } else if (item.kind === 'tab') {
    await chrome.runtime.sendMessage({ type: 'activate-tab', tabId: item.tabId })
  } else if (item.commandId === 'switch-to-tab') {
    inputEl.value = '@'
    inputEl.focus()
    void updateList()
    return
  } else {
    await chrome.runtime.sendMessage({ type: 'run-command', id: item.commandId })
  }
  window.close()
}

async function updateList(): Promise<void> {
  const token = ++queryToken
  const mode = currentMode()
  const query = inputEl.value.replace(/^[>@#]/, '')
  const response = (await chrome.runtime.sendMessage({
    type: 'palette-query',
    mode,
    query,
  })) as { items?: RemoteItem[] }
  if (token !== queryToken) return

  let items = response?.items ?? []
  if (mode === 'commands') items = items.filter((i) => !PAGE_ONLY_COMMANDS.has(i.commandId ?? ''))

  listEl.textContent = ''
  flatItems = items
  selectedIndex = 0

  if (!items.length) {
    const empty = document.createElement('div')
    empty.className = 'empty'
    empty.textContent = 'No results'
    listEl.appendChild(empty)
    return
  }

  const label = document.createElement('div')
  label.className = 'group-label'
  label.textContent = GROUP_LABELS[mode] ?? 'Results'
  listEl.appendChild(label)

  items.forEach((item, index) => {
    const row = document.createElement('div')
    row.className = 'item'
    const title = labelEl(item)
    const detail = document.createElement('span')
    detail.className = 'detail'
    detail.textContent = item.detail || (item.url ? shortUrl(item.url) : '')
    const type = document.createElement('span')
    type.className = 'type'
    type.textContent = TYPE_LABELS[item.kind] ?? ''
    row.append(iconFor(item), title, detail, type)
    row.addEventListener('click', (e) => void executeItem(item, e.metaKey || e.ctrlKey))
    row.addEventListener('mousemove', () => {
      if (selectedIndex !== index) {
        selectedIndex = index
        highlightSelection()
      }
    })
    listEl.appendChild(row)
  })
  highlightSelection()
}

/** Title span with query-matched characters bolded. */
function labelEl(item: RemoteItem): HTMLElement {
  const span = document.createElement('span')
  span.className = 'title'
  const label = item.label
  const matched = new Set((item.positions ?? []).filter((p) => p < label.length))
  if (!matched.size) {
    span.textContent = label
    return span
  }
  let i = 0
  while (i < label.length) {
    const bold = matched.has(i)
    let j = i
    while (j < label.length && matched.has(j) === bold) j++
    const chunk = label.slice(i, j)
    if (bold) {
      const b = document.createElement('b')
      b.textContent = chunk
      span.appendChild(b)
    } else {
      span.appendChild(document.createTextNode(chunk))
    }
    i = j
  }
  return span
}

function iconFor(item: RemoteItem): HTMLElement {
  const icon = document.createElement('span')
  icon.className = 'icon'
  if (item.kind === 'history') {
    icon.innerHTML = CLOCK_SVG
  } else if ((item.kind === 'bookmark' || item.kind === 'tab') && item.url) {
    const img = document.createElement('img')
    img.src =
      chrome.runtime.getURL('/_favicon/') + `?pageUrl=${encodeURIComponent(item.url)}&size=32`
    img.onerror = () => {
      icon.innerHTML = BOOKMARK_SVG
    }
    icon.appendChild(img)
  } else {
    icon.innerHTML = COMMAND_SVG
  }
  return icon
}

function shortUrl(url: string): string {
  try {
    const u = new URL(url)
    return u.host + (u.pathname === '/' ? '' : u.pathname)
  } catch {
    return url
  }
}

if (location.hash === '#commands') inputEl.value = '>'
void updateList()
