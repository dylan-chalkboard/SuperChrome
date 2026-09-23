/** Fuzzy matching blended with usage frecency — shared ranking core. */

export type UsageMap = Record<string, { n: number; t: number }>

/** Usage count decayed over the configured number of days. */
export function frecency(usage: UsageMap, key: string, decayDays: number): number {
  const entry = usage[key]
  if (!entry) return 0
  const days = (Date.now() - entry.t) / 86_400_000
  return entry.n * Math.exp(-days / decayDays)
}

const WORD_BOUNDARY = ' /-_.:'

export function fuzzyMatch(
  query: string,
  text: string,
): { score: number; positions: number[] } | null {
  if (!query) return { score: 0, positions: [] }
  // A contiguous substring hit wins outright — otherwise the greedy pass below
  // latches onto stray early letters (the s/e in "SuperChrome") and buries the
  // real word, so "settings" barely matches "SuperChrome: Settings".
  const at = text.indexOf(query)
  if (at !== -1) {
    const wordStart = at === 0 || WORD_BOUNDARY.includes(text[at - 1])
    const positions = Array.from({ length: query.length }, (_, i) => at + i)
    // Shape mirrors the subsequence score (word-start bonus, shorter-text and
    // earlier-hit preference) but on a higher base so substrings sort first.
    const score = query.length * 3 + (wordStart ? 8 : 0) - at * 0.1 - text.length * 0.01
    return { score, positions }
  }
  const positions: number[] = []
  let qi = 0
  let score = 0
  let streak = 0
  for (let ti = 0; ti < text.length && qi < query.length; ti++) {
    if (text[ti] === query[qi]) {
      streak++
      const wordStart = ti === 0 || WORD_BOUNDARY.includes(text[ti - 1])
      score += 1 + streak * 2 + (wordStart ? 6 : 0)
      positions.push(ti)
      qi++
    } else {
      streak = 0
    }
  }
  return qi === query.length ? { score: score - text.length * 0.01, positions } : null
}

/**
 * A matching result that's already an open tab jumps to the top — switching to
 * it is usually the fastest answer. Large enough that a matching tab beats
 * comparable bookmarks/history, on top of any frecency it already has.
 */
const OPEN_TAB_BOOST = 40

export function rank<T extends object>(
  entries: Array<{ item: T; text: string; usageKey: string }>,
  query: string,
  usage: UsageMap,
  decayDays = 14,
): Array<T & { positions?: number[] }> {
  const scored: Array<{
    item: T
    score: number
    index: number
    positions: number[]
    open: boolean
  }> = []
  entries.forEach((entry, index) => {
    const match = fuzzyMatch(query, entry.text)
    if (!match) return
    const boost = Math.min(30, frecency(usage, entry.usageKey, decayDays) * 5)
    const open = (entry.item as { openTab?: boolean }).openTab === true
    scored.push({
      item: entry.item,
      score: match.score + boost + (open ? OPEN_TAB_BOOST : 0),
      index,
      positions: match.positions,
      open,
    })
  })
  scored.sort(
    (a, b) => b.score - a.score || Number(b.open) - Number(a.open) || a.index - b.index,
  )
  return scored.map((s) => (query ? { ...s.item, positions: s.positions } : s.item))
}

