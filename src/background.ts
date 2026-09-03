import { getSettings } from './core/settings'
import { getUsage, recordUsage } from './core/usage'
import type { PaletteItem, PaletteMode } from './core/types'
import { collectFolders } from './features/bookmarks'
import { decideSaveState, foldersFirst, resolveInbox } from './features/bookmarks/library'
import { browseBookmarkFolder, searchBookmarks, searchLibrary } from './features/bookmarks/search'
import { commandEntries, runCommand, senderTab } from './features/commands'
import { searchDownloads } from './features/downloads/search'
import { searchEmoji } from './features/emoji/search'
import { searchHistory } from './features/history/search'
import { hostOf } from './features/navigation'
import { rank } from './features/ranking'
import { searchSnippets } from './features/snippets/search'
import { GROUP_COLORS, searchTabs } from './features/tabs/search'

async function togglePaletteIn(
  tab: chrome.tabs.Tab | undefined,
  mode: PaletteMode,
): Promise<void> {
  if (!tab?.id) return
  const settings = await getSettings()
  const host = hostOf(tab.url)
  const disabled =
    host !== null && settings.disabledSites.some((d) => host === d || host.endsWith(`.${d}`))

  if (disabled) return
  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'toggle-palette', mode })
    return
  } catch {
    // Content script isn't there — inject on demand and retry.
  }
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['palette.js'] })
    await chrome.tabs.sendMessage(tab.id, { type: 'toggle-palette', mode })
  } catch {
    // Restricted page (chrome://, Web Store, PDF viewer) — the palette can't
    // run here; the omnibox "b" keyword still covers bookmark search.
  }
}

chrome.action.onClicked.addListener((tab) => {
  void getSettings().then((settings) => togglePaletteIn(tab, settings.defaultMode))
})

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'quick-open') return
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  void togglePaletteIn(tab, (await getSettings()).defaultMode)
})

/* ---------- Palette queries: thin dispatcher over per-mode searches ---------- */

async function queryPalette(
  mode: string,
  rawQuery: string,
  sender: chrome.runtime.MessageSender,
  folderId?: string,
): Promise<PaletteItem[]> {
  const query = rawQuery.trim().toLowerCase()
  const usage = await getUsage()
  const settings = await getSettings()
  const decay = settings.frecencyDecayDays

  if (mode === 'emoji') return searchEmoji(query, usage, decay)
  if (mode === 'bookmarks' && folderId) return browseBookmarkFolder(folderId, query, usage, decay)
  if (mode === 'snippets') return searchSnippets(query, usage, decay, settings.snippets)
  if (mode === 'history') return searchHistory(rawQuery)
  if (mode === 'downloads') return searchDownloads(query, usage, decay)
  // Browsing '>' keeps the curated order (related commands stay together);
  // typing ranks by fuzzy match blended with usage.
  if (mode === 'commands') {
    return query
      ? rank(commandEntries(), query, usage, decay)
      : commandEntries().map((entry) => entry.item)
  }
  if (mode === 'tabs') return searchTabs(query, usage, decay, sender)
  if (mode === 'library') return searchLibrary(rawQuery, usage, decay)
  return searchBookmarks(rawQuery, usage, decay, settings)
}

/* ---------- Library (bookmarks section) helpers ---------- */

interface LibraryChild {
  id: string
  title: string
  url?: string
  dateAdded?: number
  /** Direct child count, folders only. */
  count?: number
  /** Source root's name at the library root (Bookmarks Bar, Other Bookmarks). */
  group?: string
}

function libraryChild(node: chrome.bookmarks.BookmarkTreeNode): LibraryChild {
  return {
    id: node.id,
    title: node.title || node.url || '',
    url: node.url,
    dateAdded: node.dateAdded,
    count: node.url ? undefined : (node.children?.length ?? 0),
  }
}

/**
 * One level of the library view. The root merges the children of every
 * top-level root (Bookmarks Bar, Other Bookmarks, …) into one list, folders
 * first; a folder id returns its children plus the breadcrumb path down to
 * it (top-level roots excluded — the merged root stands in for them).
 */
async function libraryList(
  folderId?: string,
): Promise<{ items: LibraryChild[]; path: Array<{ id: string; label: string }> }> {
  if (!folderId) {
    // Root: each real root becomes its own labeled section, folders first
    // within each, Bookmarks Bar sections on top. Chrome may split the tree
    // into local AND account-synced roots (account bookmark storage), so
    // roots are discovered by folderType rather than assumed at depth 1,
    // and empty duplicates (e.g. the unused local roots) are dropped.
    const [root] = await chrome.bookmarks.getTree()
    const sections: chrome.bookmarks.BookmarkTreeNode[] = []
    const visit = (node: chrome.bookmarks.BookmarkTreeNode): void => {
      if (!node.children) return
      if (folderTypeOf(node)) {
        sections.push(node)
        return
      }
      for (const child of node.children) visit(child)
    }
    for (const child of root.children ?? []) visit(child)
    if (!sections.length) sections.push(...(root.children ?? []))
    const populated = sections.filter((s) => s.children?.length)
    const shown = populated.length ? populated : sections
    shown.sort((a, b) => barRank(a) - barRank(b))
    const items: LibraryChild[] = []
    for (const top of shown) {
      const kids = foldersFirst((top.children ?? []).map(libraryChild))
      for (const child of kids) items.push({ ...child, group: top.title })
    }
    return { items, path: [] }
  }
  const [folder] = await chrome.bookmarks.getSubTree(folderId)
  const items = foldersFirst((folder.children ?? []).map(libraryChild))
  const path: Array<{ id: string; label: string }> = []
  let node: chrome.bookmarks.BookmarkTreeNode | undefined = folder
  while (node?.parentId && node.parentId !== '0') {
    path.unshift({ id: node.id, label: node.title })
    ;[node] = await chrome.bookmarks.get(node.parentId)
  }
  return { items, path }
}

/** URL equality for switch-instead-of-reopen: ignores hash and trailing slash. */
function sameUrl(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false
  const norm = (u: string): string => {
    try {
      const url = new URL(u)
      url.hash = ''
      return url.href.replace(/\/$/, '')
    } catch {
      return u
    }
  }
  return norm(a) === norm(b)
}

/** folderType shipped in Chrome 134; older trees just report undefined. */
function folderTypeOf(node: chrome.bookmarks.BookmarkTreeNode): string | undefined {
  return (node as { folderType?: string }).folderType
}

function barRank(node: chrome.bookmarks.BookmarkTreeNode): number {
  return folderTypeOf(node) === 'bookmarks-bar' || node.id === '1' ? 0 : 1
}

/**
 * The "Other Bookmarks" root — preferring the account-synced one (where the
 * user's real tree lives under account bookmark storage), then any populated
 * one, then the classic id-'2' local root.
 */
async function otherBookmarksNode(): Promise<chrome.bookmarks.BookmarkTreeNode | undefined> {
  const [root] = await chrome.bookmarks.getTree()
  const others: chrome.bookmarks.BookmarkTreeNode[] = []
  const visit = (node: chrome.bookmarks.BookmarkTreeNode): void => {
    if (!node.children) return
    if (folderTypeOf(node) === 'other') {
      others.push(node)
      return
    }
    for (const child of node.children) visit(child)
  }
  for (const child of root.children ?? []) visit(child)
  const syncing = others.find((o) => (o as { syncing?: boolean }).syncing)
  const populated = others.find((o) => o.children?.length)
  const children = root.children ?? []
  return (
    syncing ?? populated ?? others[0] ?? children.find((c) => c.id === '2') ?? children[1] ?? children[0]
  )
}

/** Folder path of a node's ancestors, top-level roots included, for display. */
async function folderPathOf(parentId: string | undefined): Promise<string> {
  const titles: string[] = []
  let id = parentId
  while (id && id !== '0') {
    const [node] = await chrome.bookmarks.get(id)
    if (!node) break
    if (node.title) titles.unshift(node.title)
    id = node.parentId
  }
  return titles.join(' / ')
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
  color?: string
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
      await recordUsage(message.key)
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
    case 'library-list':
      return libraryList(message.folderId)
    case 'bookmark-create': {
      if (!message.url) return {}
      const node = await chrome.bookmarks.create({
        parentId: message.parentId,
        title: message.title || message.url,
        url: message.url,
      })
      return { id: node.id }
    }
    case 'folder-create': {
      if (!message.title) return {}
      // Folders created from the save flow (Inbox, "Create folder …") land
      // under Other Bookmarks unless a parent is given.
      const parentId = message.parentId ?? (await otherBookmarksNode())?.id
      const node = await chrome.bookmarks.create({ parentId, title: message.title })
      return { id: node.id }
    }
    case 'bookmark-find-url': {
      if (!message.url) return { match: null }
      const results = await chrome.bookmarks.search({ url: message.url })
      const decision = decideSaveState(message.url, results)
      if (decision.state === 'new') return { match: null }
      const match = decision.match
      return {
        match: { id: match.id, title: match.title, url: match.url, parentId: match.parentId },
        folderPath: await folderPathOf(match.parentId),
      }
    }
    case 'hotkey-info': {
      const cmds = await chrome.commands.getAll()
      return { shortcut: cmds.find((c) => c.name === 'quick-open')?.shortcut ?? '' }
    }
    case 'inbox-info': {
      const other = await otherBookmarksNode()
      const children = other ? await chrome.bookmarks.getChildren(other.id) : []
      const inbox = resolveInbox(children)
      if (!inbox) return { folderId: null, count: 0 }
      const items = await chrome.bookmarks.getChildren(inbox.id)
      return { folderId: inbox.id, count: items.length }
    }
    case 'open-url-background':
      if (message.url) await chrome.tabs.create({ url: message.url, active: false })
      return {}
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
      const [folder] = await chrome.bookmarks.get(message.id)
      const children = await chrome.bookmarks.getChildren(message.id)
      const tabIds: number[] = []
      for (const child of children) {
        if (!child.url) continue
        const tab = await chrome.tabs.create({ url: child.url, active: false })
        if (tab.id !== undefined) tabIds.push(tab.id)
      }
      // The batch lands as a tab group named after the folder.
      if (tabIds.length) {
        const groupId = await chrome.tabs.group({ tabIds })
        await chrome.tabGroups.update(groupId, { title: folder?.title || 'Folder' })
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
      // Without a groupId, chrome.tabs.group creates a new group.
      if (message.tabId !== undefined) {
        await chrome.tabs.group({
          tabIds: [message.tabId],
          ...(message.groupId !== undefined ? { groupId: message.groupId } : {}),
        })
      }
      return {}
    case 'tile-tab': {
      if (message.tabId === undefined) return {}
      const anchor = await senderTab(sender)
      let target = await chrome.tabs.get(message.tabId).catch(() => undefined)
      if (!target || anchor?.windowId === undefined) return {}
      if (target.id === anchor.id) return {}
      // Confirm the companion host exists before touching any tabs — without
      // it there's nothing useful to do and the move would just confuse.
      const present = await chrome.runtime
        .sendNativeMessage('com.superchrome.host', { action: 'ping' })
        .then(() => true)
        .catch(() => false)
      if (!present) return { native: false }
      // Park the target right after the anchor tab, then press Chrome's own
      // split-view shortcut (⌘⌥N) via the host.
      if (target.id !== undefined && anchor.id !== undefined && anchor.index !== undefined) {
        await chrome.tabs
          .move(target.id, { windowId: anchor.windowId, index: anchor.index + 1 })
          .catch(() => {})
        target = (await chrome.tabs.get(target.id).catch(() => undefined)) ?? target
        await chrome.tabs.update(anchor.id, { active: true }).catch(() => {})
      }
      const native = (await chrome.runtime
        .sendNativeMessage('com.superchrome.host', { action: 'keystroke', name: 'split-view' })
        .catch(() => null)) as { ok?: boolean; error?: string } | null
      if (native?.error) console.warn('split-view failed:', native.error)
      return { native: native?.ok === true }
    }
    case 'tab-group-update':
      if (message.groupId !== undefined) {
        await chrome.tabGroups.update(message.groupId, {
          ...(message.title !== undefined ? { title: message.title } : {}),
          ...(message.color ? { color: message.color as chrome.tabGroups.ColorEnum } : {}),
        })
      }
      return {}
    case 'tab-group-dissolve': {
      if (message.groupId === undefined) return {}
      const grouped = await chrome.tabs.query({ groupId: message.groupId })
      const ids = grouped.map((t) => t.id).filter((x): x is number => x !== undefined)
      if (ids.length) await chrome.tabs.ungroup(ids)
      return {}
    }
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
      // Plain open switches to an already-open tab instead of duplicating it;
      // the Cmd+Enter variant stays an escape hatch that really opens anew.
      if (!newTab && message.url) {
        const existing = (await chrome.tabs.query({})).find(
          (t) => t.id !== undefined && t.id !== tab?.id && sameUrl(t.url, message.url),
        )
        if (existing?.id !== undefined) {
          await chrome.tabs.update(existing.id, { active: true })
          if (existing.windowId !== undefined) {
            await chrome.windows.update(existing.windowId, { focused: true })
          }
          return { newTab: false, switched: true }
        }
      }
      if (newTab || !tab?.id) await chrome.tabs.create({ url: message.url })
      else await chrome.tabs.update(tab.id, { url: message.url })
      // Tab-mode palette needs to know whether its own tab is now navigating.
      return { newTab: newTab || !tab?.id }
    }
    case 'close-duplicates': {
      const tabs = await chrome.tabs.query({})
      const seen = new Map<string, chrome.tabs.Tab>()
      const toClose: number[] = []
      for (const tab of tabs) {
        if (!tab.url || tab.id === undefined || tab.pinned) continue
        const key = tab.url
        const kept = seen.get(key)
        if (!kept) {
          seen.set(key, tab)
        } else if (tab.active && !kept.active) {
          // Keep the active one; close the earlier keeper.
          if (kept.id !== undefined) toClose.push(kept.id)
          seen.set(key, tab)
        } else {
          toClose.push(tab.id)
        }
      }
      if (toClose.length) await chrome.tabs.remove(toClose).catch(() => {})
      return { closed: toClose.length }
    }
    case 'screenshot': {
      try {
        const dataUrl = await chrome.tabs.captureVisibleTab(
          sender.tab?.windowId ?? chrome.windows.WINDOW_ID_CURRENT,
          { format: 'png' },
        )
        return { ok: true, dataUrl }
      } catch {
        return { ok: false }
      }
    }
    case 'fetch-image': {
      if (!message.url) return { ok: false }
      try {
        const response = await fetch(message.url)
        const buffer = await response.arrayBuffer()
        if (buffer.byteLength > 25 * 1024 * 1024) return { ok: false }
        const view = new Uint8Array(buffer)
        let binary = ''
        for (let i = 0; i < view.length; i += 0x8000) {
          binary += String.fromCharCode(...view.subarray(i, i + 0x8000))
        }
        return {
          ok: true,
          mime: response.headers.get('content-type')?.split(';')[0] || 'image/png',
          base64: btoa(binary),
        }
      } catch {
        return { ok: false }
      }
    }
    case 'run-command':
      if (message.id) await runCommand(message.id, sender)
      return {}
  }
  return {}
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
