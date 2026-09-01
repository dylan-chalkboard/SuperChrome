import { EMOJI } from './emoji-data'

type PaletteMode = 'bookmarks' | 'commands' | 'tabs' | 'history'

interface UserSettings {
  glassOpacity: number
  iconColors: { command: string; folder: string; history: string; fallback: string }
  frecencyDecayDays: number
  defaultMode: PaletteMode
  openInNewTab: boolean
  reduceMotion: boolean
  disabledSites: string[]
}

const DEFAULT_SETTINGS: UserSettings = {
  glassOpacity: 0.8,
  iconColors: { command: '#4c9df3', folder: '#e0a63c', history: '#9a6ee8', fallback: '#e05d5d' },
  frecencyDecayDays: 14,
  defaultMode: 'bookmarks',
  openInNewTab: false,
  reduceMotion: false,
  disabledSites: [],
}

async function getSettings(): Promise<UserSettings> {
  try {
    const { settings } = await chrome.storage.sync.get('settings')
    return {
      ...DEFAULT_SETTINGS,
      ...settings,
      iconColors: { ...DEFAULT_SETTINGS.iconColors, ...settings?.iconColors },
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

const MODE_HASH: Record<PaletteMode, string> = {
  bookmarks: '',
  commands: '#commands',
  tabs: '#tabs',
  history: '#history',
}

function hostOf(url: string | undefined): string | null {
  try {
    return url ? new URL(url).hostname.toLowerCase() : null
  } catch {
    return null
  }
}

async function togglePaletteIn(
  tab: chrome.tabs.Tab | undefined,
  mode: PaletteMode,
): Promise<void> {
  if (!tab?.id) return
  const settings = await getSettings()
  const host = hostOf(tab.url)
  const disabled =
    host !== null && settings.disabledSites.some((d) => host === d || host.endsWith(`.${d}`))

  if (!disabled) {
    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'toggle-palette', mode })
      return
    } catch {
      // Content script isn't there — inject on demand and retry.
    }
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['palette.js'] })
      await chrome.tabs.sendMessage(tab.id, { type: 'toggle-palette', mode })
      return
    } catch {
      // Restricted page (chrome://, Web Store, PDF viewer) — fall through.
    }
  }

  // Restricted page (chrome://, Web Store) or disabled site: open the palette
  // as a full extension page in a new tab — picking a result navigates it.
  await chrome.tabs.create({
    url: chrome.runtime.getURL(`popup.html?tab=1&src=${tab.id}${MODE_HASH[mode]}`),
    index: tab.index + 1,
  })
}

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'open-palette' && command !== 'quick-open') return
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  const mode = command === 'open-palette' ? 'commands' : (await getSettings()).defaultMode
  void togglePaletteIn(tab, mode)
})

/** Popup senders have no tab; fall back to the active tab of the current window. */
async function senderTab(
  sender: chrome.runtime.MessageSender,
): Promise<chrome.tabs.Tab | undefined> {
  if (sender.tab) return sender.tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  return tab
}

const PAGE_COMMANDS: Record<string, string> = {
  'open-settings': 'chrome://settings/',
  'open-settings-privacy': 'chrome://settings/privacy',
  'open-settings-appearance': 'chrome://settings/appearance',
  'open-settings-search': 'chrome://settings/searchEngines',
  'open-settings-autofill': 'chrome://settings/autofill',
  'open-settings-site': 'chrome://settings/content',
  'open-settings-languages': 'chrome://settings/languages',
  'open-settings-system': 'chrome://settings/system',
  'open-settings-reset': 'chrome://settings/reset',
  'open-clear-browsing-data': 'chrome://settings/clearBrowserData',
  'open-passwords': 'chrome://password-manager/passwords',
  'open-about-chrome': 'chrome://settings/help',
  'open-flags': 'chrome://flags/',
  'open-version': 'chrome://version/',
  'open-inspect-devices': 'chrome://inspect/',
  'open-webstore': 'https://chromewebstore.google.com/',
  'open-bookmarks-manager': 'chrome://bookmarks/',
  'open-history': 'chrome://history/',
  'open-downloads': 'chrome://downloads/',
  'open-extensions': 'chrome://extensions/',
  'open-shortcuts': 'chrome://extensions/shortcuts',
}

const PALETTE_COMMANDS = [
  { id: 'switch-to-tab', label: 'Switch to Tab…' },
  { id: 'open-options', label: 'SuperChrome: Settings' },
  { id: 'bookmark-tab', label: 'Bookmark Current Tab' },
  { id: 'pick-color', label: 'Pick Color' },
  { id: 'copy-page-url', label: 'Copy Page URL' },
  { id: 'copy-page-md', label: 'Copy Page as Markdown Link' },
  { id: 'new-tab', label: 'New Tab' },
  { id: 'duplicate-tab', label: 'Duplicate Tab' },
  { id: 'toggle-pin', label: 'Pin/Unpin Tab' },
  { id: 'split-tab', label: 'Split Tab Right' },
  { id: 'move-tab-new-window', label: 'Move Tab to New Window' },
  { id: 'close-tab', label: 'Close Tab' },
  { id: 'new-group-from-tab', label: 'New Tab Group from Tab' },
  { id: 'new-incognito-window', label: 'New Incognito Window' },
  { id: 'zoom-in', label: 'Zoom In' },
  { id: 'zoom-out', label: 'Zoom Out' },
  { id: 'zoom-reset', label: 'Zoom: Actual Size' },
  { id: 'toggle-fullscreen', label: 'Toggle Full Screen' },
  { id: 'merge-windows', label: 'Merge All Windows' },
  { id: 'toggle-bookmarks-bar', label: 'Toggle Bookmarks Bar' },
  { id: 'save-page', label: 'Save Page As…' },
  { id: 'find-in-page', label: 'Find in Page' },
  { id: 'task-manager', label: 'Open Task Manager' },
  { id: 'js-console', label: 'Developer: JavaScript Console' },
  { id: 'print-page', label: 'Print Page' },
  { id: 'open-devtools', label: 'Developer: Open DevTools' },
  { id: 'view-source', label: 'Developer: View Page Source' },
  { id: 'open-inspect-devices', label: 'Developer: Open chrome://inspect' },
  { id: 'open-settings', label: 'Settings: Open Chrome Settings' },
  { id: 'open-settings-privacy', label: 'Settings: Privacy and Security' },
  { id: 'open-settings-appearance', label: 'Settings: Appearance' },
  { id: 'open-settings-search', label: 'Settings: Search Engines' },
  { id: 'open-settings-autofill', label: 'Settings: Autofill' },
  { id: 'open-passwords', label: 'Settings: Password Manager' },
  { id: 'open-settings-site', label: 'Settings: Site Permissions' },
  { id: 'open-settings-languages', label: 'Settings: Languages' },
  { id: 'open-settings-system', label: 'Settings: System' },
  { id: 'open-clear-browsing-data', label: 'Settings: Clear Browsing Data' },
  { id: 'open-settings-reset', label: 'Settings: Reset Chrome' },
  { id: 'open-about-chrome', label: 'Settings: About Chrome (Update)' },
  { id: 'open-webstore', label: 'Open Chrome Web Store' },
  { id: 'open-bookmarks-manager', label: 'Open Bookmarks Manager' },
  { id: 'open-history', label: 'Open History' },
  { id: 'open-downloads', label: 'Open Downloads' },
  { id: 'open-extensions', label: 'Open Extensions' },
  { id: 'open-shortcuts', label: 'Open Keyboard Shortcuts' },
  { id: 'open-flags', label: 'Open Chrome Flags' },
  { id: 'open-version', label: 'Open Chrome Version' },
]


/** Per-command icon + tile color shown in the '>' list. */
const COMMAND_META: Record<string, { icon: string; color: string }> = {
  'switch-to-tab': { icon: 'switch', color: '#4c9df3' },
  'open-options': { icon: 'logo', color: '' },
  'bookmark-tab': { icon: 'bookmark', color: '#e05d5d' },
  'pick-color': { icon: 'paint', color: '#e57fb3' },
  'copy-page-url': { icon: 'link', color: '#4caf7d' },
  'copy-page-md': { icon: 'link', color: '#4caf7d' },
  'new-tab': { icon: 'tab', color: '#4c9df3' },
  'duplicate-tab': { icon: 'tab', color: '#4c9df3' },
  'toggle-pin': { icon: 'pin', color: '#4c9df3' },
  'split-tab': { icon: 'split', color: '#3ab5c6' },
  'move-tab-new-window': { icon: 'external', color: '#3ab5c6' },
  'close-tab': { icon: 'tab', color: '#e05d5d' },
  'new-group-from-tab': { icon: 'group', color: '#4c9df3' },
  'new-incognito-window': { icon: 'incognito', color: '#5a5f6b' },
  'zoom-in': { icon: 'zoom-in', color: '#3ab5c6' },
  'zoom-out': { icon: 'zoom-out', color: '#3ab5c6' },
  'zoom-reset': { icon: 'zoom', color: '#3ab5c6' },
  'toggle-fullscreen': { icon: 'fullscreen', color: '#3ab5c6' },
  'merge-windows': { icon: 'merge', color: '#3ab5c6' },
  'toggle-bookmarks-bar': { icon: 'bookmark', color: '#e05d5d' },
  'save-page': { icon: 'save', color: '#4caf7d' },
  'find-in-page': { icon: 'search', color: '#4caf7d' },
  'print-page': { icon: 'printer', color: '#4caf7d' },
  'task-manager': { icon: 'gauge', color: '#e8964a' },
  'js-console': { icon: 'code', color: '#9a6ee8' },
  'open-devtools': { icon: 'code', color: '#9a6ee8' },
  'view-source': { icon: 'code', color: '#9a6ee8' },
  'open-inspect-devices': { icon: 'code', color: '#9a6ee8' },
  'open-settings': { icon: 'gear', color: '#7d8a97' },
  'open-settings-privacy': { icon: 'shield', color: '#7d8a97' },
  'open-settings-appearance': { icon: 'paint', color: '#7d8a97' },
  'open-settings-search': { icon: 'search', color: '#7d8a97' },
  'open-settings-autofill': { icon: 'form', color: '#7d8a97' },
  'open-passwords': { icon: 'key', color: '#e8c341' },
  'open-settings-site': { icon: 'shield', color: '#7d8a97' },
  'open-settings-languages': { icon: 'globe', color: '#7d8a97' },
  'open-settings-system': { icon: 'gear', color: '#7d8a97' },
  'open-clear-browsing-data': { icon: 'trash', color: '#e8964a' },
  'open-settings-reset': { icon: 'reset', color: '#e8964a' },
  'open-about-chrome': { icon: 'info', color: '#7d8a97' },
  'open-webstore': { icon: 'bag', color: '#4caf7d' },
  'open-bookmarks-manager': { icon: 'bookmark', color: '#e05d5d' },
  'open-history': { icon: 'clock', color: '#9a6ee8' },
  'open-downloads': { icon: 'download', color: '#3aa99f' },
  'open-extensions': { icon: 'puzzle', color: '#e8964a' },
  'open-shortcuts': { icon: 'keyboard', color: '#7d8a97' },
  'open-flags': { icon: 'flag', color: '#e8964a' },
  'open-version': { icon: 'info', color: '#7d8a97' },
}

/* ---------- Ranking: fuzzy match blended with usage frecency ---------- */

interface PaletteItem {
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
  /** Overrides the mode's default group header in the results list. */
  group?: string
  /** Indices into the ranked text that matched the query, for highlighting. */
  positions?: number[]
}

type UsageMap = Record<string, { n: number; t: number }>

async function getUsage(): Promise<UsageMap> {
  try {
    const result = await chrome.storage.local.get('usage')
    return result.usage ?? {}
  } catch {
    return {}
  }
}

/** Usage count decayed over the configured number of days. */
function frecency(usage: UsageMap, key: string, decayDays: number): number {
  const entry = usage[key]
  if (!entry) return 0
  const days = (Date.now() - entry.t) / 86_400_000
  return entry.n * Math.exp(-days / decayDays)
}

function fuzzyMatch(
  query: string,
  text: string,
): { score: number; positions: number[] } | null {
  if (!query) return { score: 0, positions: [] }
  const positions: number[] = []
  let qi = 0
  let score = 0
  let streak = 0
  for (let ti = 0; ti < text.length && qi < query.length; ti++) {
    if (text[ti] === query[qi]) {
      streak++
      const wordStart = ti === 0 || ' /-_.:'.includes(text[ti - 1])
      score += 1 + streak * 2 + (wordStart ? 6 : 0)
      positions.push(ti)
      qi++
    } else {
      streak = 0
    }
  }
  return qi === query.length ? { score: score - text.length * 0.01, positions } : null
}

function rank<T extends object>(
  entries: Array<{ item: T; text: string; usageKey: string }>,
  query: string,
  usage: UsageMap,
  decayDays = DEFAULT_SETTINGS.frecencyDecayDays,
): Array<T & { positions?: number[] }> {
  const scored: Array<{ item: T; score: number; index: number; positions: number[] }> = []
  entries.forEach((entry, index) => {
    const match = fuzzyMatch(query, entry.text)
    if (!match) return
    const boost = Math.min(30, frecency(usage, entry.usageKey, decayDays) * 5)
    scored.push({ item: entry.item, score: match.score + boost, index, positions: match.positions })
  })
  scored.sort((a, b) => b.score - a.score || a.index - b.index)
  return scored.map((s) => (query ? { ...s.item, positions: s.positions } : s.item))
}

/* ---------- Inline calculator: safe recursive-descent parser, no eval ---------- */

function tryCalculate(raw: string): string | null {
  let expr = raw.trim().toLowerCase()
  if (expr.length < 2 || expr.length > 64) return null
  expr = expr
    .replace(/,/g, '')
    .replace(/\bof\b/g, '*')
    .replace(/(^|[\s\d)])x([\s\d(])/g, '$1*$2')
    .replace(/\bpi\b/g, String(Math.PI))
  if (!/^[\d\s+\-*/^().%e]+$/.test(expr)) return null
  if (!/[+\-*/^%]/.test(expr) || !/\d/.test(expr)) return null

  let pos = 0
  const peek = (): string => expr[pos] ?? ''
  const skip = (): void => {
    while (peek() === ' ') pos++
  }
  const primary = (): number => {
    skip()
    if (peek() === '(') {
      pos++
      const value = additive()
      skip()
      if (peek() !== ')') throw new Error('paren')
      pos++
      return value
    }
    const match = /^\d*\.?\d+(e[+-]?\d+)?/.exec(expr.slice(pos))
    if (!match) throw new Error('number')
    pos += match[0].length
    return Number(match[0])
  }
  const postfix = (): number => {
    let value = primary()
    skip()
    while (peek() === '%') {
      pos++
      value /= 100
      skip()
    }
    return value
  }
  const unary = (): number => {
    skip()
    if (peek() === '-') {
      pos++
      return -unary()
    }
    return postfix()
  }
  const power = (): number => {
    const base = unary()
    skip()
    if (peek() === '^') {
      pos++
      return base ** power()
    }
    return base
  }
  const multiplicative = (): number => {
    let value = power()
    skip()
    while (peek() === '*' || peek() === '/') {
      const op = expr[pos++]
      const rhs = power()
      value = op === '*' ? value * rhs : value / rhs
      skip()
    }
    return value
  }
  const additive = (): number => {
    let value = multiplicative()
    skip()
    while (peek() === '+' || peek() === '-') {
      const op = expr[pos++]
      const rhs = multiplicative()
      value = op === '+' ? value + rhs : value - rhs
      skip()
    }
    return value
  }

  try {
    const result = additive()
    skip()
    if (pos !== expr.length || !Number.isFinite(result)) return null
    return String(Number(result.toPrecision(12)))
  } catch {
    return null
  }
}

const GROUP_COLORS: Record<string, string> = {
  grey: '#8e8e93',
  blue: '#4c9df3',
  red: '#e05d5d',
  yellow: '#e8c341',
  green: '#4caf7d',
  pink: '#e57fb3',
  purple: '#9a6ee8',
  cyan: '#3ab5c6',
  orange: '#e8964a',
}

function ago(t: number): string {
  const s = Math.max(0, (Date.now() - t) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

const FILE_TYPES: Array<[RegExp, { icon: string; color: string }]> = [
  [/\.pdf$/i, { icon: 'doc', color: '#e05d5d' }],
  [/\.(png|jpe?g|gif|webp|svg|heic|bmp|ico)$/i, { icon: 'image', color: '#9a6ee8' }],
  [/\.(mp4|mov|mkv|webm|avi)$/i, { icon: 'film', color: '#e57fb3' }],
  [/\.(mp3|wav|flac|m4a|ogg|aiff)$/i, { icon: 'music', color: '#e8964a' }],
  [/\.(zip|tar|gz|rar|7z|tgz)$/i, { icon: 'archive', color: '#e8c341' }],
  [/\.(js|ts|tsx|jsx|py|json|html|css|sh|go|rs|java|rb)$/i, { icon: 'code', color: '#4c9df3' }],
  [/\.(docx?|txt|md|rtf|pages)$/i, { icon: 'doc', color: '#4c9df3' }],
  [/\.(xlsx?|csv|numbers)$/i, { icon: 'table', color: '#4caf7d' }],
  [/\.(dmg|pkg|app|exe|msi|deb)$/i, { icon: 'download', color: '#8e8e93' }],
]

function fileType(filename: string): { icon: string; color: string } {
  for (const [pattern, type] of FILE_TYPES) {
    if (pattern.test(filename)) return type
  }
  return { icon: 'doc', color: '#3aa99f' }
}

function basename(path: string): string {
  return path.split('/').pop() || path
}

function commandEntries(): Array<{
  item: PaletteItem
  text: string
  usageKey: string
}> {
  return PALETTE_COMMANDS.map((c) => ({
    item: {
      kind: 'command' as const,
      label: c.label,
      detail: '',
      commandId: c.id,
      icon: COMMAND_META[c.id]?.icon,
      color: COMMAND_META[c.id]?.color || undefined,
    },
    text: c.label.toLowerCase(),
    usageKey: `command:${c.id}`,
  }))
}

async function queryPalette(
  mode: string,
  rawQuery: string,
  sender: chrome.runtime.MessageSender,
  folderId?: string,
): Promise<PaletteItem[]> {
  const query = rawQuery.trim().toLowerCase()
  const usage = await getUsage()
  const decay = (await getSettings()).frecencyDecayDays

  if (mode === 'emoji') {
    return rank<PaletteItem>(
      EMOJI.map(([char, name]) => ({
        item: { kind: 'emoji' as const, label: name, detail: '', emoji: char },
        text: name,
        usageKey: `emoji:${char}`,
      })),
      query,
      usage,
      decay,
    ).slice(0, 50)
  }

  // Browsing inside one folder: its direct children, subfolders included.
  // Empty query shows the folder's true order (reordering depends on it);
  // frecency ranking only applies once the user types.
  if (mode === 'bookmarks' && folderId) {
    const children = await chrome.bookmarks.getChildren(folderId)
    if (!query) {
      return children.map((c): PaletteItem =>
        c.url
          ? { kind: 'bookmark', label: c.title || c.url, detail: '', url: c.url, id: c.id }
          : { kind: 'folder', label: c.title, detail: '', id: c.id },
      )
    }
    return rank<PaletteItem>(
      children.map((c) =>
        c.url
          ? {
              item: {
                kind: 'bookmark' as const,
                label: c.title || c.url,
                detail: '',
                url: c.url,
                id: c.id,
              },
              text: `${c.title} ${c.url}`.toLowerCase(),
              usageKey: `bookmark:${c.url}`,
            }
          : {
              item: { kind: 'folder' as const, label: c.title, detail: '', id: c.id },
              text: c.title.toLowerCase(),
              usageKey: `folder:${c.id}`,
            },
      ),
      query,
      usage,
      decay,
    )
  }

  if (mode === 'history') {
    const results = await chrome.history.search({
      text: rawQuery.trim(),
      maxResults: 50,
      startTime: 0,
    })
    return results
      .filter((r) => r.url)
      .map((r) => ({ kind: 'history' as const, label: r.title || r.url!, detail: '', url: r.url }))
  }

  if (mode === 'downloads') {
    const downloads = await chrome.downloads.search({
      orderBy: ['-startTime'],
      limit: 50,
      exists: true,
      state: 'complete',
    })
    return rank<PaletteItem>(
      downloads
        .filter((d) => d.filename)
        .map((d) => {
          const type = fileType(d.filename)
          return {
            item: {
              kind: 'download' as const,
              label: basename(d.filename),
              detail: ago(Date.parse(d.startTime)),
              downloadId: d.id,
              text: d.filename,
              icon: type.icon,
              color: type.color,
            },
            text: basename(d.filename).toLowerCase(),
            usageKey: `download:${d.id}`,
          }
        }),
      query,
      usage,
      decay,
    )
  }

  if (mode === 'commands') {
    return rank(commandEntries(), query, usage, decay)
  }

  if (mode === 'tabs') {
    const currentWindowId =
      sender.tab?.windowId ?? (await chrome.windows.getLastFocused()).id
    const [tabs, tabGroups] = await Promise.all([
      chrome.tabs.query({}),
      chrome.tabGroups.query({}),
    ])
    const groupsById = new Map(tabGroups.map((g) => [g.id, g]))
    const open = rank(
      tabs
        .filter((t) => t.id !== undefined)
        .map((t) => {
          const tabGroup = t.groupId !== undefined ? groupsById.get(t.groupId) : undefined
          const windowNote = t.windowId === currentWindowId ? '' : 'Other window'
          return {
            item: {
              kind: 'tab' as const,
              label: t.title || t.url || '',
              detail: tabGroup?.title
                ? `${tabGroup.title}${windowNote ? ` · ${windowNote}` : ''}`
                : windowNote,
              tabId: t.id,
              url: t.url ?? '',
              group: 'Open Tabs',
              groupColor: tabGroup ? GROUP_COLORS[tabGroup.color] : undefined,
              grouped: !!tabGroup,
            },
            text: `${t.title} ${t.url} ${tabGroup?.title ?? ''}`.toLowerCase(),
            usageKey: `tab:${t.url}`,
          }
        }),
      query,
      usage,
      decay,
    )
    const sessions = await chrome.sessions.getRecentlyClosed({ maxResults: 10 })
    const closed = rank(
      sessions
        .filter((s) => s.tab?.sessionId && s.tab.url)
        .map((s) => ({
          item: {
            kind: 'closed' as const,
            label: s.tab!.title || s.tab!.url!,
            detail: '',
            url: s.tab!.url,
            sessionId: s.tab!.sessionId,
            group: 'Recently Closed',
          },
          text: `${s.tab!.title} ${s.tab!.url}`.toLowerCase(),
          usageKey: `closed:${s.tab!.url}`,
        })),
      query,
      usage,
      decay,
    )
    return [...open, ...closed]
  }

  const [root] = await chrome.bookmarks.getTree()
  const flat: Array<{ id: string; title: string; url: string; path: string }> = []
  const folders: Array<{ id: string; path: string }> = []
  for (const child of root.children ?? []) {
    collectBookmarks(child, [], flat)
    folders.push({ id: child.id, path: child.title })
    collectFolders(child, [child.title], folders)
  }
  const bookmarkEntries = flat.map((b) => ({
    item: {
      kind: 'bookmark' as const,
      label: b.title,
      detail: b.path ? `in ${b.path}` : '',
      url: b.url,
      id: b.id,
    },
    text: `${b.title} ${b.url}`.toLowerCase(),
    usageKey: `bookmark:${b.url}`,
  }))
  const folderEntries = folders.map((f) => {
    const segments = f.path.split(' / ')
    const parent = segments.slice(0, -1).join(' / ')
    return {
      item: {
        kind: 'folder' as const,
        label: segments[segments.length - 1],
        detail: parent ? `in ${parent}` : '',
        id: f.id,
      },
      text: segments[segments.length - 1].toLowerCase(),
      usageKey: `folder:${f.id}`,
    }
  })
  const commands = commandEntries()

  if (!query) {
    // Raycast-style home view: frecency picks up top, then the library with
    // folders first, then the most-used commands ('>' still shows them all).
    const all = [...bookmarkEntries, ...folderEntries, ...commands]
    const suggested = all
      .map((entry) => ({ entry, score: frecency(usage, entry.usageKey, decay) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
    const suggestedKeys = new Set(suggested.map((x) => x.entry.usageKey))
    const allCommands = commands
      .filter((entry) => !suggestedKeys.has(entry.usageKey))
      .map((entry, index) => ({
        entry,
        index,
        score: frecency(usage, entry.usageKey, decay),
      }))
      .sort((a, b) => b.score - a.score || a.index - b.index)
    // Bookmarks section mirrors the bookmarks bar: its top level, folders
    // first, plus the other root folders — drill in for everything else.
    const bar = root.children?.[0]
    const topLevel: Array<{ item: PaletteItem; usageKey: string }> = []
    for (const child of bar?.children ?? []) {
      topLevel.push(
        child.url
          ? {
              item: {
                kind: 'bookmark',
                label: child.title || child.url,
                detail: '',
                url: child.url,
                id: child.id,
              },
              usageKey: `bookmark:${child.url}`,
            }
          : {
              item: { kind: 'folder', label: child.title, detail: '', id: child.id },
              usageKey: `folder:${child.id}`,
            },
      )
    }
    for (const other of root.children?.slice(1) ?? []) {
      if (other.children?.length) {
        topLevel.push({
          item: { kind: 'folder', label: other.title, detail: '', id: other.id },
          usageKey: `folder:${other.id}`,
        })
      }
    }
    const visibleTop = topLevel.filter((entry) => !suggestedKeys.has(entry.usageKey))
    return [
      ...suggested.map((x): PaletteItem => ({ ...x.entry.item, group: 'Suggested' })),
      ...[
        ...visibleTop.filter((e) => e.item.kind === 'folder'),
        ...visibleTop.filter((e) => e.item.kind === 'bookmark'),
      ].map((entry): PaletteItem => ({ ...entry.item, group: 'Bookmarks' })),
      ...allCommands.map((x): PaletteItem => ({ ...x.entry.item, group: 'Commands' })),
    ]
  }

  const results = rank<PaletteItem>(
    [...bookmarkEntries, ...folderEntries, ...commands],
    query,
    usage,
    decay,
  ).slice(0, 50)
  const calc = tryCalculate(rawQuery)
  if (calc !== null) {
    results.unshift({
      kind: 'calc',
      label: calc,
      detail: `${rawQuery.trim()} =`,
      text: calc,
      group: 'Calculator',
    })
  }
  // No query ever dead-ends: web search rides at the bottom of every result
  // set, and is the only row when nothing matches.
  const trimmed = rawQuery.trim()
  results.push({
    kind: 'search',
    label: `Search Google for “${trimmed}”`,
    detail: '',
    url: `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`,
    icon: 'search',
    color: '#4c9df3',
    group: 'Search',
  })
  return results
}

function collectBookmarks(
  node: chrome.bookmarks.BookmarkTreeNode,
  path: string[],
  out: Array<{ id: string; title: string; url: string; path: string }>,
): void {
  for (const child of node.children ?? []) {
    if (child.url) {
      out.push({
        id: child.id,
        title: child.title || child.url,
        url: child.url,
        path: path.join(' / '),
      })
    } else {
      collectBookmarks(child, [...path, child.title], out)
    }
  }
}

function collectFolders(
  node: chrome.bookmarks.BookmarkTreeNode,
  path: string[],
  out: Array<{ id: string; path: string }>,
): void {
  for (const child of node.children ?? []) {
    if (child.url) continue
    const childPath = [...path, child.title]
    out.push({ id: child.id, path: childPath.join(' / ') })
    collectFolders(child, childPath, out)
  }
}

/* ---------- Message handling ---------- */

interface Message {
  type?: string
  url?: string
  newTab?: boolean
  id?: string
  tabId?: number
  mode?: string
  query?: string
  key?: string
  title?: string
  parentId?: string
  sessionId?: string
  folderId?: string
  text?: string
  groupId?: number
  downloadId?: number
  delta?: number
  srcTabId?: number
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then(sendResponse)
    .catch((err) => sendResponse({ error: String(err) }))
  return true
})

async function handleMessage(
  message: Message,
  sender: chrome.runtime.MessageSender,
): Promise<unknown> {
  switch (message?.type) {
    case 'palette-query':
      return {
        items: await queryPalette(
          message.mode ?? 'bookmarks',
          message.query ?? '',
          sender,
          message.folderId,
        ),
      }
    case 'record-usage': {
      if (!message.key) return {}
      const usage = await getUsage()
      const entry = usage[message.key]
      usage[message.key] = { n: (entry?.n ?? 0) + 1, t: Date.now() }
      await chrome.storage.local.set({ usage }).catch(() => {})
      return {}
    }
    case 'folders': {
      const [root] = await chrome.bookmarks.getTree()
      const folders: Array<{ id: string; path: string }> = []
      for (const child of root.children ?? []) {
        folders.push({ id: child.id, path: child.title })
        collectFolders(child, [child.title], folders)
      }
      return { folders }
    }
    case 'bookmark-rename':
      if (message.id && message.title) await chrome.bookmarks.update(message.id, { title: message.title })
      return {}
    case 'bookmark-move':
      if (message.id && message.parentId) {
        await chrome.bookmarks.move(message.id, { parentId: message.parentId })
      }
      return {}
    case 'bookmark-delete':
      if (message.id) await chrome.bookmarks.remove(message.id)
      return {}
    case 'bookmark-reorder': {
      if (!message.id) return {}
      const [node] = await chrome.bookmarks.get(message.id)
      if (!node?.parentId) return {}
      const siblings = await chrome.bookmarks.getChildren(node.parentId)
      const pos = siblings.findIndex((s) => s.id === node.id)
      const target = pos + (message.delta ?? 0)
      if (pos < 0 || target < 0 || target >= siblings.length) return {}
      // Chrome interprets the index against the pre-move list.
      await chrome.bookmarks.move(node.id, { index: target > pos ? target + 1 : target })
      return {}
    }
    case 'folder-delete':
      if (message.id) await chrome.bookmarks.removeTree(message.id)
      return {}
    case 'open-folder-tabs': {
      if (!message.id) return {}
      const children = await chrome.bookmarks.getChildren(message.id)
      for (const child of children) {
        if (child.url) await chrome.tabs.create({ url: child.url, active: false })
      }
      return {}
    }
    case 'history-delete':
      if (message.url) await chrome.history.deleteUrl({ url: message.url })
      return {}
    case 'close-tab-id':
      if (message.tabId !== undefined) await chrome.tabs.remove(message.tabId)
      return {}
    case 'close-me':
      if (sender.tab?.id) await chrome.tabs.remove(sender.tab.id).catch(() => {})
      return {}
    case 'activate-tab':
      if (message.tabId !== undefined) {
        const tab = await chrome.tabs.update(message.tabId, { active: true })
        if (tab?.windowId !== undefined) await chrome.windows.update(tab.windowId, { focused: true })
      }
      return {}
    case 'tab-groups': {
      const groups = await chrome.tabGroups.query({})
      return {
        groups: groups.map((g) => ({
          id: g.id,
          title: g.title || 'Untitled group',
          color: GROUP_COLORS[g.color],
        })),
      }
    }
    case 'tab-group-add':
      if (message.tabId !== undefined && message.groupId !== undefined) {
        await chrome.tabs.group({ tabIds: [message.tabId], groupId: message.groupId })
      }
      return {}
    case 'tab-ungroup':
      if (message.tabId !== undefined) await chrome.tabs.ungroup([message.tabId])
      return {}
    case 'download-open': {
      if (message.downloadId === undefined) return {}
      try {
        await chrome.downloads.open(message.downloadId)
      } catch {
        await chrome.downloads.show(message.downloadId)
      }
      return {}
    }
    case 'download-show':
      if (message.downloadId !== undefined) await chrome.downloads.show(message.downloadId)
      return {}
    case 'restore-session':
      if (message.sessionId) await chrome.sessions.restore(message.sessionId)
      return {}
    case 'open-url': {
      const tab = await senderTab(sender)
      // The setting inverts Enter vs Cmd+Enter: XOR keeps both reachable.
      const newTab = (message.newTab ?? false) !== (await getSettings()).openInNewTab
      if (newTab || !tab?.id) await chrome.tabs.create({ url: message.url })
      else await chrome.tabs.update(tab.id, { url: message.url })
      // Tab-mode palette needs to know whether its own tab is now navigating.
      return { newTab: newTab || !tab?.id }
    }
    case 'run-command':
      if (message.id) await runCommand(message.id, sender)
      return {}
  }
  return {}
}

async function runCommand(
  id: string,
  sender: chrome.runtime.MessageSender,
  srcTabId?: number,
): Promise<void> {
  const pageUrl = PAGE_COMMANDS[id]
  if (pageUrl) {
    await chrome.tabs.create({ url: pageUrl })
    return
  }
  // Tab-mode palette pages pass the tab they were opened from; tab-scoped
  // commands must act on that tab, not the palette page itself.
  const tab = srcTabId
    ? await chrome.tabs.get(srcTabId).catch(() => senderTab(sender))
    : await senderTab(sender)
  switch (id) {
    case 'new-tab':
      await chrome.tabs.create({})
      break
    case 'close-tab':
      if (tab?.id) await chrome.tabs.remove(tab.id)
      break
    case 'duplicate-tab':
      if (tab?.id) await chrome.tabs.duplicate(tab.id)
      break
    case 'toggle-pin':
      if (tab?.id) await chrome.tabs.update(tab.id, { pinned: !tab.pinned })
      break
    case 'bookmark-tab':
      if (tab?.url) {
        await chrome.bookmarks.create({ parentId: '1', title: tab.title ?? tab.url, url: tab.url })
      }
      break
    case 'view-source':
      if (tab?.url) await chrome.tabs.create({ url: `view-source:${tab.url}` })
      break
    case 'split-tab': {
      // Chrome's native Split View has no creation API (extensions can only
      // detect splits), so tile two windows across the current window's bounds.
      if (!tab?.id || tab.windowId === undefined) break
      const win = await chrome.windows.get(tab.windowId, { populate: true })
      const left = win.left ?? 0
      const top = win.top ?? 0
      const width = win.width ?? 1200
      const height = win.height ?? 800
      const half = Math.floor(width / 2)
      await chrome.windows.update(tab.windowId, {
        state: 'normal',
        left,
        top,
        width: half,
        height,
      })
      if ((win.tabs?.length ?? 0) > 1) {
        await chrome.windows.create({
          tabId: tab.id,
          left: left + half,
          top,
          width: width - half,
          height,
          focused: true,
        })
      } else {
        // Lone tab: moving it would close the window; open a fresh one instead.
        await chrome.windows.create({
          left: left + half,
          top,
          width: width - half,
          height,
          focused: true,
        })
      }
      break
    }
    case 'move-tab-new-window':
      if (tab?.id) await chrome.windows.create({ tabId: tab.id, focused: true })
      break
    case 'open-options':
      await chrome.runtime.openOptionsPage()
      break
    case 'new-group-from-tab':
      if (tab?.id) await chrome.tabs.group({ tabIds: [tab.id] })
      break
    case 'new-incognito-window':
      try {
        await chrome.windows.create({ incognito: true, focused: true })
      } catch {
        // Incognito access not granted — let the native host press Cmd+Shift+N.
        await chrome.runtime
          .sendNativeMessage('com.superchrome.host', { action: 'new-incognito' })
          .catch(() => {})
      }
      break
    case 'zoom-in':
    case 'zoom-out':
    case 'zoom-reset': {
      if (!tab?.id) break
      if (id === 'zoom-reset') {
        await chrome.tabs.setZoom(tab.id, 0)
      } else {
        const zoom = await chrome.tabs.getZoom(tab.id)
        await chrome.tabs.setZoom(tab.id, id === 'zoom-in' ? zoom * 1.25 : zoom / 1.25)
      }
      break
    }
    case 'toggle-fullscreen': {
      if (tab?.windowId === undefined) break
      const win = await chrome.windows.get(tab.windowId)
      await chrome.windows.update(tab.windowId, {
        state: win.state === 'fullscreen' ? 'normal' : 'fullscreen',
      })
      break
    }
    case 'merge-windows': {
      if (tab?.windowId === undefined) break
      const all = await chrome.tabs.query({})
      const movers = all.filter((t) => t.windowId !== tab.windowId && t.id !== undefined)
      for (const t of movers) {
        await chrome.tabs.move(t.id!, { windowId: tab.windowId, index: -1 })
        if (t.pinned) await chrome.tabs.update(t.id!, { pinned: true })
      }
      break
    }
    case 'toggle-bookmarks-bar':
    case 'save-page':
    case 'find-in-page':
      await chrome.runtime
        .sendNativeMessage('com.superchrome.host', { action: 'keystroke', name: id })
        .catch(() => {})
      break
    case 'task-manager':
      await chrome.runtime
        .sendNativeMessage('com.superchrome.host', {
          action: 'click-menu',
          path: ['Window', 'Task Manager'],
        })
        .catch(() => {})
      break
    case 'js-console':
      await chrome.runtime
        .sendNativeMessage('com.superchrome.host', {
          action: 'click-menu',
          path: ['View', 'Developer', 'JavaScript Console'],
        })
        .catch(() => {})
      break
    case 'open-devtools':
      // Extensions can't open DevTools; the native host (native-host/) presses
      // Cmd+Opt+I via macOS. Falls back to chrome://inspect without it.
      try {
        await chrome.runtime.sendNativeMessage('com.superchrome.host', { action: 'open-devtools' })
      } catch {
        await chrome.tabs.create({ url: 'chrome://inspect/' })
      }
      break
  }
}

/* Omnibox: type "b" + Tab, then search bookmarks from the address bar. */

chrome.omnibox.setDefaultSuggestion({ description: 'Search bookmarks' })

chrome.omnibox.onInputChanged.addListener(async (text, suggest) => {
  if (!text.trim()) {
    suggest([])
    return
  }
  const results = await chrome.bookmarks.search(text)
  suggest(
    results
      .filter((r) => r.url)
      .slice(0, 8)
      .map((r) => ({
        content: r.url!,
        description: `${escapeXml(r.title || r.url!)} <url>${escapeXml(r.url!)}</url>`,
      })),
  )
})

chrome.omnibox.onInputEntered.addListener(async (text, disposition) => {
  let url = text
  if (!/^\w+:\/\//.test(url)) {
    const results = await chrome.bookmarks.search(text)
    url =
      results.find((r) => r.url)?.url ??
      `https://www.google.com/search?q=${encodeURIComponent(text)}`
  }
  if (disposition === 'currentTab') void chrome.tabs.update({ url })
  else void chrome.tabs.create({ url, active: disposition === 'newForegroundTab' })
})

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
