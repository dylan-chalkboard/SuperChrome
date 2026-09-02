/** Fuzzy matching blended with usage frecency — shared ranking core. */

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

