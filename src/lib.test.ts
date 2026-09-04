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
  DEFAULT_QUICKLINKS,
  matchQuicklink,
  parseQuicklinks,
  parseSnippets,
  preserveQuicklinkExtras,
  serializeQuicklinks,
  serializeSnippets,
  tileGradient,
  tryCalculate,
  tryConvert,
  urlFromQuery,
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

describe('snippets', () => {
  it('parses ----separated blocks with name on the first line', () => {
    const text = 'sig\nBest,\nDylan\n---\naddr\n123 Main St\nBrooklyn, NY'
    expect(parseSnippets(text)).toEqual([
      { name: 'sig', text: 'Best,\nDylan' },
      { name: 'addr', text: '123 Main St\nBrooklyn, NY' },
    ])
  })
  it('preserves blank lines inside a body and drops empty blocks', () => {
    const text = 'letter\nHi there,\n\nThanks!\n---\n\n---\nnameonly'
    expect(parseSnippets(text)).toEqual([{ name: 'letter', text: 'Hi there,\n\nThanks!' }])
  })
  it('round-trips through serialize', () => {
    const snippets = [
      { name: 'sig', text: 'Best,\nDylan' },
      { name: 'poem', text: 'line one\n\nline three' },
    ]
    expect(parseSnippets(serializeSnippets(snippets))).toEqual(snippets)
  })
})

describe('quicklinks', () => {
  const DASH = { keyword: 'dash', name: 'Team Dashboard', template: 'https://example.com/dash' }
  const REPO = {
    keyword: 'repo',
    name: 'GitHub Repo',
    template: 'https://github.com/{argument name="org"}/{argument name="repo"}',
  }

  it('matches a keyword with trailing text as the first argument', () => {
    const m = matchQuicklink('yt lofi beats', DEFAULT_QUICKLINKS)
    expect(m?.link.name).toBe('YouTube')
    expect(m?.rest).toBe('lofi beats')
    expect(m?.args).toHaveLength(1)
  })
  it('matches a bare keyword on an arg-ful link for the prompt flow', () => {
    expect(matchQuicklink('yt', DEFAULT_QUICKLINKS)?.rest).toBe('')
    expect(matchQuicklink('yt ', DEFAULT_QUICKLINKS)?.rest).toBe('')
    expect(matchQuicklink('unknown thing', DEFAULT_QUICKLINKS)).toBeNull()
  })
  it('is case-insensitive on the keyword', () => {
    expect(matchQuicklink('GH superchrome', DEFAULT_QUICKLINKS)?.link.name).toBe('GitHub')
  })
  it('surfaces multiple named arguments in order', () => {
    expect(matchQuicklink('repo', [REPO])?.args.map((a) => a.name)).toEqual(['org', 'repo'])
  })
  it('matches a static link only on its bare keyword', () => {
    const m = matchQuicklink('dash', [DASH])
    expect(m?.link.template).toBe('https://example.com/dash')
    expect(m?.args).toEqual([])
    expect(matchQuicklink('DASH ', [DASH])).not.toBeNull()
    expect(matchQuicklink('dash foo', [DASH])).toBeNull()
  })
  it('parses and serializes the options-page text format', () => {
    const text = 'yt | YouTube | https://youtube.com/results?q={query}\nbad line\nnp | npm | https://npmjs.com/search?q={query}'
    const links = parseQuicklinks(text)
    expect(links).toHaveLength(2)
    expect(links[1]).toEqual({ keyword: 'np', name: 'npm', template: 'https://npmjs.com/search?q={query}' })
    expect(parseQuicklinks(serializeQuicklinks(links))).toEqual(links)
  })
  it('keeps static templates without {query} and round-trips them', () => {
    const links = parseQuicklinks('x | X | https://example.com')
    expect(links).toEqual([{ keyword: 'x', name: 'X', template: 'https://example.com' }])
    expect(parseQuicklinks(serializeQuicklinks(links))).toEqual(links)
  })
  it('allows pipes inside the template (dropdown options)', () => {
    const line = 'yt2 | YT Filtered | https://yt.com/?sp={argument options="Videos|EgIQAQ, Channels|EgIQAg"}'
    const links = parseQuicklinks(line)
    expect(links).toHaveLength(1)
    expect(links[0].template).toBe('https://yt.com/?sp={argument options="Videos|EgIQAQ, Channels|EgIQAg"}')
    expect(parseQuicklinks(serializeQuicklinks(links))).toEqual(links)
  })
  it('preserves colors and icons across textarea round-trips', () => {
    const existing = [
      { keyword: 'dash', name: 'Dash', template: 'https://d.com', color: '#e05d5d', icon: '🚀' },
      { keyword: 'g', name: 'Google', template: 'https://g.com/?q={query}' },
    ]
    const edited = parseQuicklinks('dash | Dashboard | https://d.com\nnew | New | https://n.com')
    const merged = preserveQuicklinkExtras(edited, existing)
    expect(merged[0]).toEqual({
      keyword: 'dash',
      name: 'Dashboard',
      template: 'https://d.com',
      color: '#e05d5d',
      icon: '🚀',
    })
    expect(merged[1]).toEqual({ keyword: 'new', name: 'New', template: 'https://n.com' })
  })
})

describe('tryConvert', () => {
  it('converts lengths', () => {
    expect(tryConvert('5km in miles')).toBe('3.10686 mi')
    expect(tryConvert('6ft in cm')).toBe('182.88 cm')
    expect(tryConvert('26.2 miles to km')).toBe('42.1648 km')
  })
  it('converts mass, time, and data', () => {
    expect(tryConvert('150lb in kg')).toBe('68.0389 kg')
    expect(tryConvert('3h in min')).toBe('180 min')
    expect(tryConvert('1.5gb in mb')).toBe('1500 MB')
  })
  it('converts temperatures', () => {
    expect(tryConvert('72f in c')).toBe('22.2222 °C')
    expect(tryConvert('100c to f')).toBe('212 °F')
    expect(tryConvert('0c in k')).toBe('273.15 K')
  })
  it('rejects mismatched groups and non-conversions', () => {
    expect(tryConvert('5km in kg')).toBeNull()
    expect(tryConvert('5 in miles')).toBeNull()
    expect(tryConvert('google.com')).toBeNull()
    expect(tryConvert('2+2')).toBeNull()
  })
})

describe('urlFromQuery', () => {
  it('turns bare domains into https URLs', () => {
    expect(urlFromQuery('google.com')).toBe('https://google.com')
    expect(urlFromQuery('amazon.com')).toBe('https://amazon.com')
    expect(urlFromQuery(' news.ycombinator.com ')).toBe('https://news.ycombinator.com')
  })
  it('keeps explicit schemes, ports, and paths', () => {
    expect(urlFromQuery('http://example.com/a?b=1')).toBe('http://example.com/a?b=1')
    expect(urlFromQuery('github.com/dylan/repo')).toBe('https://github.com/dylan/repo')
    expect(urlFromQuery('example.com:8080/health')).toBe('https://example.com:8080/health')
  })
  it('uses http for localhost', () => {
    expect(urlFromQuery('localhost:3000')).toBe('http://localhost:3000')
    expect(urlFromQuery('localhost')).toBe('http://localhost')
  })
  it('rejects search phrases', () => {
    expect(urlFromQuery('best pizza near me')).toBeNull()
    expect(urlFromQuery('google')).toBeNull()
    expect(urlFromQuery('what is amazon.com')).toBeNull()
    expect(urlFromQuery('')).toBeNull()
  })
})

describe('tileGradient', () => {
  it('turns a color into a two-stop hue-shifted gradient', () => {
    expect(tileGradient('#4c9df3')).toBe('linear-gradient(135deg, #4cd5f3, #4c65f3)')
  })
  it('keeps lightness so both stops stay in the same brightness range', () => {
    const stops = tileGradient('#e0a63c').match(/#[0-9a-f]{6}/g)!
    expect(stops).toHaveLength(2)
    expect(stops[0]).not.toBe(stops[1])
  })
  it('passes grays through unchanged (no hue to shift)', () => {
    expect(tileGradient('#888888')).toBe('#888888')
  })
  it('passes unparseable values through unchanged', () => {
    expect(tileGradient('red')).toBe('red')
    expect(tileGradient('linear-gradient(#000, #fff)')).toBe('linear-gradient(#000, #fff)')
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
