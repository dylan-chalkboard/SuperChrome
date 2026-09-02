import { rank } from '../ranking'
import type { UsageMap } from '../ranking'
import type { PaletteItem } from '../../core/types'

export const GROUP_COLORS: Record<string, string> = {
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

/** Open tabs plus the recently-closed sessions section. */
export async function searchTabs(
  query: string,
  usage: UsageMap,
  decay: number,
  sender: chrome.runtime.MessageSender,
): Promise<PaletteItem[]> {
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
  // Browsing '@' is about OPEN tabs — recently closed stays a small tail
  // (top 3) until a query pulls specific ones back in.
  return [...open, ...(query ? closed : closed.slice(0, 3))]
}
