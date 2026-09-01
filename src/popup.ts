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

inputEl.addEventListener('input', () => void updateList())
inputEl.addEventListener('keydown', (e) => {
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
    const title = document.createElement('span')
    title.className = 'title'
    title.textContent = item.label
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
