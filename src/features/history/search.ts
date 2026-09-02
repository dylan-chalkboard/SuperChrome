import type { PaletteItem } from '../../core/types'

export async function searchHistory(rawQuery: string): Promise<PaletteItem[]> {
  const results = await chrome.history.search({
    text: rawQuery.trim(),
    maxResults: 50,
    startTime: 0,
  })
  return results
    .filter((r) => r.url)
    .map((r) => ({ kind: 'history' as const, label: r.title || r.url!, detail: '', url: r.url }))
}
