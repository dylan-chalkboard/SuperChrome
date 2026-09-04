/* ---------- Quicklinks: keyword links, with or without a {query} placeholder ---------- */

export interface Quicklink {
  keyword: string
  name: string
  template: string
}

export const DEFAULT_QUICKLINKS: Quicklink[] = [
  { keyword: 'g', name: 'Google', template: 'https://www.google.com/search?q={query}' },
  { keyword: 'yt', name: 'YouTube', template: 'https://www.youtube.com/results?search_query={query}' },
  { keyword: 'gh', name: 'GitHub', template: 'https://github.com/search?q={query}' },
  { keyword: 'w', name: 'Wikipedia', template: 'https://en.wikipedia.org/wiki/Special:Search?search={query}' },
  { keyword: 'maps', name: 'Google Maps', template: 'https://www.google.com/maps/search/{query}' },
]

export interface QuicklinkMatch {
  name: string
  url: string
  query: string
  kind: 'search' | 'open'
}

/**
 * Match "yt lofi beats" against {query} templates, or a bare "dash" against
 * static ones; null when no keyword fits.
 */
export function matchQuicklink(raw: string, links: Quicklink[]): QuicklinkMatch | null {
  const q = raw.trim()
  const space = q.indexOf(' ')
  const keyword = (space < 0 ? q : q.slice(0, space)).toLowerCase()
  const rest = space < 0 ? '' : q.slice(space + 1).trim()
  const link = links.find((l) => l.keyword.toLowerCase() === keyword)
  if (!link) return null
  const isSearch = link.template.includes('{query}')
  if (isSearch !== Boolean(rest)) return null
  if (!isSearch) return { name: link.name, url: link.template, query: '', kind: 'open' }
  return {
    name: link.name,
    url: link.template.replace('{query}', encodeURIComponent(rest)),
    query: rest,
    kind: 'search',
  }
}

/** One quicklink per line: "keyword | Name | https://…". Invalid lines drop. */
export function parseQuicklinks(text: string): Quicklink[] {
  return text
    .split('\n')
    .map((line) => line.split('|').map((part) => part.trim()))
    .filter((parts) => parts.length === 3 && parts.every(Boolean))
    .map(([keyword, name, template]) => ({ keyword: keyword.toLowerCase(), name, template }))
}

export function serializeQuicklinks(links: Quicklink[]): string {
  return links.map((l) => `${l.keyword} | ${l.name} | ${l.template}`).join('\n')
}
