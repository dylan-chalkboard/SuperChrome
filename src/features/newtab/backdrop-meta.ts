// Lightweight backdrop id/label list, split from registry.ts so surfaces that
// only need the names (e.g. the in-palette settings dropdown, injected into
// every page) don't bundle all the animation code.

export interface BackdropMeta {
  id: string
  label: string
}

/** Order here drives the settings picker and the registry. */
export const BACKDROP_META: BackdropMeta[] = [
  { id: 'mountain-river', label: 'Mountain river' },
  { id: 'misty-coast', label: 'Misty coast' },
  { id: 'desert-light', label: 'Desert light' },
  { id: 'forest-dusk', label: 'Forest dusk' },
  { id: 'moonlit-lake', label: 'Moonlit lake' },
  { id: 'enchanted-forest', label: 'Enchanted forest' },
  { id: 'alpine-dawn', label: 'Alpine dawn' },
  { id: 'volcanic-coast', label: 'Volcanic coast' },
  { id: 'rainy-city', label: 'Rainy city' },
  { id: 'riverside-city', label: 'Riverside city' },
  { id: 'liquid-ribbons', label: 'Liquid ribbons' },
  { id: 'peach-gel', label: 'Peach gel' },
  { id: 'pastel-blobs', label: 'Pastel blobs' },
  { id: 'silk-plume', label: 'Silk plume' },
  { id: 'light-columns', label: 'Light columns' },
  { id: 'color-marbling', label: 'Color marbling' },
  { id: 'neon-liquid', label: 'Neon liquid' },
  { id: 'charcoal-folds', label: 'Charcoal folds' },
  { id: 'dark-facets', label: 'Dark facets' },
  { id: 'woven-sand', label: 'Woven sand' },
  { id: 'woven-sage', label: 'Woven sage' },
  { id: 'woven-blue', label: 'Woven blue' },
  { id: 'chevron-gold', label: 'Chevron gold' },
  { id: 'chevron-ink', label: 'Chevron ink' },
  { id: 'interlock-blue', label: 'Interlock blue' },
  { id: 'interlock-olive', label: 'Interlock olive' },
  { id: 'fluid', label: 'Fluid' },
  { id: 'quiet', label: 'Quiet abstract' },
  { id: 'none', label: 'None' },
]

export const DEFAULT_BACKDROP_ID = 'mountain-river'

export function normalizeBackdropId(id: string | undefined): string {
  return BACKDROP_META.some((entry) => entry.id === id) ? id! : DEFAULT_BACKDROP_ID
}
