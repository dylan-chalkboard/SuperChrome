export interface FindNode {
  node: Text
  text: string
}

export interface FindMatch {
  nodeIndex: number
  start: number
  end: number
}

export interface FindResult {
  matches: FindMatch[]
  total: number
  capped: boolean
}

export const FIND_CAP = 200

/**
 * Enumerate every literal, case-insensitive occurrence of `query` across the
 * given text records, in array (document) order. Non-overlapping within a node.
 * `matches` is truncated to `cap`; `total` is the real count; `capped` flags
 * truncation so the UI can show "N / cap+" instead of overstating coverage.
 */
export function findMatches(
  index: Pick<FindNode, 'text'>[],
  query: string,
  cap: number = FIND_CAP,
): FindResult {
  const needle = query.toLowerCase()
  if (needle.trim() === '') return { matches: [], total: 0, capped: false }

  const matches: FindMatch[] = []
  let total = 0
  for (let nodeIndex = 0; nodeIndex < index.length; nodeIndex++) {
    const hay = index[nodeIndex].text.toLowerCase()
    let from = 0
    for (;;) {
      const at = hay.indexOf(needle, from)
      if (at === -1) break
      total++
      if (matches.length < cap) {
        matches.push({ nodeIndex, start: at, end: at + needle.length })
      }
      from = at + needle.length
    }
  }
  return { matches, total, capped: total > cap }
}
