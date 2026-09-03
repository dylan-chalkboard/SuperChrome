import type { FavoriteEntry, PaletteAction, RemoteItem } from './types'

/**
 * Module-level cache is safe: the injected palette and the popup never run in
 * the same page, so each UI gets its own copy of this state.
 */
let favoritesCache: FavoriteEntry[] | null = null

export async function loadFavorites(): Promise<FavoriteEntry[]> {
  try {
    const { favorites } = await chrome.storage.sync.get('favorites')
    favoritesCache = Array.isArray(favorites) ? favorites : []
  } catch {
    favoritesCache = []
  }
  return favoritesCache
}

export function favKey(f: FavoriteEntry): string {
  if (f.kind === 'command') return `command:${f.commandId}`
  if (f.kind === 'folder') return `folder:${f.id}`
  return `url:${f.url}`
}

/** Storage key for an item, or null for kinds that can't be favorited. */
export function favoriteKeyOf(item: RemoteItem): string | null {
  if (item.kind === 'command' && item.commandId && !item.commandId.startsWith('onboard:')) {
    return `command:${item.commandId}`
  }
  if (item.kind === 'folder' && item.id) return `folder:${item.id}`
  const urlKinds: RemoteItem['kind'][] = ['bookmark', 'history', 'tab', 'closed']
  if (item.url && urlKinds.includes(item.kind)) return `url:${item.url}`
  return null
}

export function isFavorite(item: RemoteItem): boolean {
  const key = favoriteKeyOf(item)
  return !!key && !!favoritesCache?.some((f) => favKey(f) === key)
}

export function favoriteActionFor(item: RemoteItem): PaletteAction[] {
  if (!favoriteKeyOf(item)) return []
  return isFavorite(item)
    ? [{ id: 'favorite-remove', label: 'Remove from Favorites' }]
    : [{ id: 'favorite-add', label: 'Add to Favorites' }]
}

/** Toggles the favorite; returns the toast message to show, or null if the
 * item can't be favorited. */
export async function toggleFavorite(item: RemoteItem): Promise<string | null> {
  const key = favoriteKeyOf(item)
  if (!key) return null
  const favorites = await loadFavorites()
  const index = favorites.findIndex((f) => favKey(f) === key)
  if (index >= 0) {
    favorites.splice(index, 1)
  } else if (item.kind === 'command') {
    favorites.push({
      kind: 'command',
      label: item.label,
      commandId: item.commandId,
      icon: item.icon,
      color: item.color,
    })
  } else if (item.kind === 'folder') {
    favorites.push({ kind: 'folder', label: item.label, id: item.id })
  } else {
    favorites.push({ kind: 'bookmark', label: item.label, url: item.url })
  }
  favoritesCache = favorites
  await chrome.storage.sync.set({ favorites })
  return index >= 0 ? 'Removed from Favorites' : 'Added to Favorites'
}

/** Patch a favorite's customization; undefined values clear the field. */
export async function updateFavorite(
  key: string,
  patch: Partial<FavoriteEntry>,
): Promise<void> {
  const favorites = await loadFavorites()
  const entry = favorites.find((f) => favKey(f) === key)
  if (!entry) return
  const record = entry as unknown as Record<string, unknown>
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) delete record[k]
    else record[k] = v
  }
  favoritesCache = favorites
  await chrome.storage.sync.set({ favorites })
}

export function favToItem(f: FavoriteEntry): RemoteItem {
  if (f.kind === 'command') {
    return { kind: 'command', label: f.label, detail: '', commandId: f.commandId, icon: f.icon, color: f.color }
  }
  if (f.kind === 'folder') return { kind: 'folder', label: f.label, detail: '', id: f.id }
  return { kind: 'bookmark', label: f.label, detail: '', url: f.url }
}
