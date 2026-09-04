/* ---------- Quicklinks: keyword links, with or without argument placeholders ---------- */

import { tileGradient } from '../gradients'
import { templateArguments } from './placeholders'
import type { ArgumentSpec } from './placeholders'

export * from './placeholders'

export interface Quicklink {
  keyword: string
  name: string
  template: string
  /** Tile color (hex) chosen in the create form; default styling otherwise. */
  color?: string
  /** Emoji/text glyph chosen in the create form; favicon or search glyph otherwise. */
  icon?: string
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

/**
 * One quicklink per line: "keyword | Name | https://…". Only the first two
 * pipes delimit — templates may contain pipes (dropdown options). Invalid
 * lines drop. Colors/icons aren't representable here; merge them back with
 * preserveQuicklinkExtras after parsing.
 */
export function parseQuicklinks(text: string): Quicklink[] {
  return text
    .split('\n')
    .map((line) => {
      const first = line.indexOf('|')
      const second = first < 0 ? -1 : line.indexOf('|', first + 1)
      if (second < 0) return null
      const keyword = line.slice(0, first).trim().toLowerCase()
      const name = line.slice(first + 1, second).trim()
      const template = line.slice(second + 1).trim()
      return keyword && name && template ? { keyword, name, template } : null
    })
    .filter((l): l is Quicklink => l !== null)
}

export function serializeQuicklinks(links: Quicklink[]): string {
  return links.map((l) => `${l.keyword} | ${l.name} | ${l.template}`).join('\n')
}

export function stripQlPlaceholders(template: string): string {
  return template.replace(/\{[^{}]*\}/g, '')
}

/**
 * Row icon styling for a quicklink: custom emoji/monogram on a tile, a
 * colored glyph tile, or the site favicon / orange search tile defaults.
 */
export function quicklinkStyle(
  l: Quicklink,
  searchStyle: boolean,
): { emoji?: string; icon?: string; iconUrl?: string; color?: string } {
  // "icon:<name>" = library glyph picked in the form; anything else is an
  // emoji/monogram rendered as text.
  if (l.icon?.startsWith('icon:')) {
    return { icon: l.icon.slice('icon:'.length), color: tileGradient(l.color ?? '#e8964a') }
  }
  if (l.icon) return { emoji: l.icon, color: tileGradient(l.color ?? '#e8964a') }
  if (l.color) return { icon: searchStyle ? 'search' : 'link', color: tileGradient(l.color) }
  if (searchStyle) return { icon: 'search', color: tileGradient('#e8964a') }
  return {
    iconUrl:
      chrome.runtime.getURL('/_favicon/') +
      `?pageUrl=${encodeURIComponent(stripQlPlaceholders(l.template))}&size=32`,
  }
}

/** Textarea edits can't express colors/icons — carry them over by keyword. */
export function preserveQuicklinkExtras(parsed: Quicklink[], previous: Quicklink[]): Quicklink[] {
  return parsed.map((l) => {
    const prev = previous.find((p) => p.keyword === l.keyword)
    if (!prev) return l
    return {
      ...l,
      ...(prev.color !== undefined && l.color === undefined ? { color: prev.color } : {}),
      ...(prev.icon !== undefined && l.icon === undefined ? { icon: prev.icon } : {}),
    }
  })
}
