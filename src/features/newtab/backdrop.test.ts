import { describe, it, expect } from 'vitest'
import { backdropVariant, dotColor } from './backdrop'

describe('backdropVariant', () => {
  it('honors explicit light', () => {
    expect(backdropVariant('light', false)).toBe('light')
  })
  it('honors explicit dark even when system prefers light', () => {
    expect(backdropVariant('dark', true)).toBe('dark')
  })
  it('follows system preference when set to system', () => {
    expect(backdropVariant('system', true)).toBe('light')
    expect(backdropVariant('system', false)).toBe('dark')
  })
})

describe('dotColor', () => {
  it('is pink at the left edge', () => {
    expect(dotColor(0, 1)).toBe('rgba(255,47,176,1)')
  })
  it('is purple in the middle', () => {
    expect(dotColor(0.5, 1)).toBe('rgba(139,92,246,1)')
  })
  it('is cyan at the right edge', () => {
    expect(dotColor(1, 0.5)).toBe('rgba(34,211,238,0.5)')
  })
  it('clamps out-of-range positions', () => {
    expect(dotColor(-1, 1)).toBe('rgba(255,47,176,1)')
    expect(dotColor(2, 1)).toBe('rgba(34,211,238,1)')
  })
})
