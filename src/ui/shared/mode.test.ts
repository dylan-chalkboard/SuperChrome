import { describe, expect, it } from 'vitest'
import { MODE_PLACEHOLDERS, MODE_PREFIX, PREFIX_CHARS, mode } from './mode'

describe('find mode', () => {
  it('maps the "." prefix to the find mode', () => {
    expect(mode('.')).toBe('find')
  })
  it('registers "." as a prefix char', () => {
    expect(PREFIX_CHARS.includes('.')).toBe(true)
  })
  it('exposes a find placeholder and prefix', () => {
    expect(MODE_PREFIX.find).toBe('.')
    expect(MODE_PLACEHOLDERS.find).toBe('Find & click anything on this page…')
  })
  it('still maps unknown prefixes to bookmarks', () => {
    expect(mode('')).toBe('bookmarks')
  })
})
