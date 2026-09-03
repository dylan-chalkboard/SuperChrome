import { describe, expect, it } from 'vitest'
import { halves } from './tile'

describe('halves', () => {
  it('splits bounds side by side with full coverage', () => {
    const { left, right } = halves({ left: 100, top: 50, width: 1201, height: 800 })
    expect(left).toEqual({ left: 100, top: 50, width: 601, height: 800 })
    expect(right).toEqual({ left: 701, top: 50, width: 600, height: 800 })
    expect(left.width + right.width).toBe(1201)
  })
})
