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

/* ---------- Small helpers ---------- */

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
