import { describe, expect, it } from 'vitest'
import { folderSvg } from './colors'

describe('folderSvg', () => {
  it('renders the preset pair for a named color', () => {
    expect(folderSvg('red')).toContain('#e05d5d')
    expect(folderSvg('red')).toContain('#ef8f8f')
  })
  it('falls back to blue for unset or unknown colors', () => {
    expect(folderSvg(null)).toContain('#3f97ee')
    expect(folderSvg(undefined)).toContain('#3f97ee')
    expect(folderSvg('nope')).toContain('#3f97ee')
  })
})
