import type { MountFn } from './backdrop-core'
import { BACKDROP_META, DEFAULT_BACKDROP_ID } from './backdrop-meta'
import { mountFluid } from './backdrops/fluid'
import {
  mountColorMarbling, mountLightColumns, mountLiquidRibbons, mountNeonLiquid,
  mountPastelBlobs, mountPeachGel, mountSilkPlume,
} from './backdrops/artwork'
import {
  mountAlpineDawn, mountDesertLight, mountEnchantedForest, mountForestDusk,
  mountMistyCoast, mountMoonlitLake, mountMountainRiver, mountRainyCity,
  mountRiversideCity, mountVolcanicCoast,
} from './backdrops/landscape'
import { mountNone } from './backdrops/none'
import {
  mountCharcoalFolds, mountChevronGold, mountChevronInk, mountDarkFacets,
  mountInterlockBlue, mountInterlockOlive, mountWovenBlue, mountWovenSage, mountWovenSand,
} from './backdrops/minimal'
import { mountQuiet } from './backdrops/quiet'

export { DEFAULT_BACKDROP_ID }

export interface BackdropDef {
  id: string
  label: string
  mount: MountFn
}

const MOUNTS: Record<string, MountFn> = {
  'mountain-river': mountMountainRiver,
  'misty-coast': mountMistyCoast,
  'desert-light': mountDesertLight,
  'forest-dusk': mountForestDusk,
  'moonlit-lake': mountMoonlitLake,
  'enchanted-forest': mountEnchantedForest,
  'alpine-dawn': mountAlpineDawn,
  'volcanic-coast': mountVolcanicCoast,
  'rainy-city': mountRainyCity,
  'riverside-city': mountRiversideCity,
  'liquid-ribbons': mountLiquidRibbons,
  'peach-gel': mountPeachGel,
  'pastel-blobs': mountPastelBlobs,
  'silk-plume': mountSilkPlume,
  'light-columns': mountLightColumns,
  'color-marbling': mountColorMarbling,
  'neon-liquid': mountNeonLiquid,
  'charcoal-folds': mountCharcoalFolds,
  'dark-facets': mountDarkFacets,
  'woven-sand': mountWovenSand,
  'woven-sage': mountWovenSage,
  'woven-blue': mountWovenBlue,
  'chevron-gold': mountChevronGold,
  'chevron-ink': mountChevronInk,
  'interlock-blue': mountInterlockBlue,
  'interlock-olive': mountInterlockOlive,
  fluid: mountFluid,
  quiet: mountQuiet,
  none: mountNone,
}

/** Order follows BACKDROP_META, which also drives the settings picker. */
export const BACKDROPS: BackdropDef[] = BACKDROP_META.map((m) => ({
  ...m,
  mount: MOUNTS[m.id] ?? mountMountainRiver,
}))

/** Look up a backdrop by id, falling back to the default for unknown ids. */
export function resolveBackdrop(id: string | undefined): BackdropDef {
  return (
    BACKDROPS.find((b) => b.id === id) ??
    BACKDROPS.find((b) => b.id === DEFAULT_BACKDROP_ID) ??
    BACKDROPS[0]
  )
}
