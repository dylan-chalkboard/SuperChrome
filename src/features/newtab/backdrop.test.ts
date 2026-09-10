import { describe, it, expect } from 'vitest'
import { backdropVariant, dotInk } from './backdrop'

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

describe('dotInk', () => {
  it('is white on the dark theme', () => {
    expect(dotInk('dark', 0.8)).toBe('rgba(255,255,255,0.8)')
  })
  it('is near-black on the light theme', () => {
    expect(dotInk('light', 0.5)).toBe('rgba(18,22,38,0.5)')
  })
})
