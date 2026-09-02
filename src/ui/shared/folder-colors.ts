/** Folder-color overrides, stored in chrome.storage.sync keyed by folder id. */

let cache: Record<string, string> | null = null

export async function loadFolderColors(): Promise<Record<string, string>> {
  try {
    const { folderColors } = await chrome.storage.sync.get('folderColors')
    cache = folderColors && typeof folderColors === 'object' ? folderColors : {}
  } catch {
    cache = {}
  }
  return cache!
}

/** Synchronous lookup against the warmed cache; null means default blue. */
export function folderColorOf(id: string | undefined): string | null {
  return (id && cache?.[id]) || null
}

export async function setFolderColor(id: string, color: string | null): Promise<void> {
  const colors = await loadFolderColors()
  if (color) colors[id] = color
  else delete colors[id]
  cache = colors
  await chrome.storage.sync.set({ folderColors: colors })
}
