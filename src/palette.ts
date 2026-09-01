/**
 * Bookmark palette content script. Self-contained by design: manifest content
 * scripts load as classic scripts, so this file must not import anything.
 *
 * Modes: plain text searches bookmarks, '>' prefix runs commands, '@' prefix
 * switches between open tabs.
 */

interface FlatBookmark {
  title: string
  url: string
  path: string
}
interface TabInfo {
  id?: number
  title: string
  url: string
}
interface CommandInfo {
  id: string
  label: string
}
interface PaletteData {
  bookmarks: FlatBookmark[]
  tabs: TabInfo[]
  commands: CommandInfo[]
}

type PaletteItem =
  | { kind: 'bookmark'; label: string; detail: string; url: string }
  | { kind: 'tab'; label: string; detail: string; tabId: number; url: string }
  | { kind: 'command'; label: string; detail: string; commandId: string }

type PaletteMode = 'bookmarks' | 'commands' | 'tabs'

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
.item .icon img { width: 18px; height: 18px; border-radius: 4px; }
.item .title {
  overflow: hidden; text-overflow: ellipsis;
  flex-shrink: 0; max-width: 55%;
  color: #e8e8e8; font-weight: 500;
}
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
.list::-webkit-scrollbar { width: 10px; }
.list::-webkit-scrollbar-thumb { background: #ffffff1a; border-radius: 5px; }
`

const BOOKMARK_SVG =
  '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 2.5h8V14l-4-2.5L4 14V2.5z" stroke="currentColor" stroke-linejoin="round"/></svg>'
const COMMAND_SVG =
  '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M5 4l4 4-4 4" stroke="currentColor" stroke-linecap="round"/></svg>'

const TYPE_LABELS: Record<PaletteItem['kind'], string> = {
  bookmark: 'Bookmark',
  tab: 'Tab',
  command: 'Command',
}

let paletteHost: HTMLDivElement | null = null
let paletteInput: HTMLInputElement | null = null
let paletteList: HTMLElement | null = null
let paletteFooter: HTMLElement | null = null
let paletteData: PaletteData | null = null
let flatItems: PaletteItem[] = []
let selectedIndex = 0

chrome.runtime.onMessage.addListener((message: { type?: string; mode?: string }) => {
  if (message?.type === 'toggle-palette') {
    void togglePalette(message.mode === 'commands' ? '>' : '')
  }
})

async function togglePalette(prefix: string): Promise<void> {
  if (paletteHost && paletteInput) {
    const currentPrefix = paletteInput.value.startsWith('>') ? '>' : ''
    if (currentPrefix === prefix) {
      closePalette()
    } else {
      setInput(prefix)
    }
    return
  }
  paletteData = (await chrome.runtime.sendMessage({ type: 'palette-data' })) as PaletteData
  openPalette(prefix)
}

function setInput(value: string): void {
  if (!paletteInput) return
  paletteInput.value = value
  paletteInput.focus()
  paletteInput.setSelectionRange(value.length, value.length)
  updateList()
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
}

/**
 * Runs in capture phase on window while the palette is open, so page hotkey
 * handlers (Gmail, GitHub, …) never see keystrokes. stopPropagation skips all
 * downstream listeners — including our input's — so key handling lives here;
 * plain typing still lands in the focused input via the default action.
 */
function onGlobalKey(e: KeyboardEvent): void {
  if (!paletteHost) return
  e.stopPropagation()
  if (e.type !== 'keydown') return
  if (e.key === 'Escape') {
    e.preventDefault()
    closePalette()
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    moveSelection(1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    moveSelection(-1)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const item = flatItems[selectedIndex]
    if (item) executeItem(item, e.metaKey || e.ctrlKey)
  } else if (e.key === 'Tab') {
    e.preventDefault()
  } else if (paletteInput && document.activeElement !== paletteHost) {
    // Page stole focus — reclaim it so typing keeps landing in the palette.
    paletteInput.focus()
  }
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

  const panel = document.createElement('div')
  panel.className = 'panel'

  const inputRow = document.createElement('div')
  inputRow.className = 'input-row'

  paletteInput = document.createElement('input')
  paletteInput.className = 'input'
  paletteInput.placeholder = 'Search bookmarks and commands…'
  paletteInput.spellcheck = false
  paletteInput.value = prefix
  paletteInput.addEventListener('input', updateList)
  paletteInput.addEventListener('blur', () => {
    // Give row mousedown handlers a beat to run before tearing down.
    setTimeout(() => {
      if (paletteHost && shadow.activeElement !== paletteInput) closePalette()
    }, 150)
  })

  const hint = document.createElement('div')
  hint.className = 'hint'
  hint.append(kbd('> Commands'), kbd('@ Tabs'))

  inputRow.append(paletteInput, hint)

  paletteList = document.createElement('div')
  paletteList.className = 'list'

  paletteFooter = document.createElement('div')
  paletteFooter.className = 'footer'

  panel.append(inputRow, paletteList, paletteFooter)
  backdrop.appendChild(panel)
  shadow.append(style, backdrop)
  document.documentElement.appendChild(paletteHost)
  for (const type of ['keydown', 'keypress', 'keyup'] as const) {
    window.addEventListener(type, onGlobalKey, true)
  }
  paletteInput.focus()
  paletteInput.setSelectionRange(prefix.length, prefix.length)
  updateList()
}

function kbd(text: string): HTMLElement {
  const chip = document.createElement('span')
  chip.className = 'kbd'
  chip.textContent = text
  return chip
}

function renderFooter(mode: PaletteMode): void {
  if (!paletteFooter) return
  paletteFooter.textContent = ''
  const brand = document.createElement('span')
  brand.textContent = 'Code Panel'
  const spacer = document.createElement('span')
  spacer.className = 'spacer'
  paletteFooter.append(brand, spacer)

  const primary = document.createElement('span')
  primary.className = 'action'
  const primaryLabel = mode === 'commands' ? 'Run' : mode === 'tabs' ? 'Switch' : 'Open'
  primary.append(document.createTextNode(primaryLabel), kbd('↵'))
  paletteFooter.appendChild(primary)

  if (mode === 'bookmarks') {
    const secondary = document.createElement('span')
    secondary.className = 'action'
    secondary.append(document.createTextNode('New Tab'), kbd('⌘↵'))
    paletteFooter.appendChild(secondary)
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

function executeItem(item: PaletteItem, altAction: boolean): void {
  if (item.kind === 'bookmark') {
    void chrome.runtime.sendMessage({ type: 'open-url', url: item.url, newTab: altAction })
  } else if (item.kind === 'tab') {
    void chrome.runtime.sendMessage({ type: 'activate-tab', tabId: item.tabId })
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

function fuzzyScore(query: string, text: string): number | null {
  if (!query) return 0
  let qi = 0
  let score = 0
  let streak = 0
  for (let ti = 0; ti < text.length && qi < query.length; ti++) {
    if (text[ti] === query[qi]) {
      streak++
      const wordStart = ti === 0 || ' /-_.:'.includes(text[ti - 1])
      score += 1 + streak * 2 + (wordStart ? 6 : 0)
      qi++
    } else {
      streak = 0
    }
  }
  return qi === query.length ? score - text.length * 0.01 : null
}

function updateList(): void {
  if (!paletteInput || !paletteList || !paletteData) return
  const raw = paletteInput.value
  const mode: PaletteMode = raw.startsWith('>')
    ? 'commands'
    : raw.startsWith('@')
      ? 'tabs'
      : 'bookmarks'
  const query = raw.replace(/^[>@]/, '').trim().toLowerCase()

  paletteList.textContent = ''
  flatItems = []
  selectedIndex = 0
  renderFooter(mode)

  if (mode === 'commands') {
    const items = scoreAndSort(
      paletteData.commands.map((c) => ({
        item: { kind: 'command', label: c.label, detail: '', commandId: c.id } as PaletteItem,
        text: c.label.toLowerCase(),
      })),
      query,
    )
    appendGroup('Commands', items)
  } else if (mode === 'tabs') {
    const items = scoreAndSort(
      paletteData.tabs
        .filter((t) => t.id !== undefined)
        .map((t) => ({
          item: {
            kind: 'tab',
            label: t.title || t.url,
            detail: shortUrl(t.url),
            tabId: t.id!,
            url: t.url,
          } as PaletteItem,
          text: `${t.title} ${t.url}`.toLowerCase(),
        })),
      query,
    )
    appendGroup('Open Tabs', items)
  } else {
    const items = scoreAndSort(
      paletteData.bookmarks.map((b) => ({
        item: {
          kind: 'bookmark',
          label: b.title,
          detail: b.path || shortUrl(b.url),
          url: b.url,
        } as PaletteItem,
        text: `${b.title} ${b.url}`.toLowerCase(),
      })),
      query,
    ).slice(0, 50)
    appendGroup('Bookmarks', items)
  }

  if (!flatItems.length) {
    const empty = document.createElement('div')
    empty.className = 'empty'
    empty.textContent = 'No results'
    paletteList.appendChild(empty)
  }
  highlightSelection()
}

function scoreAndSort(
  entries: Array<{ item: PaletteItem; text: string }>,
  query: string,
): PaletteItem[] {
  const scored: Array<{ item: PaletteItem; score: number }> = []
  for (const entry of entries) {
    const score = fuzzyScore(query, entry.text)
    if (score !== null) scored.push({ item: entry.item, score })
  }
  scored.sort((a, b) => b.score - a.score)
  return scored.map((s) => s.item)
}

function iconFor(item: PaletteItem): HTMLElement {
  const icon = document.createElement('span')
  icon.className = 'icon'
  if (item.kind === 'bookmark' || item.kind === 'tab') {
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

function appendGroup(label: string, items: PaletteItem[]): void {
  if (!items.length || !paletteList) return
  const groupLabel = document.createElement('div')
  groupLabel.className = 'group-label'
  groupLabel.textContent = label
  paletteList.appendChild(groupLabel)
  for (const item of items) {
    const index = flatItems.length
    flatItems.push(item)
    const row = document.createElement('div')
    row.className = 'item'
    const title = document.createElement('span')
    title.className = 'title'
    title.textContent = item.label
    const detail = document.createElement('span')
    detail.className = 'detail'
    detail.textContent = item.detail
    const type = document.createElement('span')
    type.className = 'type'
    type.textContent = TYPE_LABELS[item.kind]
    row.append(iconFor(item), title, detail, type)
    row.addEventListener('mousedown', (e) => {
      e.preventDefault()
      executeItem(item, e.metaKey || e.ctrlKey)
    })
    row.addEventListener('mousemove', () => {
      if (selectedIndex !== index) {
        selectedIndex = index
        highlightSelection()
      }
    })
    paletteList.appendChild(row)
  }
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
