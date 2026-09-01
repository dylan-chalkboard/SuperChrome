import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ago,
  basename,
  collectBookmarks,
  collectFolders,
  fileType,
  frecency,
  fuzzyMatch,
  hostOf,
  rank,
  tryCalculate,
} from './lib'
import type { BookmarkNodeLike, UsageMap } from './lib'

const NOW = new Date('2026-09-01T12:00:00Z').getTime()
const DAY = 86_400_000

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})
afterEach(() => {
  vi.useRealTimers()
})

describe('fuzzyMatch', () => {
  it('returns zero score and no positions for an empty query', () => {
    expect(fuzzyMatch('', 'anything')).toEqual({ score: 0, positions: [] })
  })

  it('matches subsequences and reports positions', () => {
    const match = fuzzyMatch('ghb', 'github')!
    expect(match).not.toBeNull()
    expect(match.positions).toEqual([0, 3, 5])
  })

  it('returns null when the query is not a subsequence', () => {
    expect(fuzzyMatch('xyz', 'github')).toBeNull()
    expect(fuzzyMatch('github extra', 'github')).toBeNull()
  })

  it('scores word-start and consecutive matches higher', () => {
    const wordStart = fuzzyMatch('dev', 'dev tools')!
    const buried = fuzzyMatch('dev', 'saved evidence')!
    expect(wordStart.score).toBeGreaterThan(buried.score)
  })

  it('prefers shorter texts on equal matches', () => {
    const short = fuzzyMatch('news', 'news')!
    const long = fuzzyMatch('news', 'news and other stories')!
    expect(short.score).toBeGreaterThan(long.score)
  })
})

describe('frecency', () => {
  it('is zero for unknown keys', () => {
    expect(frecency({}, 'bookmark:x', 14)).toBe(0)
  })

  it('equals the count for a just-used key and decays over time', () => {
    const usage: UsageMap = {
      fresh: { n: 4, t: NOW },
      stale: { n: 4, t: NOW - 14 * DAY },
    }
    expect(frecency(usage, 'fresh', 14)).toBeCloseTo(4)
    expect(frecency(usage, 'stale', 14)).toBeCloseTo(4 / Math.E)
  })

  it('decays faster with a shorter half-life', () => {
    const usage: UsageMap = { key: { n: 4, t: NOW - 7 * DAY } }
    expect(frecency(usage, 'key', 7)).toBeLessThan(frecency(usage, 'key', 28))
  })
})

describe('rank', () => {
  const entries = [
    { item: { name: 'alpha' }, text: 'alpha', usageKey: 'a' },
    { item: { name: 'beta' }, text: 'beta', usageKey: 'b' },
    { item: { name: 'alphabet' }, text: 'alphabet', usageKey: 'c' },
  ]

  it('preserves original order on an empty query with no usage', () => {
    const result = rank(entries, '', {})
    expect(result.map((r) => r.name)).toEqual(['alpha', 'beta', 'alphabet'])
  })

  it('boosts frequently used items on an empty query', () => {
    const usage: UsageMap = { b: { n: 5, t: NOW } }
    const result = rank(entries, '', usage)
    expect(result[0].name).toBe('beta')
  })

  it('filters non-matches and attaches positions when querying', () => {
    const result = rank(entries, 'alpha', {})
    expect(result.map((r) => r.name)).toEqual(['alpha', 'alphabet'])
    expect(result[0].positions).toEqual([0, 1, 2, 3, 4])
  })

  it('lets heavy usage outrank a slightly better text match', () => {
    const usage: UsageMap = { c: { n: 10, t: NOW } }
    const result = rank(entries, 'alpha', usage)
    expect(result[0].name).toBe('alphabet')
  })

  it('does not attach positions on an empty query', () => {
    const result = rank(entries, '', {})
    expect(result[0].positions).toBeUndefined()
  })
})

describe('tryCalculate', () => {
  it.each([
    ['142*12', '1704'],
    ['18% of 240', '43.2'],
    ['2^10', '1024'],
    ['(3+4)*2', '14'],
    ['-5 + 3', '-2'],
    ['1,500/3', '500'],
    ['10 x 4', '40'],
    ['0.1+0.2', '0.3'],
    ['2^-1', '0.5'],
    ['pi*2', String(Number((Math.PI * 2).toPrecision(12)))],
  ])('evaluates %s to %s', (input, expected) => {
    expect(tryCalculate(input)).toBe(expected)
  })

  it.each([
    ['github'],
    ['3d printer'],
    ['hello + world'],
    ['1+'],
    ['(2+3'],
    ['2**3'],
    ['1/0'],
    [''],
    ['9'.repeat(70)],
  ])('rejects %s', (input) => {
    expect(tryCalculate(input)).toBeNull()
  })
})

describe('hostOf', () => {
  it('extracts lowercase hostnames', () => {
    expect(hostOf('https://GitHub.com/dylan')).toBe('github.com')
  })
  it('returns null for missing or invalid urls', () => {
    expect(hostOf(undefined)).toBeNull()
    expect(hostOf('not a url')).toBeNull()
  })
})

describe('basename', () => {
  it('returns the last path segment', () => {
    expect(basename('/Users/dylan/Downloads/report.pdf')).toBe('report.pdf')
    expect(basename('plain.txt')).toBe('plain.txt')
  })
})

describe('ago', () => {
  it('formats durations', () => {
    expect(ago(NOW)).toBe('just now')
    expect(ago(NOW - 5 * 60_000)).toBe('5m ago')
    expect(ago(NOW - 3 * 3_600_000)).toBe('3h ago')
    expect(ago(NOW - 2 * DAY)).toBe('2d ago')
  })
})

describe('fileType', () => {
  it.each([
    ['report.pdf', 'doc', '#e05d5d'],
    ['photo.JPG', 'image', '#9a6ee8'],
    ['clip.mov', 'film', '#e57fb3'],
    ['song.flac', 'music', '#e8964a'],
    ['bundle.tar', 'archive', '#e8c341'],
    ['script.ts', 'code', '#4c9df3'],
    ['sheet.xlsx', 'table', '#4caf7d'],
    ['installer.dmg', 'download', '#8e8e93'],
    ['mystery.bin', 'doc', '#3aa99f'],
  ])('classifies %s', (filename, icon, color) => {
    expect(fileType(filename)).toEqual({ icon, color })
  })
})

describe('bookmark tree walkers', () => {
  const tree: BookmarkNodeLike = {
    id: '1',
    title: 'Bookmarks Bar',
    children: [
      {
        id: '10',
        title: 'Dev',
        children: [
          { id: '100', title: 'GitHub', url: 'https://github.com' },
          { id: '11', title: 'Docs', children: [{ id: '110', title: '', url: 'https://mdn.io' }] },
        ],
      },
      { id: '20', title: 'News', url: 'https://news.ycombinator.com' },
    ],
  }

  it('collects bookmarks with their folder paths', () => {
    const out: Array<{ id: string; title: string; url: string; path: string }> = []
    collectBookmarks(tree, [], out)
    expect(out).toEqual([
      { id: '100', title: 'GitHub', url: 'https://github.com', path: 'Dev' },
      { id: '110', title: 'https://mdn.io', url: 'https://mdn.io', path: 'Dev / Docs' },
      { id: '20', title: 'News', url: 'https://news.ycombinator.com', path: '' },
    ])
  })

  it('collects nested folders with full paths', () => {
    const out: Array<{ id: string; path: string }> = []
    collectFolders(tree, [], out)
    expect(out).toEqual([
      { id: '10', path: 'Dev' },
      { id: '11', path: 'Dev / Docs' },
    ])
  })
})
