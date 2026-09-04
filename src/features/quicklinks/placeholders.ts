/* ---------- Quicklink dynamic placeholders: {argument}, {clipboard}, {date}… ---------- */

export interface ArgumentSpec {
  /** Stable lookup key: the name, or '#0'/'#1' for anonymous arguments. */
  key: string
  name: string
  default?: string
  options?: Array<{ label: string; value: string }>
}

type PlaceholderType =
  | 'argument'
  | 'clipboard'
  | 'selection'
  | 'date'
  | 'time'
  | 'datetime'
  | 'day'
  | 'uuid'

interface Placeholder {
  type: PlaceholderType
  arg?: ArgumentSpec
  attrs: Record<string, string>
  modifiers: string[]
}

type Segment = { text: string } | { placeholder: Placeholder }

export interface RenderContext {
  args?: Record<string, string>
  clipboard?: string
  selection?: string
  now?: Date
  uuid?: () => string
}

const TYPES = new Set<string>([
  'argument',
  'query',
  'clipboard',
  'selection',
  'date',
  'time',
  'datetime',
  'day',
  'uuid',
])

/** Split on '|' at the top level only — pipes inside quoted attributes stay put. */
function splitPipes(content: string): string[] {
  const parts: string[] = []
  let current = ''
  let quoted = false
  for (const ch of content) {
    if (ch === '"') quoted = !quoted
    if (ch === '|' && !quoted) {
      parts.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  parts.push(current)
  return parts
}

export function parseTemplate(template: string): Segment[] {
  const segments: Segment[] = []
  let anon = 0
  let last = 0
  const braces = /\{([^{}]*)\}/g
  for (let m = braces.exec(template); m; m = braces.exec(template)) {
    const [pipeHead, ...pipeRest] = splitPipes(m[1])
    const head = pipeHead.trim()
    const typeMatch = /^([a-z-]+)\s*(.*)$/s.exec(head)
    let type = typeMatch?.[1] ?? ''
    const attrText = typeMatch?.[2] ?? ''
    const attrs: Record<string, string> = {}
    let consumed = ''
    for (const a of attrText.matchAll(/(\w+)="([^"]*)"/g)) {
      attrs[a[1]] = a[2]
      consumed += a[0]
    }
    const leftover = attrText.replace(/(\w+)="([^"]*)"/g, '').trim()
    const known = TYPES.has(type) && !leftover && consumed.length <= attrText.length
    if (!known) continue // leave the braces as literal text
    if (type === 'query') type = 'argument'

    if (last < m.index) segments.push({ text: template.slice(last, m.index) })
    last = m.index + m[0].length

    const placeholder: Placeholder = {
      type: type as PlaceholderType,
      attrs,
      modifiers: pipeRest.map((p) => p.trim().toLowerCase()).filter(Boolean),
    }
    if (placeholder.type === 'argument') {
      const name = attrs.name ?? ''
      placeholder.arg = {
        key: name || `#${anon++}`,
        name,
        default: attrs.default,
        options: attrs.options
          ? attrs.options
              .split(',')
              .map((opt) => opt.trim())
              .filter(Boolean)
              .map((opt) => {
                const bar = opt.indexOf('|')
                return bar < 0
                  ? { label: opt, value: opt }
                  : { label: opt.slice(0, bar).trim(), value: opt.slice(bar + 1).trim() }
              })
          : undefined,
      }
    }
    segments.push({ placeholder })
  }
  if (last < template.length) segments.push({ text: template.slice(last) })
  return segments
}

/** The prompts a template needs, in order, deduped by key. */
export function templateArguments(template: string): ArgumentSpec[] {
  const seen = new Set<string>()
  const args: ArgumentSpec[] = []
  for (const seg of parseTemplate(template)) {
    if ('placeholder' in seg && seg.placeholder.arg && !seen.has(seg.placeholder.arg.key)) {
      seen.add(seg.placeholder.arg.key)
      args.push(seg.placeholder.arg)
    }
  }
  return args
}

/**
 * Autocomplete for the create form: the caret sits right after a typed '{';
 * swap that brace for the full snippet. Null when the trigger isn't there.
 */
export function completePlaceholder(
  text: string,
  caret: number,
  snippet: string,
): { text: string; caret: number } | null {
  if (text[caret - 1] !== '{') return null
  const next = text.slice(0, caret - 1) + snippet + text.slice(caret)
  return { text: next, caret: caret - 1 + snippet.length }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function applyOffset(date: Date, offset: string): Date {
  const d = new Date(date)
  for (const m of offset.matchAll(/([+-]\d+)\s*([mhdMy])/g)) {
    const n = Number(m[1])
    if (m[2] === 'm') d.setMinutes(d.getMinutes() + n)
    else if (m[2] === 'h') d.setHours(d.getHours() + n)
    else if (m[2] === 'd') d.setDate(d.getDate() + n)
    else if (m[2] === 'M') d.setMonth(d.getMonth() + n)
    else d.setFullYear(d.getFullYear() + n)
  }
  return d
}

function formatDate(date: Date, format: string): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  const h12 = ((date.getHours() + 11) % 12) + 1
  return format.replace(/yyyy|yy|MMM|MM|M|dd|d|HH|H|hh|h|mm|ss|a/g, (token) => {
    switch (token) {
      case 'yyyy': return String(date.getFullYear())
      case 'yy': return pad(date.getFullYear() % 100)
      case 'MMM': return MONTHS[date.getMonth()]
      case 'MM': return pad(date.getMonth() + 1)
      case 'M': return String(date.getMonth() + 1)
      case 'dd': return pad(date.getDate())
      case 'd': return String(date.getDate())
      case 'HH': return pad(date.getHours())
      case 'H': return String(date.getHours())
      case 'hh': return pad(h12)
      case 'h': return String(h12)
      case 'mm': return pad(date.getMinutes())
      case 'ss': return pad(date.getSeconds())
      default: return date.getHours() < 12 ? 'am' : 'pm'
    }
  })
}

const DEFAULT_FORMATS: Record<string, string> = {
  date: 'd MMM yyyy',
  time: 'h:mm a',
  datetime: 'd MMM yyyy h:mm a',
}

/**
 * Substitute every placeholder. User content (argument/clipboard/selection)
 * percent-encodes by default — `raw` opts out; generated values (dates, uuid)
 * render as-is unless `percent-encode` is asked for.
 */
export function renderTemplate(template: string, ctx: RenderContext): string {
  return parseTemplate(template)
    .map((seg) => {
      if ('text' in seg) return seg.text
      const p = seg.placeholder
      const userContent = p.type === 'argument' || p.type === 'clipboard' || p.type === 'selection'
      let value: string
      switch (p.type) {
        case 'argument':
          value = ctx.args?.[p.arg!.key] ?? p.arg!.default ?? ''
          break
        case 'clipboard':
          value = ctx.clipboard ?? ''
          break
        case 'selection':
          value = ctx.selection ?? ''
          break
        case 'uuid':
          value = (ctx.uuid ?? (() => crypto.randomUUID()))()
          break
        case 'day': {
          const now = applyOffset(ctx.now ?? new Date(), p.attrs.offset ?? '')
          value = DAYS[now.getDay()]
          break
        }
        default: {
          const now = applyOffset(ctx.now ?? new Date(), p.attrs.offset ?? '')
          value = formatDate(now, p.attrs.format ?? DEFAULT_FORMATS[p.type])
        }
      }
      let encoded = false
      let raw = false
      for (const mod of p.modifiers) {
        if (mod === 'trim') value = value.trim()
        else if (mod === 'uppercase') value = value.toUpperCase()
        else if (mod === 'lowercase') value = value.toLowerCase()
        else if (mod === 'percent-encode') {
          value = encodeURIComponent(value)
          encoded = true
        } else if (mod === 'raw') raw = true
      }
      return raw || encoded || !userContent ? value : encodeURIComponent(value)
    })
    .join('')
}
