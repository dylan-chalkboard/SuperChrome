import { describe, expect, it } from 'vitest'
import { FIND_CAP, findMatches } from './index'

const idx = (...texts: string[]) => texts.map((text) => ({ text }))

describe('findMatches', () => {
  it('finds a single occurrence with correct offsets', () => {
    const r = findMatches(idx('hello world'), 'world')
    expect(r.matches).toEqual([{ nodeIndex: 0, start: 6, end: 11 }])
    expect(r.total).toBe(1)
    expect(r.capped).toBe(false)
  })

  it('is case-insensitive', () => {
    const r = findMatches(idx('The WORK of work'), 'work')
    expect(r.matches.map((m) => [m.start, m.end])).toEqual([
      [4, 8],
      [12, 16],
    ])
  })

  it('enumerates matches across nodes in document order', () => {
    const r = findMatches(idx('alpha', 'beta alpha', 'alpha'), 'alpha')
    expect(r.matches.map((m) => m.nodeIndex)).toEqual([0, 1, 2])
    expect(r.total).toBe(3)
  })

  it('finds every occurrence within one node', () => {
    const r = findMatches(idx('aaaa'), 'aa')
    // non-overlapping: positions 0 and 2
    expect(r.matches.map((m) => m.start)).toEqual([0, 2])
  })

  it('returns nothing for empty or whitespace queries', () => {
    expect(findMatches(idx('hello'), '')).toEqual({ matches: [], total: 0, capped: false })
    expect(findMatches(idx('hello'), '   ')).toEqual({ matches: [], total: 0, capped: false })
  })

  it('caps matches but reports the true total', () => {
    const many = idx('x '.repeat(FIND_CAP + 50).trim())
    const r = findMatches(many, 'x', 5)
    expect(r.matches).toHaveLength(5)
    expect(r.total).toBe(FIND_CAP + 50)
    expect(r.capped).toBe(true)
  })
})
