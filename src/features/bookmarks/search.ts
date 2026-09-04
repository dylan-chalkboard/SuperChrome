import { tryCalculate, tryConvert } from '../calculator'
import { commandEntries } from '../commands'
import { tileGradient } from '../gradients'
import { hostOf, urlFromQuery } from '../navigation'
import { matchQuicklink, quicklinkStyle, stripQlPlaceholders, templateArguments } from '../quicklinks'
import { frecency, rank } from '../ranking'
import type { UsageMap } from '../ranking'
import type { PaletteItem } from '../../core/types'
import type { UserSettings } from '../../core/settings'
import { collectBookmarks, collectFolders } from './index'

/**
 * Browsing inside one folder: its direct children, subfolders included.
 * Empty query shows the folder's true order (reordering depends on it);
 * frecency ranking only applies once the user types.
 */
export async function browseBookmarkFolder(
  folderId: string,
  query: string,
  usage: UsageMap,
  decay: number,
): Promise<PaletteItem[]> {
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

/**
 * Library ('*') mode typing: a global bookmark-only search — bookmarks and
 * folders across the whole tree, no commands/history/calculator. Rows carry
 * their folder path so results read in context.
 */
export async function searchLibrary(
  rawQuery: string,
  usage: UsageMap,
  decay: number,
): Promise<PaletteItem[]> {
  const query = rawQuery.trim().toLowerCase()
  const [root] = await chrome.bookmarks.getTree()
  const flat: Array<{ id: string; title: string; url: string; path: string }> = []
  const folders: Array<{ id: string; path: string }> = []
  for (const child of root.children ?? []) {
    collectBookmarks(child, [], flat)
    collectFolders(child, [], folders)
  }
  const entries = [
    ...folders.map((f) => {
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
    }),
    ...flat.map((b) => ({
      item: {
        kind: 'bookmark' as const,
        label: b.title,
        detail: b.path ? `in ${b.path}` : '',
        url: b.url,
        id: b.id,
      },
      text: `${b.title} ${b.url}`.toLowerCase(),
      usageKey: `bookmark:${b.url}`,
    })),
  ]
  return rank<PaletteItem>(entries, query, usage, decay).slice(0, 50)
}

/**
 * Default mode: the Raycast-style home view when the query is empty, else the
 * blended search across bookmarks, folders, commands, history, calculator,
 * quicklinks, direct URLs, and Google search.
 */
export async function searchBookmarks(
  rawQuery: string,
  usage: UsageMap,
  decay: number,
  settings: UserSettings,
): Promise<PaletteItem[]> {
  const query = rawQuery.trim().toLowerCase()
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
    // Curated definition order keeps related commands together (all the zoom
    // ones side by side, etc.); Suggested above already covers frequent picks.
    const allCommands = commands
      .filter((entry) => !suggestedKeys.has(entry.usageKey))
      .map((entry) => ({ entry }))
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

  // Open tabs join the blended results: a match you already have open is
  // usually the fastest answer, and Enter switches straight to it.
  const openTabs = await chrome.tabs.query({})
  const normUrl = (u: string): string => {
    try {
      const url = new URL(u)
      url.hash = ''
      return url.href.replace(/\/$/, '')
    } catch {
      return u
    }
  }
  const openUrls = new Set(openTabs.filter((t) => t.url).map((t) => normUrl(t.url!)))
  const tabEntries = openTabs
    .filter((t) => t.id !== undefined && t.url)
    .map((t) => ({
      item: {
        kind: 'tab' as const,
        label: t.title || t.url!,
        detail: '',
        url: t.url!,
        tabId: t.id,
        openTab: true,
      },
      text: `${t.title} ${t.url}`.toLowerCase(),
      usageKey: `tab:${t.url}`,
    }))
  // Bookmarks/history pointing at an open tab get the same treatment.
  for (const entry of bookmarkEntries) {
    if (entry.item.url && openUrls.has(normUrl(entry.item.url))) {
      ;(entry.item as PaletteItem).openTab = true
    }
  }

  // History rides along in the ranked list; bookmarked URLs win the dedup.
  const bookmarkUrls = new Set(flat.map((b) => b.url))
  const historyEntries = (
    await chrome.history.search({ text: rawQuery.trim(), maxResults: 30, startTime: 0 })
  )
    .filter((r) => r.url && !bookmarkUrls.has(r.url))
    .map((r) => ({
      item: {
        kind: 'history' as const,
        label: r.title || r.url!,
        detail: '',
        url: r.url,
        openTab: r.url ? openUrls.has(normUrl(r.url)) : undefined,
      },
      text: `${r.title ?? ''} ${r.url}`.toLowerCase(),
      usageKey: `history:${r.url}`,
    }))

  // Quicklinks: "yt lofi beats" searches the keyword's site directly; a bare
  // keyword offers the link (prompting for any arguments at open time).
  const quicklink = matchQuicklink(rawQuery, settings.quicklinks)

  // Quicklinks also surface by name alongside bookmarks, Raycast-style. Rows
  // carry their template; the palette renders the final URL when opened,
  // since clipboard/selection placeholders only exist in the page. The
  // exact-keyword match above is excluded so the same link never shows twice.
  const quicklinkEntries = settings.quicklinks
    .filter((l) => l.keyword !== quicklink?.link.keyword)
    .map((l) => {
      const argful = templateArguments(l.template).length > 0
      return {
        item: {
          kind: 'search' as const,
          label: l.name,
          detail: hostOf(stripQlPlaceholders(l.template)) ?? '',
          template: l.template,
          qlKeyword: l.keyword,
          qlName: l.name,
          typeText: 'Quicklink',
          ...quicklinkStyle(l, argful),
        },
        text: `${l.name} ${l.keyword}`.toLowerCase(),
        usageKey: `quicklink:${l.keyword}`,
      }
    })

  const results = rank<PaletteItem>(
    [...bookmarkEntries, ...folderEntries, ...commands, ...quicklinkEntries, ...tabEntries, ...historyEntries],
    query,
    usage,
    decay,
  ).slice(0, 50)
  const calc = tryCalculate(rawQuery) ?? tryConvert(rawQuery)
  if (calc !== null) {
    results.unshift({
      kind: 'calc',
      label: calc,
      detail: `${rawQuery.trim()} =`,
      text: calc,
      group: 'Calculator',
    })
  }
  if (quicklink) {
    const { link, rest, args } = quicklink
    results.unshift({
      kind: 'search',
      label: args.length && rest ? `Search ${link.name} for “${rest}”` : link.name,
      detail: hostOf(stripQlPlaceholders(link.template)) ?? '',
      template: link.template,
      qlRest: rest,
      qlKeyword: link.keyword,
      qlName: link.name,
      typeText: 'Quicklink',
      ...quicklinkStyle(link, args.length > 0 && Boolean(rest)),
      group: 'Quicklink',
    })
  }
  // Address-bar behavior: a URL-shaped query gets a direct "Open" row on top.
  const directUrl = urlFromQuery(rawQuery)
  if (directUrl) {
    results.unshift({
      kind: 'search',
      label: `Open ${rawQuery.trim()}`,
      detail: '',
      url: directUrl,
      icon: 'globe',
      color: tileGradient('#4c9df3'),
      group: 'Navigate',
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
    color: tileGradient('#4c9df3'),
    group: 'Search',
  })
  return results
}
