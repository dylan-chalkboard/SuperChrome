import { DEFAULT_QUICKLINKS } from '../features/quicklinks'
import type { Quicklink } from '../features/quicklinks'
import type { Snippet } from '../features/snippets'
import type { PaletteMode } from './types'
import { DEFAULT_BACKDROP_ID, normalizeBackdropId } from '../features/newtab/backdrop-meta'

/** Palette UI scale bounds (1 = today's size). Exposed as the `--sc-scale`
 *  CSS variable and clamped everywhere the value is read or written. */
export const PALETTE_SCALE_MIN = 0.9
export const PALETTE_SCALE_MAX = 1.4

/** Clamp an arbitrary value to the palette-scale range; non-numbers fall to 1. */
export function clampPaletteScale(value: unknown): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return 1
  return Math.min(PALETTE_SCALE_MAX, Math.max(PALETTE_SCALE_MIN, n))
}

export interface UserSettings {
  glassOpacity: number
  /** Palette font + panel scale multiplier (see PALETTE_SCALE_MIN/MAX). */
  paletteScale: number
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
  paletteScale: 1,
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
