/** Pure logic shared by the service worker and covered by unit tests. */

export type UsageMap = Record<string, { n: number; t: number }>

/** Usage count decayed over the configured number of days. */
export function frecency(usage: UsageMap, key: string, decayDays: number): number {
  const entry = usage[key]
  if (!entry) return 0
  const days = (Date.now() - entry.t) / 86_400_000
  return entry.n * Math.exp(-days / decayDays)
}

export function fuzzyMatch(
  query: string,
  text: string,
): { score: number; positions: number[] } | null {
  if (!query) return { score: 0, positions: [] }
  const positions: number[] = []
  let qi = 0
  let score = 0
  let streak = 0
  for (let ti = 0; ti < text.length && qi < query.length; ti++) {
    if (text[ti] === query[qi]) {
      streak++
      const wordStart = ti === 0 || ' /-_.:'.includes(text[ti - 1])
      score += 1 + streak * 2 + (wordStart ? 6 : 0)
      positions.push(ti)
      qi++
    } else {
      streak = 0
    }
  }
  return qi === query.length ? { score: score - text.length * 0.01, positions } : null
}

export function rank<T extends object>(
  entries: Array<{ item: T; text: string; usageKey: string }>,
  query: string,
  usage: UsageMap,
  decayDays = 14,
): Array<T & { positions?: number[] }> {
  const scored: Array<{ item: T; score: number; index: number; positions: number[] }> = []
  entries.forEach((entry, index) => {
    const match = fuzzyMatch(query, entry.text)
    if (!match) return
    const boost = Math.min(30, frecency(usage, entry.usageKey, decayDays) * 5)
    scored.push({ item: entry.item, score: match.score + boost, index, positions: match.positions })
  })
  scored.sort((a, b) => b.score - a.score || a.index - b.index)
  return scored.map((s) => (query ? { ...s.item, positions: s.positions } : s.item))
}

/* ---------- Inline calculator: safe recursive-descent parser, no eval ---------- */

export function tryCalculate(raw: string): string | null {
  let expr = raw.trim().toLowerCase()
  if (expr.length < 2 || expr.length > 64) return null
  expr = expr
    .replace(/,/g, '')
    .replace(/\bof\b/g, '*')
    .replace(/(^|[\s\d)])x([\s\d(])/g, '$1*$2')
    .replace(/\bpi\b/g, String(Math.PI))
  if (!/^[\d\s+\-*/^().%e]+$/.test(expr)) return null
  if (!/[+\-*/^%]/.test(expr) || !/\d/.test(expr)) return null

  let pos = 0
  const peek = (): string => expr[pos] ?? ''
  const skip = (): void => {
    while (peek() === ' ') pos++
  }
  const primary = (): number => {
    skip()
    if (peek() === '(') {
      pos++
      const value = additive()
      skip()
      if (peek() !== ')') throw new Error('paren')
      pos++
      return value
    }
    const match = /^\d*\.?\d+(e[+-]?\d+)?/.exec(expr.slice(pos))
    if (!match) throw new Error('number')
    pos += match[0].length
    return Number(match[0])
  }
  const postfix = (): number => {
    let value = primary()
    skip()
    while (peek() === '%') {
      pos++
      value /= 100
      skip()
    }
    return value
  }
  const unary = (): number => {
    skip()
    if (peek() === '-') {
      pos++
      return -unary()
    }
    return postfix()
  }
  const power = (): number => {
    const base = unary()
    skip()
    if (peek() === '^') {
      pos++
      return base ** power()
    }
    return base
  }
  const multiplicative = (): number => {
    let value = power()
    skip()
    while (peek() === '*' || peek() === '/') {
      const op = expr[pos++]
      const rhs = power()
      value = op === '*' ? value * rhs : value / rhs
      skip()
    }
    return value
  }
  const additive = (): number => {
    let value = multiplicative()
    skip()
    while (peek() === '+' || peek() === '-') {
      const op = expr[pos++]
      const rhs = multiplicative()
      value = op === '+' ? value + rhs : value - rhs
      skip()
    }
    return value
  }

  try {
    const result = additive()
    skip()
    if (pos !== expr.length || !Number.isFinite(result)) return null
    return String(Number(result.toPrecision(12)))
  } catch {
    return null
  }
}

/* ---------- Unit conversions: "5km in miles", "72f in c", "3h in min" ---------- */

interface UnitDef {
  group: string
  factor: number
  label: string
}

function unitTable(): Record<string, UnitDef> {
  const table: Record<string, UnitDef> = {}
  const add = (group: string, factor: number, label: string, aliases: string[]): void => {
    for (const alias of aliases) table[alias] = { group, factor, label }
  }
  add('length', 0.001, 'mm', ['mm', 'millimeter', 'millimeters'])
  add('length', 0.01, 'cm', ['cm', 'centimeter', 'centimeters'])
  add('length', 1, 'm', ['m', 'meter', 'meters', 'metre', 'metres'])
  add('length', 1000, 'km', ['km', 'kilometer', 'kilometers', 'kilometre', 'kilometres'])
  add('length', 0.0254, 'in', ['in', 'inch', 'inches'])
  add('length', 0.3048, 'ft', ['ft', 'foot', 'feet'])
  add('length', 0.9144, 'yd', ['yd', 'yard', 'yards'])
  add('length', 1609.344, 'mi', ['mi', 'mile', 'miles'])
  add('mass', 0.001, 'g', ['g', 'gram', 'grams'])
  add('mass', 0.000001, 'mg', ['mg'])
  add('mass', 1, 'kg', ['kg', 'kilogram', 'kilograms', 'kilo', 'kilos'])
  add('mass', 0.028349523125, 'oz', ['oz', 'ounce', 'ounces'])
  add('mass', 0.45359237, 'lb', ['lb', 'lbs', 'pound', 'pounds'])
  add('mass', 6.35029318, 'st', ['st', 'stone'])
  add('time', 1, 's', ['s', 'sec', 'secs', 'second', 'seconds'])
  add('time', 60, 'min', ['min', 'mins', 'minute', 'minutes'])
  add('time', 3600, 'h', ['h', 'hr', 'hrs', 'hour', 'hours'])
  add('time', 86400, 'd', ['d', 'day', 'days'])
  add('time', 604800, 'wk', ['wk', 'week', 'weeks'])
  add('data', 1, 'B', ['b', 'byte', 'bytes'])
  add('data', 1e3, 'KB', ['kb'])
  add('data', 1e6, 'MB', ['mb'])
  add('data', 1e9, 'GB', ['gb'])
  add('data', 1e12, 'TB', ['tb'])
  add('temp', 0, '°C', ['c', 'celsius', '°c'])
  add('temp', 0, '°F', ['f', 'fahrenheit', '°f'])
  add('temp', 0, 'K', ['k', 'kelvin'])
  return table
}

const UNITS = unitTable()

function toCelsius(value: number, label: string): number {
  if (label === '°F') return ((value - 32) * 5) / 9
  if (label === 'K') return value - 273.15
  return value
}

function fromCelsius(value: number, label: string): number {
  if (label === '°F') return (value * 9) / 5 + 32
  if (label === 'K') return value + 273.15
  return value
}

/** Convert "5km in miles" style queries; null when it isn't one. */
export function tryConvert(raw: string): string | null {
  const q = raw.trim().toLowerCase().replace(/,/g, '')
  const match = /^(-?\d+(?:\.\d+)?)\s*([a-z°]+)\s+(?:in|to|as)\s+([a-z°]+)$/i.exec(q)
  if (!match) return null
  const from = UNITS[match[2]]
  const to = UNITS[match[3]]
  if (!from || !to || from.group !== to.group) return null
  const value = Number(match[1])
  const result =
    from.group === 'temp'
      ? fromCelsius(toCelsius(value, from.label), to.label)
      : (value * from.factor) / to.factor
  if (!Number.isFinite(result)) return null
  return `${Number(result.toPrecision(6))} ${to.label}`
}

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

/* ---------- Snippets: reusable text inserted like emoji ---------- */

export interface Snippet {
  name: string
  text: string
}

/**
 * Options-page format: snippets separated by lines containing only `---`;
 * the first line of each block is the name, the rest is the snippet body
 * (blank lines inside a body are preserved).
 */
export function parseSnippets(text: string): Snippet[] {
  return text
    .split(/^---\s*$/m)
    .map((block) => block.replace(/^\n+|\n+$/g, ''))
    .filter(Boolean)
    .map((block) => {
      const newline = block.indexOf('\n')
      const name = (newline < 0 ? block : block.slice(0, newline)).trim()
      const body = newline < 0 ? '' : block.slice(newline + 1)
      return { name, text: body }
    })
    .filter((s) => s.name && s.text)
}

export function serializeSnippets(snippets: Snippet[]): string {
  return snippets.map((s) => `${s.name}\n${s.text}`).join('\n---\n')
}

/* ---------- Small helpers ---------- */

/**
 * Turn an address-bar-like query ("google.com", "localhost:3000/x") into a
 * navigable URL, or null when it reads as a search phrase instead.
 */
export function urlFromQuery(raw: string): string | null {
  const q = raw.trim()
  if (!q || /\s/.test(q)) return null
  if (/^https?:\/\/\S+$/i.test(q)) return q
  if (/^localhost(:\d+)?(\/\S*)?$/i.test(q)) return `http://${q}`
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}(:\d+)?(\/\S*)?$/i.test(q)) return `https://${q}`
  return null
}

export function hostOf(url: string | undefined): string | null {
  try {
    return url ? new URL(url).hostname.toLowerCase() : null
  } catch {
    return null
  }
}

export function basename(path: string): string {
  return path.split('/').pop() || path
}

export function ago(t: number): string {
  const s = Math.max(0, (Date.now() - t) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

const FILE_TYPES: Array<[RegExp, { icon: string; color: string }]> = [
  [/\.pdf$/i, { icon: 'doc', color: '#e05d5d' }],
  [/\.(png|jpe?g|gif|webp|svg|heic|bmp|ico)$/i, { icon: 'image', color: '#9a6ee8' }],
  [/\.(mp4|mov|mkv|webm|avi)$/i, { icon: 'film', color: '#e57fb3' }],
  [/\.(mp3|wav|flac|m4a|ogg|aiff)$/i, { icon: 'music', color: '#e8964a' }],
  [/\.(zip|tar|gz|rar|7z|tgz)$/i, { icon: 'archive', color: '#e8c341' }],
  [/\.(js|ts|tsx|jsx|py|json|html|css|sh|go|rs|java|rb)$/i, { icon: 'code', color: '#4c9df3' }],
  [/\.(docx?|txt|md|rtf|pages)$/i, { icon: 'doc', color: '#4c9df3' }],
  [/\.(xlsx?|csv|numbers)$/i, { icon: 'table', color: '#4caf7d' }],
  [/\.(dmg|pkg|app|exe|msi|deb)$/i, { icon: 'download', color: '#8e8e93' }],
]

export function fileType(filename: string): { icon: string; color: string } {
  for (const [pattern, type] of FILE_TYPES) {
    if (pattern.test(filename)) return type
  }
  return { icon: 'doc', color: '#3aa99f' }
}

/* ---------- Hue-shift tile gradients ---------- */

function hslToHex(h: number, s: number, l: number): string {
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const c = l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(c * 255)
      .toString(16)
      .padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

/**
 * Turn a flat tile color into a hue-shifted diagonal gradient (Raycast-style).
 * Grays and unparseable values pass through unchanged, so this is safe to
 * apply to any user-configured color.
 */
export function tileGradient(color: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(color.trim())
  if (!m) return color
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  if (d === 0) return color
  const l = (max + min) / 2
  const s = d / (1 - Math.abs(2 * l - 1))
  let h = 0
  if (max === r) h = ((g - b) / d + 6) % 6
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  h *= 60
  const stop = (dh: number) => hslToHex((h + dh + 360) % 360, s, l)
  return `linear-gradient(135deg, ${stop(-20)}, ${stop(20)})`
}

/* ---------- Bookmark tree walkers ---------- */

export interface BookmarkNodeLike {
  id: string
  title: string
  url?: string
  children?: BookmarkNodeLike[]
}

export function collectBookmarks(
  node: BookmarkNodeLike,
  path: string[],
  out: Array<{ id: string; title: string; url: string; path: string }>,
): void {
  for (const child of node.children ?? []) {
    if (child.url) {
      out.push({
        id: child.id,
        title: child.title || child.url,
        url: child.url,
        path: path.join(' / '),
      })
    } else {
      collectBookmarks(child, [...path, child.title], out)
    }
  }
}

export function collectFolders(
  node: BookmarkNodeLike,
  path: string[],
  out: Array<{ id: string; path: string }>,
): void {
  for (const child of node.children ?? []) {
    if (child.url) continue
    const childPath = [...path, child.title]
    out.push({ id: child.id, path: childPath.join(' / ') })
    collectFolders(child, childPath, out)
  }
}
