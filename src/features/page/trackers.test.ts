import { describe, expect, it } from 'vitest'
import { findTrackers } from './trackers'

describe('findTrackers', () => {
  it('matches known tracker endpoints and reports the host as evidence', () => {
    const found = findTrackers([
      'https://www.google-analytics.com/g/collect?v=2',
      'https://static.hotjar.com/c/hotjar-123.js',
      'https://example.com/app.js',
    ])
    expect(found.map((f) => f.name)).toEqual(['Google Analytics', 'Hotjar'])
    expect(found[0].evidence).toBe('www.google-analytics.com')
    expect(found[1].category).toBe('Session Replay')
  })
  it('reports each tracker once and nothing on clean pages', () => {
    expect(
      findTrackers([
        'https://api.mixpanel.com/track',
        'https://cdn.mxpnl.com/libs/mixpanel.js',
      ]),
    ).toHaveLength(1)
    expect(findTrackers(['https://example.com/main.css'])).toEqual([])
  })
})
