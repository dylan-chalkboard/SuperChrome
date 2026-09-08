export interface FindNode {
  node: Text
  text: string
}

export interface FindMatch {
  nodeIndex: number
  start: number
  end: number
}

export interface FindResult {
  matches: FindMatch[]
  total: number
  capped: boolean
}

export const FIND_CAP = 200

/**
 * Enumerate every literal, case-insensitive occurrence of `query` across the
 * given text records, in array (document) order. Non-overlapping within a node.
 * `matches` is truncated to `cap`; `total` is the real count; `capped` flags
 * truncation so the UI can show "N / cap+" instead of overstating coverage.
 */
export function findMatches(
  index: Pick<FindNode, 'text'>[],
  query: string,
  cap: number = FIND_CAP,
): FindResult {
  const needle = query.toLowerCase()
  if (needle.trim() === '') return { matches: [], total: 0, capped: false }

  const matches: FindMatch[] = []
  let total = 0
  for (let nodeIndex = 0; nodeIndex < index.length; nodeIndex++) {
    const hay = index[nodeIndex].text.toLowerCase()
    let from = 0
    for (;;) {
      const at = hay.indexOf(needle, from)
      if (at === -1) break
      total++
      if (matches.length < cap) {
        matches.push({ nodeIndex, start: at, end: at + needle.length })
      }
      from = at + needle.length
    }
  }
  return { matches, total, capped: total > cap }
}

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE'])

function isVisible(el: Element): boolean {
  const style = getComputedStyle(el)
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
    return false
  }
  if (el.getAttribute('aria-hidden') === 'true') return false
  const rect = el.getBoundingClientRect()
  return rect.width > 0 && rect.height > 0
}

/**
 * Collect visible text nodes in document order, skipping non-content tags,
 * hidden subtrees, and anything inside `excludeRoot` (the palette's own host).
 */
export function buildIndex(excludeRoot: Node | null): FindNode[] {
  const out: FindNode[] = []
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const text = node.nodeValue ?? ''
      if (text.trim() === '') return NodeFilter.FILTER_REJECT
      const parent = node.parentElement
      if (!parent) return NodeFilter.FILTER_REJECT
      if (excludeRoot && excludeRoot.contains(node)) return NodeFilter.FILTER_REJECT
      if (SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT
      if (!isVisible(parent)) return NodeFilter.FILTER_REJECT
      return NodeFilter.FILTER_ACCEPT
    },
  })
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    out.push({ node: n as Text, text: n.nodeValue ?? '' })
  }
  return out
}

/** Viewport-space rects covering a match's character range. */
export function rectsFor(match: FindMatch, index: FindNode[]): DOMRect[] {
  const entry = index[match.nodeIndex]
  if (!entry) return []
  const range = document.createRange()
  try {
    range.setStart(entry.node, match.start)
    range.setEnd(entry.node, match.end)
  } catch {
    return []
  }
  return Array.from(range.getClientRects())
}

export type ActivationKind = 'editable' | 'clickable' | 'text'

const CLICKABLE_SELECTOR =
  'a[href], button, [role="button"], input, select, textarea, summary, label, [onclick], [tabindex]'

/** Classify the nearest interactive ancestor of a matched text node. */
export function activationTarget(node: Text): { kind: ActivationKind; el: HTMLElement | null } {
  const start = node.parentElement
  const el = start ? (start.closest(CLICKABLE_SELECTOR) as HTMLElement | null) : null
  if (!el) return { kind: 'text', el: null }
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || (el as HTMLElement).isContentEditable) {
    return { kind: 'editable', el }
  }
  return { kind: 'clickable', el }
}
