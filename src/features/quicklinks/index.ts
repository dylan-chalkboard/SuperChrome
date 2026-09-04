/* ---------- Quicklinks: keyword links, with or without argument placeholders ---------- */

import { templateArguments } from './placeholders'
import type { ArgumentSpec } from './placeholders'

export * from './placeholders'

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
  link: Quicklink
  /** Text typed after the keyword — prefills the first argument. */
  rest: string
  args: ArgumentSpec[]
}

/**
 * Match the first typed word against quicklink keywords. Arg-ful templates
 * accept a bare keyword (prompt flow) or trailing text; static templates
 * match on the bare keyword only. Null when no keyword fits.
 */
export function matchQuicklink(raw: string, links: Quicklink[]): QuicklinkMatch | null {
  const q = raw.trim()
  const space = q.indexOf(' ')
  const keyword = (space < 0 ? q : q.slice(0, space)).toLowerCase()
  const rest = space < 0 ? '' : q.slice(space + 1).trim()
  const link = links.find((l) => l.keyword.toLowerCase() === keyword)
  if (!link) return null
  const args = templateArguments(link.template)
  if (!args.length && rest) return null
  return { link, rest, args }
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
