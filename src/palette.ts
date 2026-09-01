/**
 * Palette content script. Self-contained by design: manifest content scripts
 * load as classic scripts, so this file must not import anything.
 *
 * Modes: plain text = bookmarks, '>' = commands, '@' = open tabs, '#' = history.
 * Cmd+K opens a Raycast-style actions panel for the selected item.
 */

interface RemoteItem {
  kind: 'bookmark' | 'tab' | 'history' | 'command' | 'closed' | 'folder' | 'calc' | 'emoji' | 'download' | 'search'
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
  transition: opacity 0.13s ease, transform 0.13s ease;
  width: min(720px, 94vw);
  background: rgba(24, 24, 26, var(--sc-op, 0.8));
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
.panel.enter, .panel.closing {
  opacity: 0;
  transform: translateX(-50%) translateY(-6px) scale(0.985);
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
.list { height: 55vh; overflow-y: auto; padding: 8px; position: relative; }
.selector {
  position: absolute; left: 8px; right: 8px; top: 0; height: 40px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.14);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
  transition: transform 0.1s ease, height 0.1s ease;
  pointer-events: none;
  will-change: transform;
  opacity: 0;
}
.group-label {
  font-size: 11px; font-weight: 600;
  color: #ffffff59; padding: 8px 8px 4px;
}
.item {
  display: flex; align-items: center; gap: 10px;
  height: 40px; padding: 0 10px; border-radius: 8px; cursor: pointer;
  white-space: nowrap;
  position: relative; z-index: 1;
}
.emoji-grid {
  display: grid; grid-template-columns: repeat(8, 1fr); gap: 2px; padding: 2px;
}
.emoji-cell {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 3px; height: 58px; padding: 4px; border-radius: 8px; cursor: pointer;
  min-width: 0;
}
.emoji-cell .glyph { font-size: 22px; line-height: 1; }
.emoji-cell .emoji-name {
  max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-size: 9px; color: #ffffff59;
}
.emoji-cell.selected, .emoji-cell:hover { background: rgba(255, 255, 255, 0.14); }
.item .icon {
  display: flex; align-items: center; justify-content: center;
  width: 24px; height: 24px; border-radius: 6px;
  background: #ffffff10;
  flex-shrink: 0;
}
.item .icon.plain { background: transparent; }
.item .icon.kind-command { background: var(--sc-command, #4c9df3); color: #ffffff; }
.item .icon.kind-folder { background: var(--sc-folder, #e0a63c); color: #ffffff; }
.item .icon.kind-history { background: var(--sc-history, #9a6ee8); color: #ffffff; }
.item .icon.kind-bookmark, .item .icon.kind-tab, .item .icon.kind-closed {
  background: var(--sc-fallback, #e05d5d); color: #ffffff;
}
.item .icon.kind-download { background: #3aa99f; color: #ffffff; }
.group-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.item .icon.kind-calc { background: #4caf7d; color: #ffffff; font-weight: 700; font-size: 14px; }
.item .icon.emoji-glyph { font-size: 17px; }
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
.footer .brand-logo { width: 26px; height: 26px; opacity: 0.5; }
.footer .gear {
  display: flex; align-items: center; justify-content: center;
  width: 26px; height: 26px; padding: 0;
  background: none; border: none; border-radius: 6px;
  color: #cccccc80; cursor: pointer;
}
.footer .gear:hover { background: #ffffff14; color: #e8e8e8; }
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
@media (prefers-reduced-motion: reduce) {
  .panel, .selector, .toast { transition: none !important; }
}
.panel.no-motion, .no-motion .selector { transition: none !important; }
`

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
  link: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M6.5 9.5l3-3M5 7L3.2 8.8a2.5 2.5 0 003.5 3.5L8.5 10.5M11 9l1.8-1.8a2.5 2.5 0 00-3.5-3.5L7.5 5.5" stroke="currentColor" stroke-linecap="round"/></svg>',
  doc: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 1.5h5.5L12.5 5v9.5h-8.5v-13z" stroke="currentColor" stroke-linejoin="round"/><path d="M9.5 1.5V5H12.5" stroke="currentColor" stroke-linejoin="round"/></svg>',
  image: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="10" rx="1" stroke="currentColor"/><circle cx="5.5" cy="6.5" r="1.2" stroke="currentColor"/><path d="M2 11l3.5-3 3 2.5L11 8l3 3" stroke="currentColor" stroke-linejoin="round"/></svg>',
  film: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="10" rx="1" stroke="currentColor"/><path d="M5 3v10M11 3v10M2 6h3M2 10h3M11 6h3M11 10h3" stroke="currentColor"/></svg>',
  music: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M6 12.5V3.5l7-1.5v9" stroke="currentColor" stroke-linejoin="round"/><circle cx="4" cy="12.5" r="2" stroke="currentColor"/><circle cx="11" cy="11.5" r="2" stroke="currentColor"/></svg>',
  archive: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="2.5" y="4.5" width="11" height="9" rx="1" stroke="currentColor"/><path d="M2 2.5h12v2H2zM6.5 7.5h3" stroke="currentColor" stroke-linejoin="round"/></svg>',
  table: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="10" rx="1" stroke="currentColor"/><path d="M2 6.5h12M2 9.5h12M6.5 3v10M10.5 3v10" stroke="currentColor"/></svg>',
  form: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="2.5" y="3" width="11" height="10" rx="1" stroke="currentColor"/><path d="M5 6h6M5 8.5h6M5 11h3" stroke="currentColor" stroke-linecap="round"/></svg>',
}

const TYPE_LABELS: Record<string, string> = {
  bookmark: 'Bookmark',
  tab: 'Tab',
  history: 'History',
  command: 'Command',
  folder: 'Folder',
  closed: 'Closed',
  calc: 'Calculator',
  emoji: 'Emoji',
  download: 'Download',
  search: 'Search',
}

const GROUP_LABELS: Record<string, string> = {
  bookmarks: 'Bookmarks',
  commands: 'Commands',
  tabs: 'Open Tabs',
  history: 'History',
  emoji: 'Emoji',
  downloads: 'Downloads',
}

type UiState = 'list' | 'actions' | 'rename' | 'move' | 'group'

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
let lastFocused: HTMLElement | null = null
let prefersNewTab = false
let selectorEl: HTMLElement | null = null
const GRID_COLS = 8
let reduceMotionPref = false

function reducedMotion(): boolean {
  return reduceMotionPref || window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Insert into the element that had focus before the palette opened, else copy. */
function insertOrCopy(text: string): void {
  const target = lastFocused
  closePalette()
  if (
    target &&
    (target.isContentEditable ||
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement)
  ) {
    target.focus()
    if (document.execCommand('insertText', false, text)) return
  }
  copyText(text)
}

const MODE_PREFIX: Record<string, string> = {
  bookmarks: '',
  commands: '>',
  tabs: '@',
  history: '#',
}

chrome.runtime.onMessage.addListener((message: { type?: string; mode?: string }) => {
  if (message?.type === 'toggle-palette') {
    void togglePalette(MODE_PREFIX[message.mode ?? 'bookmarks'] ?? '')
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

/** Options-page settings (opacity, icon colors) applied as CSS variables. */
async function applyUserSettings(): Promise<void> {
  try {
    const { settings } = await chrome.storage.sync.get('settings')
    if (!panelEl || !settings) return
    if (typeof settings.glassOpacity === 'number') {
      panelEl.style.setProperty('--sc-op', String(settings.glassOpacity))
    }
    const colors = settings.iconColors ?? {}
    for (const key of ['command', 'folder', 'history', 'fallback'] as const) {
      if (typeof colors[key] === 'string') panelEl.style.setProperty(`--sc-${key}`, colors[key])
    }
    prefersNewTab = settings.openInNewTab === true
    reduceMotionPref = settings.reduceMotion === true
    if (reduceMotionPref) panelEl.classList.add('no-motion')
    renderFooter()
  } catch {
    // Defaults baked into the CSS cover this.
  }
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
  const host = paletteHost
  const panel = panelEl
  if (host && panel && !reducedMotion()) {
    host.style.pointerEvents = 'none'
    panel.classList.add('closing')
    setTimeout(() => host.remove(), 140)
  } else {
    host?.remove()
  }
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
  lastFocused = document.activeElement as HTMLElement | null
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
    // Pages like google.com aggressively re-focus their own search box.
    // Clicks outside are handled by the backdrop, so on blur we reclaim
    // focus instead of closing.
    setTimeout(() => {
      if (paletteHost && paletteInput && shadow.activeElement !== paletteInput) {
        paletteInput.focus()
      }
    }, 0)
  })

  const hint = document.createElement('div')
  hint.className = 'hint'
  hint.append(kbd('> Cmds'), kbd('@ Tabs'), kbd('# History'), kbd(': Emoji'), kbd('~ Files'))

  inputRow.append(paletteInput, hint)

  paletteList = document.createElement('div')
  paletteList.className = 'list'

  paletteFooter = document.createElement('div')
  paletteFooter.className = 'footer'

  panelEl.append(inputRow, paletteList, paletteFooter)
  backdrop.appendChild(panelEl)
  shadow.append(style, backdrop)
  if (!reducedMotion()) {
    panelEl.classList.add('enter')
    requestAnimationFrame(() => panelEl?.classList.remove('enter'))
  }
  document.documentElement.appendChild(paletteHost)
  for (const type of ['keydown', 'keypress', 'keyup'] as const) {
    window.addEventListener(type, onGlobalKey, true)
  }
  paletteInput.focus()
  paletteInput.setSelectionRange(prefix.length, prefix.length)
  void applyUserSettings()
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
  if (raw.startsWith(':')) return 'emoji'
  if (raw.startsWith('~')) return 'downloads'
  return 'bookmarks'
}

function renderFooter(): void {
  if (!paletteFooter) return
  paletteFooter.textContent = ''
  const brand = document.createElement('img')
  brand.className = 'brand-logo'
  brand.src = chrome.runtime.getURL('/icons/footer.png')
  brand.alt = 'SuperChrome'
  brand.title = 'SuperChrome'
  brand.draggable = false
  const spacer = document.createElement('span')
  spacer.className = 'spacer'
  paletteFooter.append(brand, spacer)

  const mode = currentMode()
  const primary = document.createElement('span')
  primary.className = 'action'
  const primaryLabel =
    uiState === 'move'
      ? 'Move Here'
      : mode === 'commands'
        ? 'Run'
        : mode === 'tabs'
          ? 'Switch'
          : mode === 'emoji'
            ? 'Insert'
            : 'Open'
  primary.append(document.createTextNode(primaryLabel), kbd('↵'))
  paletteFooter.appendChild(primary)

  if (uiState === 'list' && (mode === 'bookmarks' || mode === 'history')) {
    const secondary = document.createElement('span')
    secondary.className = 'action'
    secondary.append(
      document.createTextNode(prefersNewTab ? 'Current Tab' : 'New Tab'),
      kbd('⌘↵'),
    )
    paletteFooter.appendChild(secondary)
  }

  if (uiState === 'list') {
    if (browseStack.length && mode === 'bookmarks') {
      const reorder = document.createElement('span')
      reorder.className = 'action'
      reorder.append(document.createTextNode('Reorder'), kbd('⌥↑↓'))
      paletteFooter.appendChild(reorder)
    }
    const actions = document.createElement('span')
    actions.className = 'action'
    actions.append(document.createTextNode('Actions'), kbd('⌘K'))
    paletteFooter.appendChild(actions)
  }

  const gear = document.createElement('button')
  gear.className = 'gear'
  gear.title = 'SuperChrome Settings'
  gear.innerHTML =
    '<svg width="15" height="15" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="2.2" stroke="currentColor"/><path d="M8 1.8v1.7M8 12.5v1.7M1.8 8h1.7M12.5 8h1.7M3.6 3.6l1.2 1.2M11.2 11.2l1.2 1.2M12.4 3.6l-1.2 1.2M4.8 11.2l-1.2 1.2" stroke="currentColor" stroke-linecap="round"/></svg>'
  gear.addEventListener('mousedown', (e) => {
    e.preventDefault()
    void chrome.runtime.sendMessage({ type: 'run-command', id: 'open-options' })
    closePalette()
  })
  paletteFooter.appendChild(gear)
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

  if (
    e.altKey &&
    (e.key === 'ArrowUp' || e.key === 'ArrowDown') &&
    uiState === 'list' &&
    browseStack.length &&
    currentMode() === 'bookmarks'
  ) {
    e.preventDefault()
    const item = flatItems[selectedIndex]
    if (item) void reorderItem(item, e.key === 'ArrowUp' ? -1 : 1)
    return
  }

  const gridActive = uiState === 'list' && currentMode() === 'emoji'
  if (gridActive && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
    e.preventDefault()
    moveSelection(e.key === 'ArrowRight' ? 1 : -1)
    return
  }
  if (gridActive && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
    e.preventDefault()
    moveSelection(e.key === 'ArrowDown' ? GRID_COLS : -GRID_COLS)
    return
  }

  if (e.key === 'Escape') {
    e.preventDefault()
    if (uiState === 'move' || uiState === 'group') exitSubState(false)
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

function highlightSelection(instant = false): void {
  if (!paletteList) return
  const cells = paletteList.querySelectorAll<HTMLElement>('.emoji-cell')
  if (cells.length) {
    cells.forEach((cell, i) => cell.classList.toggle('selected', i === selectedIndex))
    cells[selectedIndex]?.scrollIntoView({ block: 'nearest' })
    return
  }
  const rows = paletteList.querySelectorAll<HTMLElement>('.item')
  rows.forEach((row, i) => row.classList.toggle('selected', i === selectedIndex))
  const row = rows[selectedIndex]
  if (row && selectorEl) {
    if (instant) selectorEl.style.transition = 'none'
    selectorEl.style.opacity = '1'
    selectorEl.style.transform = `translateY(${row.offsetTop}px)`
    selectorEl.style.height = `${row.offsetHeight}px`
    if (instant) {
      selectorEl.getBoundingClientRect()
      selectorEl.style.transition = ''
    }
  } else if (selectorEl) {
    selectorEl.style.opacity = '0'
  }
  row?.scrollIntoView({ block: 'nearest' })
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
          : item.kind === 'emoji'
            ? `emoji:${item.emoji}`
            : null
  if (key) void chrome.runtime.sendMessage({ type: 'record-usage', key })
}

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
  if (uiState === 'group') {
    await commitGroup(item)
    return
  }
  if (item.kind === 'download') {
    void chrome.runtime.sendMessage({ type: 'download-open', downloadId: item.downloadId })
    closePalette()
    return
  }
  if (item.kind === 'folder') {
    enterFolder(item)
    return
  }
  if (item.kind === 'calc') {
    copyText(item.text ?? item.label)
    closePalette()
    return
  }
  if (item.kind === 'emoji') {
    recordUsage(item)
    insertOrCopy(item.emoji ?? '')
    return
  }
  recordUsage(item)
  if (item.kind === 'bookmark' || item.kind === 'history' || item.kind === 'search') {
    void chrome.runtime.sendMessage({ type: 'open-url', url: item.url, newTab: altAction })
  } else if (item.kind === 'tab') {
    void chrome.runtime.sendMessage({ type: 'activate-tab', tabId: item.tabId })
  } else if (item.kind === 'closed') {
    void chrome.runtime.sendMessage({ type: 'restore-session', sessionId: item.sessionId })
  } else if (item.commandId === 'pick-color') {
    closePalette()
    void pickColor()
    return
  } else if (item.commandId === 'copy-page-url') {
    copyText(location.href)
    closePalette()
    return
  } else if (item.commandId === 'copy-page-md') {
    copyText(`[${document.title || location.href}](${location.href})`)
    closePalette()
    return
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
        ...(browseStack.length && currentMode() === 'bookmarks'
          ? [
              { id: 'move-up', label: 'Move Up' },
              { id: 'move-down', label: 'Move Down' },
            ]
          : []),
        { id: 'delete', label: 'Delete Bookmark', danger: true },
      ]
    case 'search':
      return [
        { id: 'open', label: 'Search' },
        { id: 'open-new-tab', label: 'Search in New Tab' },
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
        { id: 'add-to-group', label: 'Add to Group…' },
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
        { id: 'rename', label: 'Rename…' },
        ...(browseStack.length && currentMode() === 'bookmarks'
          ? [
              { id: 'move-up', label: 'Move Up' },
              { id: 'move-down', label: 'Move Down' },
            ]
          : []),
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
      return [
        { id: 'insert', label: 'Insert' },
        { id: 'copy-text', label: 'Copy Emoji' },
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
    case 'download-open':
      await chrome.runtime.sendMessage({ type: 'download-open', downloadId: item.downloadId })
      closePalette()
      return
    case 'download-show':
      await chrome.runtime.sendMessage({ type: 'download-show', downloadId: item.downloadId })
      closePalette()
      return
    case 'add-to-group':
      closeActions()
      await enterGroup(item)
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
    case 'insert':
      closeActions()
      if (item.kind === 'emoji') recordUsage(item)
      insertOrCopy(item.kind === 'emoji' ? (item.emoji ?? '') : (item.text ?? ''))
      return
    case 'copy-text':
      copyText(item.kind === 'emoji' ? (item.emoji ?? '') : (item.text ?? item.label))
      closePalette()
      return
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
  void writeClipboard(text).then(() => showToast('Copied to clipboard'))
}

async function pickColor(): Promise<void> {
  const EyeDropperCtor = (
    window as unknown as { EyeDropper?: new () => { open(): Promise<{ sRGBHex: string }> } }
  ).EyeDropper
  if (!EyeDropperCtor) {
    showToast('Color picker not supported here')
    return
  }
  let hex: string
  try {
    const result = await new EyeDropperCtor().open()
    hex = result.sRGBHex.toUpperCase()
  } catch {
    // User pressed Esc — nothing to do.
    return
  }
  await writeClipboard(hex)
  showToast(`${hex} copied`, hex)
}

async function writeClipboard(text: string): Promise<void> {
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

/** Transient confirmation pill, bottom-center, outliving the palette. */
function showToast(message: string, swatch?: string): void {
  const host = document.createElement('div')
  host.style.cssText =
    'position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:2147483647;'
  const shadow = host.attachShadow({ mode: 'closed' })
  const style = document.createElement('style')
  style.textContent = `
    .toast {
      display: flex; align-items: center; gap: 8px;
      background: rgba(30, 30, 32, 0.92);
      backdrop-filter: blur(20px) saturate(1.6);
      -webkit-backdrop-filter: blur(20px) saturate(1.6);
      border: 1px solid rgba(255, 255, 255, 0.16);
      border-radius: 10px;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 8px 24px #00000088;
      color: #e8e8e8;
      font: 13px -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      padding: 9px 16px;
      opacity: 0;
      transition: opacity 0.15s ease;
    }
    .toast.show { opacity: 1; }
    @media (prefers-reduced-motion: reduce) { .toast { transition: none; } }
  `
  const pill = document.createElement('div')
  pill.className = 'toast'
  if (swatch) {
    const chip = document.createElement('span')
    chip.style.cssText = `width:14px;height:14px;border-radius:4px;border:1px solid #ffffff33;background:${swatch};`
    pill.appendChild(chip)
  } else {
    pill.innerHTML =
      '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 8.5l3.2 3.2L13 5" stroke="#7bc97b" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  }
  pill.appendChild(document.createTextNode(message))
  shadow.append(style, pill)
  document.documentElement.appendChild(host)
  requestAnimationFrame(() => pill.classList.add('show'))
  setTimeout(() => {
    pill.classList.remove('show')
    setTimeout(() => host.remove(), 200)
  }, 1800)
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

let groupsCache: Array<{ id: number; title: string; color?: string }> | null = null

async function enterGroup(item: RemoteItem): Promise<void> {
  if (!paletteInput) return
  uiState = 'group'
  subStateTarget = item
  savedQuery = paletteInput.value
  paletteInput.value = ''
  paletteInput.placeholder = `Add "${item.label}" to group…`
  paletteInput.focus()
  const response = (await chrome.runtime.sendMessage({ type: 'tab-groups' })) as {
    groups?: Array<{ id: number; title: string; color?: string }>
  }
  groupsCache = response?.groups ?? []
  void updateList()
}

async function commitGroup(groupItem: RemoteItem): Promise<void> {
  if (subStateTarget?.tabId !== undefined) {
    await chrome.runtime.sendMessage({
      type: 'tab-group-add',
      tabId: subStateTarget.tabId,
      groupId: groupItem.downloadId,
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

  if (uiState === 'group') {
    const query = paletteInput.value.trim().toLowerCase()
    const groups = (groupsCache ?? [])
      .filter((g) => !query || g.title.toLowerCase().includes(query))
      .map(
        (g): RemoteItem => ({
          kind: 'command',
          label: g.title,
          detail: '',
          groupColor: g.color,
          downloadId: g.id,
        }),
      )
    renderItems('Tab Groups', groups)
    return
  }

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
  const query = paletteInput.value.replace(/^[>@#:~]/, '')
  const browsing = mode === 'bookmarks' && browseStack.length > 0
  const folderId = browsing ? browseStack[browseStack.length - 1].id : undefined
  const response = (await chrome.runtime.sendMessage({
    type: 'palette-query',
    mode,
    query,
    folderId,
  })) as { items?: RemoteItem[] }
  if (token !== queryToken || uiState !== 'list' || !paletteList) return
  if (mode === 'emoji') {
    renderEmojiGrid(response?.items ?? [])
    return
  }
  const groupLabel = browsing
    ? browseStack[browseStack.length - 1].label
    : (GROUP_LABELS[mode] ?? 'Results')
  renderItems(groupLabel, response?.items ?? [])
}

function renderEmojiGrid(items: RemoteItem[]): void {
  if (!paletteList) return
  paletteList.textContent = ''
  selectorEl = null
  flatItems = items
  selectedIndex = 0
  if (!items.length) {
    const empty = document.createElement('div')
    empty.className = 'empty'
    empty.textContent = 'No results'
    paletteList.appendChild(empty)
    return
  }
  const label = document.createElement('div')
  label.className = 'group-label'
  label.textContent = 'Emoji'
  const grid = document.createElement('div')
  grid.className = 'emoji-grid'
  items.forEach((item, index) => {
    const cell = document.createElement('div')
    cell.className = 'emoji-cell'
    cell.title = item.label
    const glyph = document.createElement('span')
    glyph.className = 'glyph'
    glyph.textContent = item.emoji ?? ''
    const name = document.createElement('span')
    name.className = 'emoji-name'
    name.textContent = item.label
    cell.append(glyph, name)
    cell.addEventListener('mousedown', (e) => {
      e.preventDefault()
      void executeItem(item, e.metaKey || e.ctrlKey)
    })
    cell.addEventListener('mousemove', () => {
      if (selectedIndex !== index) {
        selectedIndex = index
        highlightSelection()
      }
    })
    grid.appendChild(cell)
  })
  paletteList.append(label, grid)
  highlightSelection(true)
}

function renderItems(groupLabel: string, items: RemoteItem[]): void {
  if (!paletteList) return
  paletteList.textContent = ''
  selectorEl = document.createElement('div')
  selectorEl.className = 'selector'
  paletteList.appendChild(selectorEl)
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
    row.append(iconFor(item), title, detail)
    if (item.groupColor) {
      const dot = document.createElement('span')
      dot.className = 'group-dot'
      dot.style.background = item.groupColor
      row.appendChild(dot)
    }
    row.appendChild(type)
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
  highlightSelection(true)
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
  if (kind === 'command' || kind === 'search') {
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
  if (kind === 'download') {
    if (item.color) icon.style.background = item.color
    icon.innerHTML = (item.icon && CMD_ICONS[item.icon]) || DOC_SVG
    return icon
  }
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
