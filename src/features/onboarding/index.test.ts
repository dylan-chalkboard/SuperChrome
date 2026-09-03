import { describe, expect, it } from 'vitest'
import { ONBOARD_STEPS, onboardComplete, onboardProgress, onboardVisible } from './index'

describe('onboarding', () => {
  it('counts progress over the defined steps only', () => {
    expect(onboardProgress({ done: {} })).toBe(0)
    expect(onboardProgress({ done: { hotkey: true, tab: true, bogus: true } })).toBe(2)
  })
  it('completes only when every step is done', () => {
    const all = Object.fromEntries(ONBOARD_STEPS.map((s) => [s.key, true]))
    expect(onboardComplete({ done: all })).toBe(true)
    expect(onboardComplete({ done: { ...all, hotkey: false } })).toBe(false)
  })
  it('hides when dismissed or complete', () => {
    const all = Object.fromEntries(ONBOARD_STEPS.map((s) => [s.key, true]))
    expect(onboardVisible({ done: {} })).toBe(true)
    expect(onboardVisible({ done: {}, dismissed: true })).toBe(false)
    expect(onboardVisible({ done: all })).toBe(false)
  })
})
