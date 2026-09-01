async function togglePaletteIn(
  tabId: number | undefined,
  mode: 'bookmarks' | 'commands',
): Promise<void> {
  if (!tabId) return
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'toggle-palette', mode })
  } catch {
    // Content script isn't there (tab predates the extension, or injection was
    // missed) — inject on demand and retry. Still impossible on chrome://
    // pages, the Web Store, and the PDF viewer.
    try {
      await chrome.scripting.executeScript({ target: { tabId }, files: ['palette.js'] })
      await chrome.tabs.sendMessage(tabId, { type: 'toggle-palette', mode })
    } catch {
      // Restricted page — nothing to show.
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

interface FlatBookmark {
  title: string
  url: string
  path: string
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then(sendResponse)
    .catch((err) => sendResponse({ error: String(err) }))
  return true
})

async function handleMessage(
  message: { type?: string; url?: string; newTab?: boolean; id?: string; tabId?: number },
  sender: chrome.runtime.MessageSender,
): Promise<unknown> {
  switch (message?.type) {
    case 'palette-data': {
      const [root] = await chrome.bookmarks.getTree()
      const bookmarks: FlatBookmark[] = []
      for (const child of root.children ?? []) collectBookmarks(child, [], bookmarks)
      const tabs = sender.tab
        ? await chrome.tabs.query({ windowId: sender.tab.windowId })
        : await chrome.tabs.query({ currentWindow: true })
      return {
        bookmarks,
        tabs: tabs.map((t) => ({ id: t.id, title: t.title ?? '', url: t.url ?? '' })),
        commands: PALETTE_COMMANDS,
      }
    }
    case 'activate-tab': {
      if (message.tabId !== undefined) await chrome.tabs.update(message.tabId, { active: true })
      return {}
    }
    case 'open-url': {
      const tab = await senderTab(sender)
      if (message.newTab || !tab?.id) await chrome.tabs.create({ url: message.url })
      else await chrome.tabs.update(tab.id, { url: message.url })
      return {}
    }
    case 'run-command': {
      if (message.id) await runCommand(message.id, sender)
      return {}
    }
  }
  return {}
}

function collectBookmarks(
  node: chrome.bookmarks.BookmarkTreeNode,
  path: string[],
  out: FlatBookmark[],
): void {
  for (const child of node.children ?? []) {
    if (child.url) out.push({ title: child.title || child.url, url: child.url, path: path.join(' / ') })
    else collectBookmarks(child, [...path, child.title], out)
  }
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
    case 'open-devtools':
      // Extensions can't open DevTools; the native host (native-host/) presses
      // Cmd+Opt+I via macOS. No-op if the host isn't installed.
      try {
        await chrome.runtime.sendNativeMessage('com.codepanel.host', { action: 'open-devtools' })
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
