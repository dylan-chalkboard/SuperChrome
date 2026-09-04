import { describe, expect, it } from 'vitest'
import { renderTemplate, templateArguments } from './placeholders'

const NOW = new Date('2026-09-04T15:30:45')

describe('templateArguments', () => {
  it('finds anonymous arguments positionally', () => {
    const args = templateArguments('https://x.com/{argument}/{argument}')
    expect(args).toHaveLength(2)
    expect(args[0].key).not.toBe(args[1].key)
    expect(args[0].name).toBe('')
  })
  it('dedupes named arguments and keeps template order', () => {
    const args = templateArguments('https://github.com/{argument name="org"}/{argument name="repo"}/tree/{argument name="org"}')
    expect(args.map((a) => a.name)).toEqual(['org', 'repo'])
  })
  it('treats {query} as an argument alias', () => {
    expect(templateArguments('https://g.com/?q={query}')).toHaveLength(1)
  })
  it('parses defaults and simple options', () => {
    const [arg] = templateArguments('https://x.com/{argument name="lang" default="en" options="en, es, fr"}')
    expect(arg.default).toBe('en')
    expect(arg.options).toEqual([
      { label: 'en', value: 'en' },
      { label: 'es', value: 'es' },
      { label: 'fr', value: 'fr' },
    ])
  })
  it('parses Label|value options', () => {
    const [arg] = templateArguments('https://yt.com/?sp={argument name="filter" options="Videos|EgIQAQ, Channels|EgIQAg"}')
    expect(arg.options).toEqual([
      { label: 'Videos', value: 'EgIQAQ' },
      { label: 'Channels', value: 'EgIQAg' },
    ])
  })
  it('ignores non-argument placeholders and unknown types', () => {
    expect(templateArguments('https://x.com/{clipboard}/{date}/{nonsense}')).toEqual([])
  })
})

describe('renderTemplate', () => {
  it('substitutes and percent-encodes argument values by default', () => {
    const args = templateArguments('https://g.com/?q={argument}')
    expect(renderTemplate('https://g.com/?q={argument}', { args: { [args[0].key]: 'lofi beats' } }))
      .toBe('https://g.com/?q=lofi%20beats')
  })
  it('fills named arguments everywhere they appear', () => {
    const tpl = 'https://github.com/{argument name="org"}/{argument name="org"}.wiki'
    expect(renderTemplate(tpl, { args: { org: 'raycast' } })).toBe('https://github.com/raycast/raycast.wiki')
  })
  it('falls back to defaults for missing arguments', () => {
    expect(renderTemplate('https://x.com/{argument name="lang" default="en"}', {})).toBe('https://x.com/en')
  })
  it('substitutes clipboard and selection', () => {
    expect(renderTemplate('https://g.com/?q={clipboard}', { clipboard: 'a b' })).toBe('https://g.com/?q=a%20b')
    expect(renderTemplate('https://g.com/?q={selection}', { selection: 'x&y' })).toBe('https://g.com/?q=x%26y')
  })
  it('applies modifiers in order and raw disables encoding', () => {
    expect(renderTemplate('https://x.com/{argument | trim | uppercase}', { args: { '#0': '  hi there ' } }))
      .toBe('https://x.com/HI%20THERE')
    expect(renderTemplate('https://x.com/{argument | raw}', { args: { '#0': 'a/b' } })).toBe('https://x.com/a/b')
    expect(renderTemplate('https://x.com/{clipboard | lowercase}', { clipboard: 'AB' })).toBe('https://x.com/ab')
  })
  it('formats dates with format and offset attributes', () => {
    expect(renderTemplate('{date format="yyyy-MM-dd"}', { now: NOW })).toBe('2026-09-04')
    expect(renderTemplate('{date format="yyyy-MM-dd" offset="+2d"}', { now: NOW })).toBe('2026-09-06')
    expect(renderTemplate('{date format="yyyy-MM"} {time format="HH:mm"}', { now: NOW })).toBe('2026-09 15:30')
    expect(renderTemplate('{day}', { now: NOW })).toBe('Friday')
  })
  it('generates uuids via the injectable factory', () => {
    expect(renderTemplate('id-{uuid}', { uuid: () => 'abc-123' })).toBe('id-abc-123')
  })
  it('leaves unknown placeholders as literal text', () => {
    expect(renderTemplate('https://x.com/{nonsense}?b={a b}', {})).toBe('https://x.com/{nonsense}?b={a b}')
  })
  it('keeps dropdown option values verbatim but still encodes', () => {
    const tpl = 'https://yt.com/?sp={argument name="filter" options="Videos|EgIQAQ%3D"}'
    expect(renderTemplate(tpl, { args: { filter: 'EgIQAQ%3D' }, })).toBe('https://yt.com/?sp=EgIQAQ%253D')
    expect(renderTemplate(tpl.replace('}', ' | raw}'), { args: { filter: 'EgIQAQ%3D' } })).toBe('https://yt.com/?sp=EgIQAQ%3D')
  })
})
