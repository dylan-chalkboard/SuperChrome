/**
 * Popup variant of the palette. Unlike the injected overlay, popups work on
 * every page — chrome:// settings, the Web Store, new tab — because they're
 * extension UI rather than content injected into the page.
 *
 * Querying and ranking live in the background service worker; this file only
 * renders results and executes selections.
 */

interface RemoteItem {
  kind: 'bookmark' | 'tab' | 'history' | 'command' | 'closed' | 'folder'
  label: string
  detail: string
  url?: string
  id?: string
  tabId?: number
  commandId?: string
  sessionId?: string
  group?: string
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
const FOLDER_SVG =
  '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M1.5 3.5h4.5l1.5 2h7v7h-13v-9z" stroke="currentColor" stroke-linejoin="round"/></svg>'

const TYPE_LABELS: Record<string, string> = {
  bookmark: 'Bookmark',
  tab: 'Tab',
  history: 'History',
  command: 'Command',
  closed: 'Closed',
  folder: 'Folder',
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
let browseStack: Array<{ id: string; label: string }> = []

function enterFolder(item: RemoteItem): void {
  if (!item.id) return
  recordUsage(item)
  browseStack.push({ id: item.id, label: item.label })
  inputEl.value = ''
  inputEl.focus()
  void updateList()
}

function popFolder(): void {
  browseStack.pop()
  inputEl.value = ''
  void updateList()
}

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
    if (/^[1-9]$/.test(e.key)) {
      e.preventDefault()
      const action = currentActions[Number(e.key) - 1]
      if (action && actionTarget) void runAction(action, actionTarget)
    } else if (e.key === 'Escape') {
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
  if (e.key === 'Backspace' && inputEl.value === '' && browseStack.length && currentMode() === 'bookmarks') {
    e.preventDefault()
    popFolder()
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
    case 'closed':
      return [
        { id: 'reopen', label: 'Reopen Tab' },
        { id: 'copy-url', label: 'Copy URL' },
        { id: 'copy-md', label: 'Copy Markdown Link' },
      ]
    case 'folder':
      return [
        { id: 'browse', label: 'Browse Folder' },
        { id: 'open-all', label: 'Open All in New Tabs' },
        { id: 'folder-delete', label: 'Delete Folder', danger: true },
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
    const label = document.createElement('span')
    label.textContent = action.label
    const spacer = document.createElement('span')
    spacer.className = 'spacer'
    row.append(label, spacer)
    if (index < 9) {
      const chip = document.createElement('span')
      chip.className = 'kbd'
      chip.textContent = String(index + 1)
      row.appendChild(chip)
    }
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
    case 'reopen':
      await chrome.runtime.sendMessage({ type: 'restore-session', sessionId: item.sessionId })
      window.close()
      return
    case 'browse':
      closeActions()
      enterFolder(item)
      return
    case 'open-all':
      await chrome.runtime.sendMessage({ type: 'open-folder-tabs', id: item.id })
      window.close()
      return
    case 'folder-delete':
      await chrome.runtime.sendMessage({ type: 'folder-delete', id: item.id })
      break
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
        : item.kind === 'folder'
          ? `folder:${item.id}`
          : null
  if (key) void chrome.runtime.sendMessage({ type: 'record-usage', key })
}

async function executeItem(item: RemoteItem, altAction: boolean): Promise<void> {
  if (item.kind === 'folder') {
    enterFolder(item)
    return
  }
  recordUsage(item)
  if (item.kind === 'bookmark' || item.kind === 'history') {
    await chrome.runtime.sendMessage({ type: 'open-url', url: item.url, newTab: altAction })
  } else if (item.kind === 'tab') {
    await chrome.runtime.sendMessage({ type: 'activate-tab', tabId: item.tabId })
  } else if (item.kind === 'closed') {
    await chrome.runtime.sendMessage({ type: 'restore-session', sessionId: item.sessionId })
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
  const browsing = mode === 'bookmarks' && browseStack.length > 0
  const response = (await chrome.runtime.sendMessage({
    type: 'palette-query',
    mode,
    query,
    folderId: browsing ? browseStack[browseStack.length - 1].id : undefined,
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

  const defaultGroup = browsing
    ? browseStack[browseStack.length - 1].label
    : (GROUP_LABELS[mode] ?? 'Results')
  let lastGroup: string | null = null
  items.forEach((item, index) => {
    const group = item.group ?? defaultGroup
    if (group !== lastGroup) {
      const label = document.createElement('div')
      label.className = 'group-label'
      label.textContent = group
      listEl.appendChild(label)
      lastGroup = group
    }
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
  const kind = item.kind
  if ((kind === 'bookmark' || kind === 'tab' || kind === 'closed') && item.url) {
    icon.className = 'icon plain'
    const img = document.createElement('img')
    img.src =
      chrome.runtime.getURL('/_favicon/') + `?pageUrl=${encodeURIComponent(item.url)}&size=32`
    img.onerror = () => {
      icon.className = `icon kind-${kind}`
      icon.innerHTML = BOOKMARK_SVG
    }
    icon.appendChild(img)
    return icon
  }
  icon.className = `icon kind-${kind}`
  icon.innerHTML = kind === 'folder' ? FOLDER_SVG : kind === 'history' ? CLOCK_SVG : COMMAND_SVG
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

const HASH_PREFIX: Record<string, string> = {
  '#commands': '>',
  '#tabs': '@',
  '#history': '#',
}
const MODE_PREFIX: Record<string, string> = {
  bookmarks: '',
  commands: '>',
  tabs: '@',
  history: '#',
}

async function applyStartupSettings(): Promise<void> {
  try {
    const { settings } = await chrome.storage.sync.get('settings')
    const colors = settings?.iconColors ?? {}
    for (const key of ['command', 'folder', 'history', 'fallback'] as const) {
      if (typeof colors[key] === 'string') {
        document.documentElement.style.setProperty(`--sc-${key}`, colors[key])
      }
    }
    if (!(location.hash in HASH_PREFIX) && settings?.defaultMode) {
      inputEl.value = MODE_PREFIX[settings.defaultMode] ?? ''
    }
  } catch {
    // Defaults baked into the CSS cover this.
  }
}

if (location.hash in HASH_PREFIX) inputEl.value = HASH_PREFIX[location.hash]
void applyStartupSettings().then(updateList)
