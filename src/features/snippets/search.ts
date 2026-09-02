import { rank } from '../ranking'
import type { UsageMap } from '../ranking'
import type { PaletteItem } from '../../core/types'
import type { Snippet } from './index'

export function searchSnippets(
  query: string,
  usage: UsageMap,
  decay: number,
  snippets: Snippet[],
): PaletteItem[] {
  return rank<PaletteItem>(
    snippets.map((s) => ({
      item: {
        kind: 'snippet' as const,
        label: s.name,
        detail: s.text.split('\n')[0].slice(0, 60),
        text: s.text,
      },
      text: `${s.name} ${s.text}`.toLowerCase(),
      usageKey: `snippet:${s.name}`,
    })),
    query,
    usage,
    decay,
  )
}
