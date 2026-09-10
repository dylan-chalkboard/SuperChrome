import { describe, it, expect } from 'vitest'
import { backdropVariant } from './backdrop'

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
