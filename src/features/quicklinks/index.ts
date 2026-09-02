/* ---------- Quicklinks: keyword searches with a {query} placeholder ---------- */

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

/** Match "yt lofi beats" against quicklink keywords; null when no keyword fits. */
export function matchQuicklink(
  raw: string,
  links: Quicklink[],
): { name: string; url: string; query: string } | null {
  const q = raw.trim()
  const space = q.indexOf(' ')
  if (space < 0) return null
  const keyword = q.slice(0, space).toLowerCase()
  const rest = q.slice(space + 1).trim()
  if (!rest) return null
  const link = links.find((l) => l.keyword.toLowerCase() === keyword)
  if (!link?.template.includes('{query}')) return null
  return {
    name: link.name,
    url: link.template.replace('{query}', encodeURIComponent(rest)),
    query: rest,
  }
}

/** One quicklink per line: "keyword | Name | https://…{query}". Invalid lines drop. */
export function parseQuicklinks(text: string): Quicklink[] {
  return text
    .split('\n')
    .map((line) => line.split('|').map((part) => part.trim()))
    .filter((parts) => parts.length === 3 && parts.every(Boolean) && parts[2].includes('{query}'))
    .map(([keyword, name, template]) => ({ keyword: keyword.toLowerCase(), name, template }))
}

export function serializeQuicklinks(links: Quicklink[]): string {
  return links.map((l) => `${l.keyword} | ${l.name} | ${l.template}`).join('\n')
}

