import { getSettings } from './core/settings'
import { getUsage, recordUsage } from './core/usage'
import type { PaletteItem, PaletteMode } from './core/types'
import { collectFolders } from './features/bookmarks'
import { browseBookmarkFolder, searchBookmarks } from './features/bookmarks/search'
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
  if (command !== 'open-palette' && command !== 'quick-open') return
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  const mode = command === 'open-palette' ? 'commands' : (await getSettings()).defaultMode
  void togglePaletteIn(tab, mode)
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
  return searchBookmarks(rawQuery, usage, decay, settings)
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
