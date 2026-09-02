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
  const openTabs = tabs.filter((t) => t.id !== undefined)
  const tabItem = (t: chrome.tabs.Tab, section: string): PaletteItem => {
    const tabGroup = t.groupId !== undefined ? groupsById.get(t.groupId) : undefined
    const windowNote = t.windowId === currentWindowId ? '' : 'Other window'
    return {
      kind: 'tab' as const,
      label: t.title || t.url || '',
      detail:
        section !== 'Open Tabs' || !tabGroup?.title
          ? windowNote
          : `${tabGroup.title}${windowNote ? ` · ${windowNote}` : ''}`,
      tabId: t.id,
      url: t.url ?? '',
      group: section,
      groupColor: tabGroup ? GROUP_COLORS[tabGroup.color] : undefined,
      grouped: !!tabGroup,
      groupId: tabGroup?.id,
      groupTitle: tabGroup?.title,
      typeText: t.active && t.windowId === currentWindowId ? 'Active' : undefined,
    }
  }

  let open: PaletteItem[]
  if (query) {
    open = rank(
      openTabs.map((t) => {
        const tabGroup = t.groupId !== undefined ? groupsById.get(t.groupId) : undefined
        return {
          item: tabItem(t, 'Open Tabs'),
          text: `${t.title} ${t.url} ${tabGroup?.title ?? ''}`.toLowerCase(),
          usageKey: `tab:${t.url}`,
        }
      }),
      query,
      usage,
      decay,
    )
  } else {
    // Browsing: sectioned like the tab strip — ungrouped tabs first, then
    // each tab group as its own labeled section.
    const ungrouped = openTabs.filter((t) => !groupsById.has(t.groupId ?? -1))
    open = ungrouped.map((t) => tabItem(t, 'Open Tabs'))
    // Sections key off the title, so duplicates (two untitled groups, or two
    // groups given the same name) get a counter to stay distinct.
    const usedTitles = new Map<string, number>()
    for (const g of tabGroups) {
      const base = g.title || 'Untitled group'
      const n = (usedTitles.get(base) ?? 0) + 1
      usedTitles.set(base, n)
      const section = n > 1 ? `${base} ${n}` : base
      const members = openTabs.filter((t) => t.groupId === g.id)
      open.push(...members.map((t) => tabItem(t, section)))
    }
  }
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
