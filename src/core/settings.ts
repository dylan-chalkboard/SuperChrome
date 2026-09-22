import { DEFAULT_QUICKLINKS } from '../features/quicklinks'
import type { Quicklink } from '../features/quicklinks'
import type { Snippet } from '../features/snippets'
import type { PaletteMode } from './types'
import { DEFAULT_BACKDROP_ID, normalizeBackdropId } from '../features/newtab/backdrop-meta'

export interface UserSettings {
  glassOpacity: number
  iconColors: { command: string; folder: string; history: string; fallback: string }
  frecencyDecayDays: number
  defaultMode: PaletteMode
  appearance: 'system' | 'dark' | 'light'
  /** New tab backdrop id (see features/newtab/registry). */
  backdrop: string
  /** Backdrop animation speed multiplier (0.5 calm, 1 normal, 1.8 lively). */
  backdropSpeed: number
  darkenPhotos: boolean
  openInNewTab: boolean
  reduceMotion: boolean
  disabledSites: string[]
  quicklinks: Quicklink[]
  snippets: Snippet[]
}

export const DEFAULT_SETTINGS: UserSettings = {
  glassOpacity: 0.8,
  iconColors: { command: '#4c9df3', folder: '#e0a63c', history: '#9a6ee8', fallback: '#e05d5d' },
  frecencyDecayDays: 14,
  defaultMode: 'bookmarks',
  appearance: 'system',
  backdrop: DEFAULT_BACKDROP_ID,
  backdropSpeed: 1,
  darkenPhotos: true,
  openInNewTab: false,
  reduceMotion: false,
  disabledSites: [],
  quicklinks: DEFAULT_QUICKLINKS,
  snippets: [],
}

export async function getSettings(): Promise<UserSettings> {
  try {
    const { settings } = await chrome.storage.sync.get('settings')
    return {
      ...DEFAULT_SETTINGS,
      ...settings,
      iconColors: { ...DEFAULT_SETTINGS.iconColors, ...settings?.iconColors },
      backdrop: normalizeBackdropId(settings?.backdrop),
      darkenPhotos: settings?.darkenPhotos !== false,
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}
