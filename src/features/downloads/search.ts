import { tileGradient } from '../gradients'
import { ago, basename } from '../navigation'
import { rank } from '../ranking'
import type { UsageMap } from '../ranking'
import type { PaletteItem } from '../../core/types'
import { fileType } from './index'

export async function searchDownloads(
  query: string,
  usage: UsageMap,
  decay: number,
): Promise<PaletteItem[]> {
  const downloads = await chrome.downloads.search({
    orderBy: ['-startTime'],
    limit: 50,
    exists: true,
    state: 'complete',
  })
  return rank<PaletteItem>(
    downloads
      .filter((d) => d.filename)
      .map((d) => {
        const type = fileType(d.filename)
        return {
          item: {
            kind: 'download' as const,
            label: basename(d.filename),
            detail: ago(Date.parse(d.startTime)),
            downloadId: d.id,
            text: d.filename,
            icon: type.icon,
            color: tileGradient(type.color),
          },
          text: basename(d.filename).toLowerCase(),
          usageKey: `download:${d.id}`,
        }
      }),
    query,
    usage,
    decay,
  )
}
