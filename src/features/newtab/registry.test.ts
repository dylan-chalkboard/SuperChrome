import { describe, it, expect } from 'vitest'
import { BACKDROPS, DEFAULT_BACKDROP_ID, resolveBackdrop } from './registry'

describe('backdrop registry', () => {
  it('every entry has a unique id, a label, and a mount function', () => {
    const ids = new Set<string>()
    for (const b of BACKDROPS) {
      expect(b.id).toBeTruthy()
      expect(b.label).toBeTruthy()
      expect(typeof b.mount).toBe('function')
      expect(ids.has(b.id)).toBe(false)
      ids.add(b.id)
    }
  })

  it('exposes the expected backdrops in order', () => {
    expect(BACKDROPS.map((b) => b.id)).toEqual([
      'mountain-river',
      'misty-coast',
      'desert-light',
      'forest-dusk',
      'moonlit-lake',
      'enchanted-forest',
      'alpine-dawn',
      'volcanic-coast',
      'rainy-city',
      'riverside-city',
      'liquid-ribbons',
      'peach-gel',
      'pastel-blobs',
      'silk-plume',
      'light-columns',
      'color-marbling',
      'neon-liquid',
      'charcoal-folds',
      'dark-facets',
      'woven-sand',
      'woven-sage',
      'woven-blue',
      'chevron-gold',
      'chevron-ink',
      'interlock-blue',
      'interlock-olive',
      'fluid',
      'quiet',
      'none',
    ])
  })

  it('every meta entry has a real mount (no default fallbacks)', () => {
    const fallback = BACKDROPS.find((b) => b.id === DEFAULT_BACKDROP_ID)?.mount
    for (const b of BACKDROPS) {
      if (b.id !== DEFAULT_BACKDROP_ID) expect(b.mount).not.toBe(fallback)
    }
  })

  it('the default id exists in the registry', () => {
    expect(BACKDROPS.some((b) => b.id === DEFAULT_BACKDROP_ID)).toBe(true)
  })
})

describe('resolveBackdrop', () => {
  it('returns the matching backdrop by id', () => {
    expect(resolveBackdrop('fluid').id).toBe('fluid')
  })

  it('falls back to the default for an unknown id', () => {
    expect(resolveBackdrop('nope').id).toBe(DEFAULT_BACKDROP_ID)
  })

  it('falls back to the default for undefined', () => {
    expect(resolveBackdrop(undefined).id).toBe(DEFAULT_BACKDROP_ID)
  })

  it('falls back safely for saved IDs from the old collection', () => {
    expect(resolveBackdrop('dots').id).toBe(DEFAULT_BACKDROP_ID)
    expect(resolveBackdrop('aurora').id).toBe(DEFAULT_BACKDROP_ID)
  })
})
