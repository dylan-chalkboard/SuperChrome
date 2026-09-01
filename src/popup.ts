/**
 * Popup variant of the palette. Unlike the injected overlay, popups work on
 * every page — chrome:// settings, the Web Store, new tab — because they're
 * extension UI rather than content injected into the page.
 *
 * Querying and ranking live in the background service worker; this file only
 * renders results and executes selections.
 */

interface RemoteItem {
  kind: 'bookmark' | 'tab' | 'history' | 'command' | 'closed' | 'folder' | 'calc' | 'emoji' | 'download'
  label: string
  detail: string
  url?: string
  id?: string
  tabId?: number
  commandId?: string
  sessionId?: string
  emoji?: string
  text?: string
  icon?: string
  color?: string
  groupColor?: string
  grouped?: boolean
  downloadId?: number
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
const DOC_SVG =
  '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 1.5h5.5L12.5 5v9.5h-8.5v-13z" stroke="currentColor" stroke-linejoin="round"/><path d="M9.5 1.5V5H12.5" stroke="currentColor" stroke-linejoin="round"/></svg>'
const FOLDER_SVG =
  '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M1.5 3.5h4.5l1.5 2h7v7h-13v-9z" stroke="currentColor" stroke-linejoin="round"/></svg>'

const CMD_ICONS: Record<string, string> = {
  tab: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="2.5" width="13" height="11" rx="1.5" stroke="currentColor"/><path d="M1.5 5.5h13" stroke="currentColor"/></svg>',
  switch: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 5.5h8M9.5 2.5l3 3-3 3M12 10.5H4M6.5 7.5l-3 3 3 3" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  pin: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="6" r="3" stroke="currentColor"/><path d="M8 9v5" stroke="currentColor" stroke-linecap="round"/></svg>',
  split: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="3" width="13" height="10" rx="1.5" stroke="currentColor"/><path d="M8 3v10" stroke="currentColor"/></svg>',
  external: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M6.5 3.5H3v9.5h9.5V9.5M9.5 3h3.5v3.5M12.7 3.3L8 8" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  merge: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M5 2.5v3a3 3 0 003 3 3 3 0 003-3v-3M8 8.5V14M5.5 11.5L8 14l2.5-2.5" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  group: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="5" cy="5" r="2" stroke="currentColor"/><circle cx="11" cy="5" r="2" stroke="currentColor"/><circle cx="8" cy="11" r="2" stroke="currentColor"/></svg>',
  incognito: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="4.5" cy="10.5" r="2" stroke="currentColor"/><circle cx="11.5" cy="10.5" r="2" stroke="currentColor"/><path d="M6.5 10.5h3M2 7.5h12M5 7l1-3.5h4L11 7" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  'zoom-in': '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="4.5" stroke="currentColor"/><path d="M10.5 10.5L14 14M5 7h4M7 5v4" stroke="currentColor" stroke-linecap="round"/></svg>',
  'zoom-out': '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="4.5" stroke="currentColor"/><path d="M10.5 10.5L14 14M5 7h4" stroke="currentColor" stroke-linecap="round"/></svg>',
  zoom: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="4.5" stroke="currentColor"/><path d="M10.5 10.5L14 14" stroke="currentColor" stroke-linecap="round"/></svg>',
  fullscreen: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  gear: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="2.2" stroke="currentColor"/><path d="M8 1.8v1.7M8 12.5v1.7M1.8 8h1.7M12.5 8h1.7M3.6 3.6l1.2 1.2M11.2 11.2l1.2 1.2M12.4 3.6l-1.2 1.2M4.8 11.2l-1.2 1.2" stroke="currentColor" stroke-linecap="round"/></svg>',
  code: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M5.5 4.5L2 8l3.5 3.5M10.5 4.5L14 8l-3.5 3.5" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  bookmark: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 2.5h8V14l-4-2.5L4 14V2.5z" stroke="currentColor" stroke-linejoin="round"/></svg>',
  clock: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor"/><path d="M8 5v3.2l2.2 1.6" stroke="currentColor" stroke-linecap="round"/></svg>',
  download: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 2v8M5 7l3 3 3-3M3 13.5h10" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  save: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 3h8.5L13 4.5V13H3z" stroke="currentColor" stroke-linejoin="round"/><path d="M5 3v3h5V3M5 13V9.5h6V13" stroke="currentColor" stroke-linejoin="round"/></svg>',
  search: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="4.5" stroke="currentColor"/><path d="M10.5 10.5L14 14" stroke="currentColor" stroke-linecap="round"/></svg>',
  printer: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4.5 6V2.5h7V6M2.5 6h11v5h-2.5M4.5 9h7v4.5h-7zM4.5 11H2.5V6" stroke="currentColor" stroke-linejoin="round"/></svg>',
  gauge: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2.5 11.5a5.5 5.5 0 0111 0" stroke="currentColor" stroke-linecap="round"/><path d="M8 11.5L10.5 7" stroke="currentColor" stroke-linecap="round"/></svg>',
  shield: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 2l5 1.8v3.7c0 3.2-2 5.4-5 6.5-3-1.1-5-3.3-5-6.5V3.8z" stroke="currentColor" stroke-linejoin="round"/></svg>',
  key: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="5.5" cy="10.5" r="3" stroke="currentColor"/><path d="M8 8l5.5-5.5M11 5l2 2M9.5 6.5L11 8" stroke="currentColor" stroke-linecap="round"/></svg>',
  trash: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 4.5h10M6.5 4.5v-2h3v2M4.5 4.5l.7 9h5.6l.7-9M6.7 7v4M9.3 7v4" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  puzzle: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M6 2.5h4v3h3v4h-3v3H6v-3H3v-4h3z" stroke="currentColor" stroke-linejoin="round"/></svg>',
  keyboard: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="2" y="4.5" width="12" height="7" rx="1" stroke="currentColor"/><path d="M4.5 7h.1M7 7h.1M9.5 7h.1M11.5 7h.1M5 9.5h6" stroke="currentColor" stroke-linecap="round"/></svg>',
  flag: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 14V2.5M4 3h8l-2 2.5 2 2.5H4" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  info: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor"/><path d="M8 7.5V11M8 5.2v.2" stroke="currentColor" stroke-linecap="round"/></svg>',
  globe: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor"/><path d="M2 8h12M8 2c-3.5 3.5-3.5 8.5 0 12M8 2c3.5 3.5 3.5 8.5 0 12" stroke="currentColor"/></svg>',
  paint: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 2s4.5 5.2 4.5 8.2a4.5 4.5 0 01-9 0C3.5 7.2 8 2 8 2z" stroke="currentColor" stroke-linejoin="round"/></svg>',
  reset: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M13 8a5 5 0 11-1.5-3.5M13 2.5V5h-2.5" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  form: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="2.5" y="3" width="11" height="10" rx="1" stroke="currentColor"/><path d="M5 6h6M5 8.5h6M5 11h3" stroke="currentColor" stroke-linecap="round"/></svg>',
}

const TYPE_LABELS: Record<string, string> = {
  bookmark: 'Bookmark',
  tab: 'Tab',
  history: 'History',
  command: 'Command',
  closed: 'Closed',
  folder: 'Folder',
  calc: 'Calculator',
  emoji: 'Emoji',
  download: 'Download',
}

const GROUP_LABELS: Record<string, string> = {
  bookmarks: 'Bookmarks',
  commands: 'Commands',
  tabs: 'Open Tabs',
  history: 'History',
  emoji: 'Emoji',
  downloads: 'Downloads',
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
  if (raw.startsWith(':')) return 'emoji'
  if (raw.startsWith('~')) return 'downloads'
  return 'bookmarks'
}

let actionsEl: HTMLElement | null = null
let currentActions: PaletteAction[] = []
let actionIndex = 0
let actionTarget: RemoteItem | null = null
let browseStack: Array<{ id: string; label: string }> = []

async function reorderItem(item: RemoteItem, delta: number): Promise<void> {
  if (!item.id || (item.kind !== 'bookmark' && item.kind !== 'folder')) return
  await chrome.runtime.sendMessage({ type: 'bookmark-reorder', id: item.id, delta })
  await updateList()
  const index = flatItems.findIndex((i) => i.id === item.id)
  if (index >= 0) {
    selectedIndex = index
    highlightSelection()
  }
}

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
  if (
    e.altKey &&
    (e.key === 'ArrowUp' || e.key === 'ArrowDown') &&
    browseStack.length &&
    currentMode() === 'bookmarks'
  ) {
    e.preventDefault()
    const item = flatItems[selectedIndex]
    if (item) void reorderItem(item, e.key === 'ArrowUp' ? -1 : 1)
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
        ...(browseStack.length && currentMode() === 'bookmarks'
          ? [
              { id: 'move-up', label: 'Move Up' },
              { id: 'move-down', label: 'Move Down' },
            ]
          : []),
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
    case 'tab': {
      const actions: PaletteAction[] = [
        { id: 'switch', label: 'Switch to Tab' },
        { id: 'new-group', label: 'New Group from Tab' },
      ]
      if (item.grouped) actions.push({ id: 'ungroup', label: 'Remove from Group' })
      actions.push(
        { id: 'copy-url', label: 'Copy URL' },
        { id: 'copy-md', label: 'Copy Markdown Link' },
        { id: 'close-tab', label: 'Close Tab', danger: true },
      )
      return actions
    }
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
    case 'download':
      return [
        { id: 'download-open', label: 'Open File' },
        { id: 'download-show', label: 'Show in Finder' },
        { id: 'copy-text', label: 'Copy Path' },
      ]
    case 'calc':
      return [{ id: 'copy-text', label: 'Copy Result' }]
    case 'emoji':
      return [{ id: 'copy-text', label: 'Copy Emoji' }]
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
    case 'download-open':
      await chrome.runtime.sendMessage({ type: 'download-open', downloadId: item.downloadId })
      window.close()
      return
    case 'download-show':
      await chrome.runtime.sendMessage({ type: 'download-show', downloadId: item.downloadId })
      window.close()
      return
    case 'new-group':
      await chrome.runtime.sendMessage({ type: 'tab-group-add', tabId: item.tabId })
      break
    case 'ungroup':
      await chrome.runtime.sendMessage({ type: 'tab-ungroup', tabId: item.tabId })
      break
    case 'move-up':
    case 'move-down':
      closeActions()
      await reorderItem(item, action.id === 'move-up' ? -1 : 1)
      return
    case 'copy-text':
      await copyText(item.kind === 'emoji' ? (item.emoji ?? '') : (item.text ?? item.label))
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
        : item.kind === 'folder'
          ? `folder:${item.id}`
          : item.kind === 'emoji'
            ? `emoji:${item.emoji}`
            : null
  if (key) void chrome.runtime.sendMessage({ type: 'record-usage', key })
}

async function executeItem(item: RemoteItem, altAction: boolean): Promise<void> {
  if (item.kind === 'folder') {
    enterFolder(item)
    return
  }
  if (item.kind === 'download') {
    await chrome.runtime.sendMessage({ type: 'download-open', downloadId: item.downloadId })
    window.close()
    return
  }
  if (item.kind === 'calc' || item.kind === 'emoji') {
    recordUsage(item)
    await copyText(item.kind === 'emoji' ? (item.emoji ?? '') : (item.text ?? item.label))
    window.close()
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
  const query = inputEl.value.replace(/^[>@#:~]/, '')
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
    row.append(iconFor(item), title, detail)
    if (item.groupColor) {
      const dot = document.createElement('span')
      dot.className = 'group-dot'
      dot.style.background = item.groupColor
      row.appendChild(dot)
    }
    row.appendChild(type)
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
  if ((kind === 'bookmark' || kind === 'tab' || kind === 'closed' || kind === 'history') && item.url) {
    icon.className = 'icon plain'
    const img = document.createElement('img')
    img.src =
      chrome.runtime.getURL('/_favicon/') + `?pageUrl=${encodeURIComponent(item.url)}&size=32`
    img.onerror = () => {
      icon.className = `icon kind-${kind}`
      icon.innerHTML = kind === 'history' ? CLOCK_SVG : BOOKMARK_SVG
    }
    icon.appendChild(img)
    return icon
  }
  if (kind === 'command') {
    if (item.icon === 'logo') {
      icon.className = 'icon plain'
      const img = document.createElement('img')
      img.src = chrome.runtime.getURL('/icons/footer.png')
      img.draggable = false
      icon.appendChild(img)
      return icon
    }
    icon.className = 'icon kind-command'
    if (item.color) icon.style.background = item.color
    icon.innerHTML = (item.icon && CMD_ICONS[item.icon]) || COMMAND_SVG
    return icon
  }
  if (kind === 'emoji') {
    icon.className = 'icon plain emoji-glyph'
    icon.textContent = item.emoji ?? ''
    return icon
  }
  icon.className = `icon kind-${kind}`
  if (kind === 'calc') {
    icon.textContent = '='
    return icon
  }
  icon.innerHTML =
    kind === 'folder'
      ? FOLDER_SVG
      : kind === 'history'
        ? CLOCK_SVG
        : kind === 'download'
          ? DOC_SVG
          : COMMAND_SVG
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

document.getElementById('gear')?.addEventListener('click', () => {
  void chrome.runtime.openOptionsPage()
  window.close()
})

if (location.hash in HASH_PREFIX) inputEl.value = HASH_PREFIX[location.hash]
void applyStartupSettings().then(updateList)
