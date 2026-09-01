async function togglePaletteIn(
  tabId: number | undefined,
  mode: 'bookmarks' | 'commands',
): Promise<void> {
  if (!tabId) return
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'toggle-palette', mode })
  } catch {
    // Content script isn't there (tab predates the extension, or injection was
    // missed) — inject on demand and retry.
    try {
      await chrome.scripting.executeScript({ target: { tabId }, files: ['palette.js'] })
      await chrome.tabs.sendMessage(tabId, { type: 'toggle-palette', mode })
    } catch {
      // Restricted page (chrome://, Web Store, PDF viewer) — open the popup
      // palette instead. The hash tells the popup which mode to start in.
      try {
        await chrome.action.setPopup({
          popup: mode === 'commands' ? 'popup.html#commands' : 'popup.html',
        })
        await chrome.action.openPopup()
      } catch {
        // openPopup needs a focused window; nothing more we can do.
      } finally {
        await chrome.action.setPopup({ popup: 'popup.html' })
      }
    }
  }
}

chrome.commands.onCommand.addListener(async (command) => {
  const mode =
    command === 'open-palette' ? 'commands' : command === 'quick-open' ? 'bookmarks' : null
  if (!mode) return
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  void togglePaletteIn(tab?.id, mode)
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
  { id: 'bookmark-tab', label: 'Bookmark Current Tab' },
  { id: 'new-tab', label: 'New Tab' },
  { id: 'duplicate-tab', label: 'Duplicate Tab' },
  { id: 'toggle-pin', label: 'Pin/Unpin Tab' },
  { id: 'split-tab', label: 'Split Tab Right' },
  { id: 'move-tab-new-window', label: 'Move Tab to New Window' },
  { id: 'close-tab', label: 'Close Tab' },
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

/* ---------- Ranking: fuzzy match blended with usage frecency ---------- */

interface PaletteItem {
  kind: 'bookmark' | 'tab' | 'history' | 'command' | 'closed' | 'folder'
  label: string
  detail: string
  url?: string
  id?: string
  tabId?: number
  commandId?: string
  sessionId?: string
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

/** Usage count decayed by a two-week half-life-ish curve. */
function frecency(usage: UsageMap, key: string): number {
  const entry = usage[key]
  if (!entry) return 0
  const days = (Date.now() - entry.t) / 86_400_000
  return entry.n * Math.exp(-days / 14)
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
): Array<T & { positions?: number[] }> {
  const scored: Array<{ item: T; score: number; index: number; positions: number[] }> = []
  entries.forEach((entry, index) => {
    const match = fuzzyMatch(query, entry.text)
    if (!match) return
    const boost = Math.min(30, frecency(usage, entry.usageKey) * 5)
    scored.push({ item: entry.item, score: match.score + boost, index, positions: match.positions })
  })
  scored.sort((a, b) => b.score - a.score || a.index - b.index)
  return scored.map((s) => (query ? { ...s.item, positions: s.positions } : s.item))
}

async function queryPalette(
  mode: string,
  rawQuery: string,
  sender: chrome.runtime.MessageSender,
  folderId?: string,
): Promise<PaletteItem[]> {
  const query = rawQuery.trim().toLowerCase()
  const usage = await getUsage()

  // Browsing inside one folder: its direct children, subfolders included.
  if (mode === 'bookmarks' && folderId) {
    const children = await chrome.bookmarks.getChildren(folderId)
    return rank(
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

  if (mode === 'commands') {
    return rank(
      PALETTE_COMMANDS.map((c) => ({
        item: { kind: 'command' as const, label: c.label, detail: '', commandId: c.id },
        text: c.label.toLowerCase(),
        usageKey: `command:${c.id}`,
      })),
      query,
      usage,
    )
  }

  if (mode === 'tabs') {
    const currentWindowId =
      sender.tab?.windowId ?? (await chrome.windows.getLastFocused()).id
    const tabs = await chrome.tabs.query({})
    const open = rank(
      tabs
        .filter((t) => t.id !== undefined)
        .map((t) => ({
          item: {
            kind: 'tab' as const,
            label: t.title || t.url || '',
            detail: t.windowId === currentWindowId ? '' : 'Other window',
            tabId: t.id,
            url: t.url ?? '',
            group: 'Open Tabs',
          },
          text: `${t.title} ${t.url}`.toLowerCase(),
          usageKey: `tab:${t.url}`,
        })),
      query,
      usage,
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
      detail: b.path,
      url: b.url,
      id: b.id,
    },
    text: `${b.title} ${b.url}`.toLowerCase(),
    usageKey: `bookmark:${b.url}`,
  }))
  const folderEntries = folders.map((f) => {
    const segments = f.path.split(' / ')
    return {
      item: {
        kind: 'folder' as const,
        label: segments[segments.length - 1],
        detail: segments.slice(0, -1).join(' / '),
        id: f.id,
      },
      text: segments[segments.length - 1].toLowerCase(),
      usageKey: `folder:${f.id}`,
    }
  })
  return rank([...bookmarkEntries, ...folderEntries], query, usage).slice(0, 50)
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
    case 'activate-tab':
      if (message.tabId !== undefined) {
        const tab = await chrome.tabs.update(message.tabId, { active: true })
        if (tab?.windowId !== undefined) await chrome.windows.update(tab.windowId, { focused: true })
      }
      return {}
    case 'restore-session':
      if (message.sessionId) await chrome.sessions.restore(message.sessionId)
      return {}
    case 'open-url': {
      const tab = await senderTab(sender)
      if (message.newTab || !tab?.id) await chrome.tabs.create({ url: message.url })
      else await chrome.tabs.update(tab.id, { url: message.url })
      return {}
    }
    case 'run-command':
      if (message.id) await runCommand(message.id, sender)
      return {}
  }
  return {}
}

async function runCommand(id: string, sender: chrome.runtime.MessageSender): Promise<void> {
  const pageUrl = PAGE_COMMANDS[id]
  if (pageUrl) {
    await chrome.tabs.create({ url: pageUrl })
    return
  }
  const tab = await senderTab(sender)
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
