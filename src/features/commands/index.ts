import { tileGradient } from '../gradients'
import type { PaletteItem } from '../../core/types'

export const PAGE_COMMANDS: Record<string, string> = {
  'open-settings': 'chrome://settings/',
  'open-version': 'chrome://version/',
  'open-inspect-devices': 'chrome://inspect/',
  'open-webstore': 'https://chromewebstore.google.com/',
  'open-bookmarks-manager': 'chrome://bookmarks/',
  'open-history': 'chrome://history/',
  'open-extensions': 'chrome://extensions/',
  'open-shortcuts': 'chrome://extensions/shortcuts',
}

export const PALETTE_COMMANDS = [
  { id: 'switch-to-tab', label: 'Tabs' },
  // Mode launchers: searchable from the home view; the palette intercepts
  // these and sets the mode prefix instead of running anything.
  { id: 'mode-commands', label: 'Commands' },
  { id: 'mode-history', label: 'History' },
  { id: 'mode-emoji', label: 'Emoji' },
  { id: 'mode-snippets', label: 'Snippets' },
  { id: 'mode-library', label: 'Bookmarks' },
  { id: 'open-options', label: 'SuperChrome: Settings' },
  { id: 'show-onboarding', label: 'SuperChrome: Getting Started' },
  { id: 'page-links', label: 'Grab Page Links' },
  { id: 'page-images', label: 'Grab Page Images' },
  { id: 'page-outline', label: 'Page Outline' },
  { id: 'page-info', label: 'Page Info' },
  { id: 'page-trackers', label: 'Page Trackers' },
  { id: 'new-folder', label: 'New Bookmark Folder…' },
  { id: 'bookmark-tab', label: 'Bookmark Current Tab' },
  { id: 'pick-color', label: 'Pick Color' },
  { id: 'confetti', label: 'Confetti' },
  { id: 'dvd', label: 'DVD Screensaver' },
  { id: 'copy-page-url', label: 'Copy Page URL' },
  { id: 'copy-page-md', label: 'Copy Page as Markdown Link' },
  { id: 'go-back', label: 'Go Back' },
  { id: 'go-forward', label: 'Go Forward' },
  { id: 'new-tab', label: 'New Tab' },
  { id: 'reopen-tab', label: 'Reopen Closed Tab' },
  { id: 'duplicate-tab', label: 'Duplicate Tab' },
  { id: 'toggle-pin', label: 'Pin/Unpin Tab' },
  { id: 'split-view', label: 'New Split View' },
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
  { id: 'open-settings', label: 'Open Chrome Settings' },
  { id: 'open-webstore', label: 'Open Chrome Web Store' },
  { id: 'open-bookmarks-manager', label: 'Open Bookmarks Manager' },
  { id: 'open-history', label: 'Open History' },
  { id: 'open-downloads', label: 'Downloads' },
  { id: 'open-extensions', label: 'Open Extensions' },
  { id: 'open-shortcuts', label: 'Open Keyboard Shortcuts' },
  { id: 'open-version', label: 'Open Chrome Version' },
]


/** Per-command icon + tile color shown in the '>' list. */
export const COMMAND_META: Record<string, { icon: string; color: string }> = {
  'switch-to-tab': { icon: 'tabs-app', color: '' },
  'mode-commands': { icon: 'terminal-app', color: '' },
  'mode-history': { icon: 'clock-app', color: '' },
  'mode-emoji': { icon: 'emoji-glyph', color: '' },
  'mode-snippets': { icon: 'doc', color: '#e8964a' },
  'mode-library': { icon: 'ribbon', color: '' },
  'open-options': { icon: 'logo', color: '' },
  'show-onboarding': { icon: 'info', color: '#4c9df3' },
  'page-links': { icon: 'link', color: '#4caf7d' },
  'page-images': { icon: 'image', color: '#9a6ee8' },
  'page-outline': { icon: 'form', color: '#4caf7d' },
  'page-info': { icon: 'info', color: '#4c9df3' },
  'page-trackers': { icon: 'shield', color: '#e05d5d' },
  'new-folder': { icon: 'folder', color: '#3f97ee' },
  'bookmark-tab': { icon: 'bookmark', color: '#e05d5d' },
  'pick-color': { icon: 'paint', color: '#e57fb3' },
  confetti: { icon: 'confetti', color: '#e57fb3' },
  dvd: { icon: 'film', color: '#5a5f6b' },
  'copy-page-url': { icon: 'link', color: '#4caf7d' },
  'copy-page-md': { icon: 'link', color: '#4caf7d' },
  'go-back': { icon: 'arrow-left', color: '#4c9df3' },
  'go-forward': { icon: 'arrow-right', color: '#4c9df3' },
  'new-tab': { icon: 'tab', color: '#4c9df3' },
  'reopen-tab': { icon: 'reset', color: '#e0619e' },
  'duplicate-tab': { icon: 'tab', color: '#4c9df3' },
  'toggle-pin': { icon: 'pin', color: '#4c9df3' },
  'split-view': { icon: 'split', color: '#3ab5c6' },
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
  'open-webstore': { icon: 'bag', color: '#4caf7d' },
  'open-bookmarks-manager': { icon: 'bookmark', color: '#e05d5d' },
  'open-history': { icon: 'clock', color: '#9a6ee8' },
  'open-downloads': { icon: 'floppy', color: '' },
  'open-extensions': { icon: 'puzzle', color: '#e8964a' },
  'open-shortcuts': { icon: 'keyboard', color: '#7d8a97' },
  'open-version': { icon: 'info', color: '#7d8a97' },
}

export function commandEntries(): Array<{
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
      color: COMMAND_META[c.id]?.color ? tileGradient(COMMAND_META[c.id].color) : undefined,
    },
    text: c.label.toLowerCase(),
    usageKey: `command:${c.id}`,
  }))
}

/** Popup senders have no tab; fall back to the active tab of the current window. */
export async function senderTab(
  sender: chrome.runtime.MessageSender,
): Promise<chrome.tabs.Tab | undefined> {
  if (sender.tab) return sender.tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  return tab
}

export async function runCommand(
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
    case 'reopen-tab':
      // No argument = restore the most recently closed tab or window.
      await chrome.sessions.restore().catch(() => {})
      break
    case 'go-back':
      if (tab?.id) await chrome.tabs.goBack(tab.id).catch(() => {})
      break
    case 'go-forward':
      if (tab?.id) await chrome.tabs.goForward(tab.id).catch(() => {})
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
    // 'bookmark-tab' never reaches here: the palette intercepts it and opens
    // the library save flow instead of blind-creating at the bar root.
    case 'view-source':
      if (tab?.url) await chrome.tabs.create({ url: `view-source:${tab.url}` })
      break
    // 'split-tab' was removed: Chrome has no extension API to create a native
    // Split View (w3c/webextensions#967) — bring the command back if it ships.
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
    case 'split-view':
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
