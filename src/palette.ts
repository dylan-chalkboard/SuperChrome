/**
 * Palette content script. Self-contained by design: manifest content scripts
 * load as classic scripts, so this file must not import anything.
 *
 * Modes: plain text = bookmarks, '>' = commands, '@' = open tabs, '#' = history.
 * Cmd+K opens a Raycast-style actions panel for the selected item.
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

interface FolderInfo {
  id: string
  path: string
}

interface PaletteAction {
  id: string
  label: string
  danger?: boolean
}

// IIFE + load guard: the manifest injection and the on-demand scripting
// fallback can both run this file in the same isolated world.
;(() => {
const world = window as unknown as Record<string, unknown>
if (world.__codePanelPaletteLoaded) return
world.__codePanelPaletteLoaded = true

const PALETTE_CSS = `
* { box-sizing: border-box; }
.backdrop {
  position: fixed; inset: 0;
}
.panel {
  position: fixed; top: 12px; left: 50%; transform: translateX(-50%);
  width: min(720px, 94vw);
  background: rgba(24, 24, 26, 0.8);
  backdrop-filter: blur(60px) saturate(1.6);
  -webkit-backdrop-filter: blur(60px) saturate(1.6);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 16px;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.14),
    inset 0 0 0 0.5px rgba(255, 255, 255, 0.06),
    0 16px 48px rgba(0, 0, 0, 0.6);
  font: 13px -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  color: #ccccccdd;
  overflow: hidden;
}
.input-row {
  display: flex; align-items: center;
  border-bottom: 1px solid #ffffff10;
}
.input {
  flex: 1; min-width: 0;
  background: transparent; border: none; outline: none;
  padding: 14px 16px; color: #e8e8e8;
  font-size: 15px; font-family: inherit;
}
.input::placeholder { color: #ffffff40; }
.hint { display: flex; gap: 6px; margin-right: 14px; flex-shrink: 0; }
.kbd {
  background: #ffffff14; color: #cccccc99;
  border-radius: 4px; padding: 2px 7px; font-size: 11px;
}
.list { max-height: 55vh; overflow-y: auto; padding: 8px; }
.group-label {
  font-size: 11px; font-weight: 600;
  color: #ffffff59; padding: 8px 8px 4px;
}
.item {
  display: flex; align-items: center; gap: 10px;
  height: 40px; padding: 0 10px; border-radius: 8px; cursor: pointer;
  white-space: nowrap;
}
.item.selected {
  background: rgba(255, 255, 255, 0.14);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
}
.item .icon {
  display: flex; align-items: center; justify-content: center;
  width: 24px; height: 24px; border-radius: 6px;
  background: #ffffff10;
  flex-shrink: 0;
}
.item .icon.plain { background: transparent; }
.item .icon.kind-command { background: #4c9df3; color: #ffffff; }
.item .icon.kind-folder { background: #e0a63c; color: #ffffff; }
.item .icon.kind-history { background: #9a6ee8; color: #ffffff; }
.item .icon.kind-bookmark, .item .icon.kind-tab, .item .icon.kind-closed {
  background: #e05d5d; color: #ffffff;
}
.item .icon img { width: 18px; height: 18px; border-radius: 4px; }
.item .title {
  overflow: hidden; text-overflow: ellipsis;
  flex-shrink: 0; max-width: 55%;
  color: #e8e8e8; font-weight: 500;
}
.item .title b { color: #ffffff; font-weight: 700; }
.item .detail {
  flex: 1; overflow: hidden; text-overflow: ellipsis;
  color: #ffffff4d; font-size: 13px;
}
.item .type {
  flex-shrink: 0; margin-left: auto;
  color: #ffffff4d; font-size: 12px;
}
.empty { padding: 16px; color: #ffffff59; }
.footer {
  display: flex; align-items: center; gap: 14px;
  height: 38px; padding: 0 14px;
  border-top: 1px solid #ffffff10;
  color: #cccccc80; font-size: 12px;
}
.footer .spacer { flex: 1; }
.footer .action { display: flex; align-items: center; gap: 6px; }
.actions {
  position: absolute; right: 10px; bottom: 46px;
  min-width: 230px;
  background: rgba(30, 30, 32, 0.92);
  backdrop-filter: blur(30px) saturate(1.6);
  -webkit-backdrop-filter: blur(30px) saturate(1.6);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 10px; padding: 4px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 8px 24px #00000088;
}
.action-row {
  display: flex; align-items: center; gap: 10px;
  height: 30px; padding: 0 10px; border-radius: 6px; cursor: pointer;
  color: #e0e0e0; white-space: nowrap;
}
.action-row .spacer { flex: 1; min-width: 16px; }
.action-row.selected { background: rgba(255, 255, 255, 0.14); }
.action-row.danger { color: #ff8f8f; }
.list::-webkit-scrollbar { width: 10px; }
.list::-webkit-scrollbar-thumb { background: #ffffff1a; border-radius: 5px; }
`

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
  folder: 'Folder',
  closed: 'Closed',
}

const GROUP_LABELS: Record<string, string> = {
  bookmarks: 'Bookmarks',
  commands: 'Commands',
  tabs: 'Open Tabs',
  history: 'History',
}

type UiState = 'list' | 'actions' | 'rename' | 'move'

let paletteHost: HTMLDivElement | null = null
let paletteInput: HTMLInputElement | null = null
let paletteList: HTMLElement | null = null
let paletteFooter: HTMLElement | null = null
let panelEl: HTMLElement | null = null
let actionsEl: HTMLElement | null = null

let uiState: UiState = 'list'
let flatItems: RemoteItem[] = []
let selectedIndex = 0
let queryToken = 0

let currentActions: PaletteAction[] = []
let actionIndex = 0
let actionTarget: RemoteItem | null = null
let subStateTarget: RemoteItem | null = null
let savedQuery = ''
let foldersCache: FolderInfo[] | null = null
let browseStack: Array<{ id: string; label: string }> = []

chrome.runtime.onMessage.addListener((message: { type?: string; mode?: string }) => {
  if (message?.type === 'toggle-palette') {
    void togglePalette(message.mode === 'commands' ? '>' : '')
  }
})

async function togglePalette(prefix: string): Promise<void> {
  if (paletteHost && paletteInput) {
    const currentPrefix = paletteInput.value.startsWith('>') ? '>' : ''
    if (currentPrefix === prefix && uiState === 'list') {
      closePalette()
    } else {
      exitSubState(false)
      setInput(prefix)
    }
    return
  }
  openPalette(prefix)
}

function setInput(value: string): void {
  if (!paletteInput) return
  paletteInput.value = value
  paletteInput.focus()
  paletteInput.setSelectionRange(value.length, value.length)
  void updateList()
}

function closePalette(): void {
  for (const type of ['keydown', 'keypress', 'keyup'] as const) {
    window.removeEventListener(type, onGlobalKey, true)
  }
  paletteHost?.remove()
  paletteHost = null
  paletteInput = null
  paletteList = null
  paletteFooter = null
  panelEl = null
  actionsEl = null
  uiState = 'list'
  actionTarget = null
  subStateTarget = null
  browseStack = []
}

function openPalette(prefix: string): void {
  paletteHost = document.createElement('div')
  paletteHost.style.cssText = 'position:fixed;inset:0;z-index:2147483647;'
  const shadow = paletteHost.attachShadow({ mode: 'closed' })

  const style = document.createElement('style')
  style.textContent = PALETTE_CSS

  const backdrop = document.createElement('div')
  backdrop.className = 'backdrop'
  backdrop.addEventListener('mousedown', (e) => {
    if (e.target === backdrop) closePalette()
  })

  panelEl = document.createElement('div')
  panelEl.className = 'panel'

  const inputRow = document.createElement('div')
  inputRow.className = 'input-row'

  paletteInput = document.createElement('input')
  paletteInput.className = 'input'
  paletteInput.placeholder = 'Search bookmarks and commands…'
  paletteInput.spellcheck = false
  paletteInput.value = prefix
  paletteInput.addEventListener('input', () => {
    if (uiState === 'actions') closeActions()
    if (uiState === 'rename') return
    void updateList()
  })
  paletteInput.addEventListener('blur', () => {
    // Give row mousedown handlers a beat to run before tearing down.
    setTimeout(() => {
      if (paletteHost && shadow.activeElement !== paletteInput) closePalette()
    }, 150)
  })

  const hint = document.createElement('div')
  hint.className = 'hint'
  hint.append(kbd('> Commands'), kbd('@ Tabs'), kbd('# History'))

  inputRow.append(paletteInput, hint)

  paletteList = document.createElement('div')
  paletteList.className = 'list'

  paletteFooter = document.createElement('div')
  paletteFooter.className = 'footer'

  panelEl.append(inputRow, paletteList, paletteFooter)
  backdrop.appendChild(panelEl)
  shadow.append(style, backdrop)
  document.documentElement.appendChild(paletteHost)
  for (const type of ['keydown', 'keypress', 'keyup'] as const) {
    window.addEventListener(type, onGlobalKey, true)
  }
  paletteInput.focus()
  paletteInput.setSelectionRange(prefix.length, prefix.length)
  void updateList()
}

function kbd(text: string): HTMLElement {
  const chip = document.createElement('span')
  chip.className = 'kbd'
  chip.textContent = text
  return chip
}

function currentMode(): string {
  const raw = paletteInput?.value ?? ''
  if (raw.startsWith('>')) return 'commands'
  if (raw.startsWith('@')) return 'tabs'
  if (raw.startsWith('#')) return 'history'
  return 'bookmarks'
}

function renderFooter(): void {
  if (!paletteFooter) return
  paletteFooter.textContent = ''
  const brand = document.createElement('span')
  brand.textContent = 'SuperChrome'
  const spacer = document.createElement('span')
  spacer.className = 'spacer'
  paletteFooter.append(brand, spacer)

  const mode = currentMode()
  const primary = document.createElement('span')
  primary.className = 'action'
  const primaryLabel =
    uiState === 'move' ? 'Move Here' : mode === 'commands' ? 'Run' : mode === 'tabs' ? 'Switch' : 'Open'
  primary.append(document.createTextNode(primaryLabel), kbd('↵'))
  paletteFooter.appendChild(primary)

  if (uiState === 'list') {
    const actions = document.createElement('span')
    actions.className = 'action'
    actions.append(document.createTextNode('Actions'), kbd('⌘K'))
    paletteFooter.appendChild(actions)
  }
}

/* ---------- Key handling ---------- */

/**
 * Runs in capture phase on window while the palette is open, so page hotkey
 * handlers never see keystrokes. stopPropagation skips all downstream
 * listeners — including our input's — so key handling lives here; plain
 * typing still lands in the focused input via the default action.
 */
function onGlobalKey(e: KeyboardEvent): void {
  if (!paletteHost) return
  e.stopPropagation()
  if (e.type !== 'keydown') return

  if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
    e.preventDefault()
    if (uiState === 'actions') closeActions()
    else if (uiState === 'list') openActions()
    return
  }

  if ((e.metaKey || e.ctrlKey) && e.key >= '1' && e.key <= '9' && uiState === 'list') {
    e.preventDefault()
    const item = flatItems[Number(e.key) - 1]
    if (item) void executeItem(item, false)
    return
  }

  if (uiState === 'actions') {
    if (/^[1-9]$/.test(e.key)) {
      e.preventDefault()
      const action = currentActions[Number(e.key) - 1]
      if (action && actionTarget) void runAction(action, actionTarget)
    } else if (e.key === 'Escape') {
      e.preventDefault()
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

  if (uiState === 'rename') {
    if (e.key === 'Escape') {
      e.preventDefault()
      exitSubState(false)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      void commitRename()
    }
    return
  }

  if (e.key === 'Escape') {
    e.preventDefault()
    if (uiState === 'move') exitSubState(false)
    else if (browseStack.length && currentMode() === 'bookmarks') popFolder()
    else closePalette()
  } else if (
    e.key === 'Backspace' &&
    paletteInput?.value === '' &&
    browseStack.length &&
    currentMode() === 'bookmarks' &&
    uiState === 'list'
  ) {
    e.preventDefault()
    popFolder()
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    moveSelection(1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    moveSelection(-1)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const item = flatItems[selectedIndex]
    if (item) void executeItem(item, e.metaKey || e.ctrlKey)
  } else if (e.key === 'Tab') {
    e.preventDefault()
  } else if (paletteInput && document.activeElement !== paletteHost) {
    // Page stole focus — reclaim it so typing keeps landing in the palette.
    paletteInput.focus()
  }
}

function moveSelection(delta: number): void {
  if (!flatItems.length) return
  selectedIndex = (selectedIndex + delta + flatItems.length) % flatItems.length
  highlightSelection()
}

function highlightSelection(): void {
  if (!paletteList) return
  const rows = paletteList.querySelectorAll<HTMLElement>('.item')
  rows.forEach((row, i) => row.classList.toggle('selected', i === selectedIndex))
  rows[selectedIndex]?.scrollIntoView({ block: 'nearest' })
}

/* ---------- Executing items ---------- */

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

function enterFolder(item: RemoteItem): void {
  if (!item.id || !paletteInput) return
  recordUsage(item)
  browseStack.push({ id: item.id, label: item.label })
  paletteInput.value = ''
  paletteInput.focus()
  void updateList()
}

function popFolder(): void {
  browseStack.pop()
  if (paletteInput) paletteInput.value = ''
  void updateList()
}

async function executeItem(item: RemoteItem, altAction: boolean): Promise<void> {
  if (uiState === 'move') {
    await commitMove(item)
    return
  }
  if (item.kind === 'folder') {
    enterFolder(item)
    return
  }
  recordUsage(item)
  if (item.kind === 'bookmark' || item.kind === 'history') {
    void chrome.runtime.sendMessage({ type: 'open-url', url: item.url, newTab: altAction })
  } else if (item.kind === 'tab') {
    void chrome.runtime.sendMessage({ type: 'activate-tab', tabId: item.tabId })
  } else if (item.kind === 'closed') {
    void chrome.runtime.sendMessage({ type: 'restore-session', sessionId: item.sessionId })
  } else if (item.commandId === 'switch-to-tab') {
    setInput('@')
    return
  } else if (item.commandId === 'print-page') {
    closePalette()
    window.print()
    return
  } else {
    void chrome.runtime.sendMessage({ type: 'run-command', id: item.commandId })
  }
  closePalette()
}

/* ---------- Actions panel (⌘K) ---------- */

function actionsFor(item: RemoteItem): PaletteAction[] {
  switch (item.kind) {
    case 'bookmark':
      return [
        { id: 'open', label: 'Open' },
        { id: 'open-new-tab', label: 'Open in New Tab' },
        { id: 'copy-url', label: 'Copy URL' },
        { id: 'copy-md', label: 'Copy Markdown Link' },
        { id: 'rename', label: 'Rename…' },
        { id: 'move', label: 'Move to Folder…' },
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
        { id: 'rename', label: 'Rename…' },
        { id: 'folder-delete', label: 'Delete Folder', danger: true },
      ]
    default:
      return [{ id: 'run', label: 'Run Command' }]
  }
}

function openActions(): void {
  const item = flatItems[selectedIndex]
  if (!item || !panelEl) return
  actionTarget = item
  currentActions = actionsFor(item)
  actionIndex = 0
  uiState = 'actions'

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
    if (index < 9) row.appendChild(kbd(String(index + 1)))
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
  panelEl.appendChild(actionsEl)
  highlightActions()
  renderFooter()
}

function closeActions(): void {
  actionsEl?.remove()
  actionsEl = null
  actionTarget = null
  uiState = 'list'
  renderFooter()
}

function highlightActions(): void {
  if (!actionsEl) return
  actionsEl
    .querySelectorAll<HTMLElement>('.action-row')
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
      closePalette()
      return
    case 'copy-url':
      copyText(item.url ?? '')
      closePalette()
      return
    case 'copy-md':
      copyText(`[${item.label}](${item.url ?? ''})`)
      closePalette()
      return
    case 'switch':
      await chrome.runtime.sendMessage({ type: 'activate-tab', tabId: item.tabId })
      closePalette()
      return
    case 'reopen':
      await chrome.runtime.sendMessage({ type: 'restore-session', sessionId: item.sessionId })
      closePalette()
      return
    case 'browse':
      closeActions()
      enterFolder(item)
      return
    case 'open-all':
      await chrome.runtime.sendMessage({ type: 'open-folder-tabs', id: item.id })
      closePalette()
      return
    case 'folder-delete':
      await chrome.runtime.sendMessage({ type: 'folder-delete', id: item.id })
      break
    case 'run':
      closeActions()
      await executeItem(item, false)
      return
    case 'rename':
      closeActions()
      enterRename(item)
      return
    case 'move':
      closeActions()
      await enterMove(item)
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

function copyText(text: string): void {
  void navigator.clipboard?.writeText(text).catch(() => {
    const area = document.createElement('textarea')
    area.value = text
    document.body.appendChild(area)
    area.select()
    document.execCommand('copy')
    area.remove()
  })
}

/* ---------- Rename / move sub-states ---------- */

function enterRename(item: RemoteItem): void {
  if (!paletteInput || !paletteList) return
  uiState = 'rename'
  subStateTarget = item
  savedQuery = paletteInput.value
  paletteInput.value = item.label
  paletteInput.placeholder = 'New name…'
  paletteInput.focus()
  paletteInput.select()
  paletteList.textContent = ''
  flatItems = []
  const hint = document.createElement('div')
  hint.className = 'empty'
  hint.textContent = `Renaming "${item.label}" — ↵ to save, esc to cancel`
  paletteList.appendChild(hint)
  renderFooter()
}

async function commitRename(): Promise<void> {
  const title = paletteInput?.value.trim()
  if (subStateTarget?.id && title) {
    await chrome.runtime.sendMessage({ type: 'bookmark-rename', id: subStateTarget.id, title })
  }
  exitSubState(true)
}

async function enterMove(item: RemoteItem): Promise<void> {
  if (!paletteInput) return
  uiState = 'move'
  subStateTarget = item
  savedQuery = paletteInput.value
  paletteInput.value = ''
  paletteInput.placeholder = `Move "${item.label}" to folder…`
  paletteInput.focus()
  if (!foldersCache) {
    const response = (await chrome.runtime.sendMessage({ type: 'folders' })) as {
      folders?: FolderInfo[]
    }
    foldersCache = response?.folders ?? []
  }
  void updateList()
}

async function commitMove(folderItem: RemoteItem): Promise<void> {
  if (subStateTarget?.id && folderItem.id) {
    await chrome.runtime.sendMessage({
      type: 'bookmark-move',
      id: subStateTarget.id,
      parentId: folderItem.id,
    })
  }
  exitSubState(true)
}

function exitSubState(_commit: boolean): void {
  if (uiState === 'actions') closeActions()
  if (!paletteInput) return
  uiState = 'list'
  subStateTarget = null
  paletteInput.value = savedQuery
  paletteInput.placeholder = 'Search bookmarks and commands…'
  paletteInput.focus()
  void updateList()
}

/* ---------- List rendering ---------- */

function localFuzzy(query: string, text: string): number | null {
  if (!query) return 0
  let qi = 0
  let score = 0
  let streak = 0
  for (let ti = 0; ti < text.length && qi < query.length; ti++) {
    if (text[ti] === query[qi]) {
      streak++
      score += 1 + streak * 2
      qi++
    } else {
      streak = 0
    }
  }
  return qi === query.length ? score : null
}

async function updateList(): Promise<void> {
  if (!paletteInput || !paletteList) return
  const token = ++queryToken
  renderFooter()

  if (uiState === 'rename') return

  if (uiState === 'move') {
    const query = paletteInput.value.trim().toLowerCase()
    const folders = (foldersCache ?? [])
      .map((f) => ({ f, s: localFuzzy(query, f.path.toLowerCase()) }))
      .filter((x) => x.s !== null)
      .sort((a, b) => b.s! - a.s!)
      .map((x): RemoteItem => ({ kind: 'folder', label: x.f.path, detail: '', id: x.f.id }))
    renderItems('Folders', folders)
    return
  }

  const mode = currentMode()
  const query = paletteInput.value.replace(/^[>@#]/, '')
  const browsing = mode === 'bookmarks' && browseStack.length > 0
  const folderId = browsing ? browseStack[browseStack.length - 1].id : undefined
  const response = (await chrome.runtime.sendMessage({
    type: 'palette-query',
    mode,
    query,
    folderId,
  })) as { items?: RemoteItem[] }
  if (token !== queryToken || uiState !== 'list' || !paletteList) return
  const groupLabel = browsing
    ? browseStack[browseStack.length - 1].label
    : (GROUP_LABELS[mode] ?? 'Results')
  renderItems(groupLabel, response?.items ?? [])
}

function renderItems(groupLabel: string, items: RemoteItem[]): void {
  if (!paletteList) return
  paletteList.textContent = ''
  flatItems = items
  selectedIndex = 0

  if (!items.length) {
    const empty = document.createElement('div')
    empty.className = 'empty'
    empty.textContent = 'No results'
    paletteList.appendChild(empty)
    return
  }

  let lastGroup: string | null = null
  items.forEach((item, index) => {
    const group = item.group ?? groupLabel
    if (group !== lastGroup) {
      const label = document.createElement('div')
      label.className = 'group-label'
      label.textContent = group
      paletteList!.appendChild(label)
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
    row.addEventListener('mousedown', (e) => {
      e.preventDefault()
      void executeItem(item, e.metaKey || e.ctrlKey)
    })
    row.addEventListener('mousemove', () => {
      if (selectedIndex !== index) {
        selectedIndex = index
        highlightSelection()
      }
    })
    paletteList!.appendChild(row)
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
})()
