import { rank } from '../ranking'
import type { UsageMap } from '../ranking'
import type { PaletteItem } from '../../core/types'
import { EMOJI } from './data'

export function searchEmoji(query: string, usage: UsageMap, decay: number): PaletteItem[] {
  return rank<PaletteItem>(
    EMOJI.map(([char, name]) => ({
      item: { kind: 'emoji' as const, label: name, detail: '', emoji: char },
      text: name,
      usageKey: `emoji:${char}`,
    })),
    query,
    usage,
    decay,
  )
}
