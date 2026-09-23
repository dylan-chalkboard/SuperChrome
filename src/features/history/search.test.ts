import { describe, expect, it } from 'vitest'
import { dedupeHistory, historyKey } from './search'

describe('historyKey', () => {
  it('collapses same title on same host regardless of path/query', () => {
    const a = historyKey('https://identity.pagerduty.com/global/authn/x', 'PagerDuty Sign In')
    const b = historyKey('https://identity.pagerduty.com/global/authn/y?z=1', 'PagerDuty Sign In')
    expect(a).toBe(b)
  })

  it('keeps same title on different hosts apart', () => {
    const a = historyKey('https://chalkboardhq.pagerduty.com/', '400 Request Header Or Cookie Too Large')
    const b = historyKey('https://identity.pagerduty.com/', '400 Request Header Or Cookie Too Large')
    expect(a).not.toBe(b)
  })

  it('falls back to host+path for untitled rows', () => {
    expect(historyKey('https://example.com/a/', '')).toBe('example.com/a')
    expect(historyKey('https://example.com/a', '')).toBe(historyKey('https://example.com/a/', ''))
  })
})

describe('dedupeHistory', () => {
  it('keeps the first occurrence and drops later duplicates', () => {
    const rows = [
      { url: 'https://id.pd.com/a', label: 'PagerDuty Sign In' },
      { url: 'https://id.pd.com/b', label: 'PagerDuty Sign In' },
      { url: 'https://id.pd.com/c', label: 'PagerDuty Sign In' },
      { url: 'https://linear.app/x', label: 'Linear' },
    ]
    const out = dedupeHistory(rows)
    expect(out).toHaveLength(2)
    expect(out[0].url).toBe('https://id.pd.com/a')
    expect(out[1].label).toBe('Linear')
  })

  it('skips rows without a url', () => {
    expect(dedupeHistory([{ url: undefined, label: 'x' }])).toHaveLength(0)
  })
})
