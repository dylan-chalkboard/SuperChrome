import type { PaletteItem } from '../../core/types'

/** Host of a URL, or the raw string if it won't parse. */
function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

/**
 * Collapse-key for history rows. Same title on the same host counts as one
 * entry — that's what turns the "PagerDuty Sign In" / "400 Request Header Or
 * Cookie Too Large" pile-ups (same page, different auth/query URLs) into a
 * single row. Untitled rows fall back to their host + path so distinct pages
 * still stand apart.
 */
export function historyKey(url: string, title: string): string {
  const t = title.trim().toLowerCase()
  if (t) return `${t}|${hostOf(url)}`
  try {
    const u = new URL(url)
    return `${u.host}${u.pathname}`.replace(/\/$/, '')
  } catch {
    return url
  }
}

/** Keep the first occurrence of each history key; input stays recency-ordered. */
export function dedupeHistory<T extends { url?: string; label: string }>(items: T[]): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const item of items) {
    if (!item.url) continue
    const key = historyKey(item.url, item.label)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(item)
  }
  return out
}

export async function searchHistory(rawQuery: string): Promise<PaletteItem[]> {
  const results = await chrome.history.search({
    text: rawQuery.trim(),
    maxResults: 50,
    startTime: 0,
  })
  return dedupeHistory(
    results
      .filter((r) => r.url)
      .map((r) => ({ kind: 'history' as const, label: r.title || r.url!, detail: '', url: r.url })),
  )
}
