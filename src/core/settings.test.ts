import { describe, expect, it } from 'vitest'
import {
  clampPaletteScale,
  PALETTE_SCALE_MIN,
  PALETTE_SCALE_MAX,
  DEFAULT_SETTINGS,
} from './settings'

describe('clampPaletteScale', () => {
  it('keeps in-range values untouched', () => {
    expect(clampPaletteScale(1)).toBe(1)
    expect(clampPaletteScale(1.15)).toBe(1.15)
    expect(clampPaletteScale(PALETTE_SCALE_MIN)).toBe(PALETTE_SCALE_MIN)
    expect(clampPaletteScale(PALETTE_SCALE_MAX)).toBe(PALETTE_SCALE_MAX)
  })

  it('clamps out-of-range values to the bounds', () => {
    expect(clampPaletteScale(0.1)).toBe(PALETTE_SCALE_MIN)
    expect(clampPaletteScale(5)).toBe(PALETTE_SCALE_MAX)
  })

  it('falls back to 1 for non-numeric input', () => {
    expect(clampPaletteScale(undefined)).toBe(1)
    expect(clampPaletteScale(NaN)).toBe(1)
    expect(clampPaletteScale('nope')).toBe(1)
  })

  it('parses numeric strings (as range inputs supply them)', () => {
    expect(clampPaletteScale('1.3')).toBe(1.3)
  })

  it('defaults palette scale to 1', () => {
    expect(DEFAULT_SETTINGS.paletteScale).toBe(1)
  })
})
