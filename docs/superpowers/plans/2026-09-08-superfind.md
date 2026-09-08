# SuperFind Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a keyboard-driven "find visible text and act on it" mode to the SuperChrome palette, triggered by the `.` prefix, that highlights matches on the live page behind a Siri-style rainbow frame and acts on the selected match with the keyboard.

**Architecture:** A new pure matching core (`src/features/find/`) enumerates literal substring matches over an index of visible text nodes. `src/palette.ts` gains a `find`-mode render branch that replaces the normal list with a full-viewport overlay (rainbow edge glow + branded pill + on-page highlight markers) and keyboard handlers for navigation and activation. Mode wiring goes in `src/ui/shared/mode.ts` alongside the existing prefixes.

**Tech Stack:** TypeScript, Chrome MV3 content script, Vite, Vitest (node environment — unit tests cover pure logic only; DOM glue is verified by typecheck/build + manual testing).

## Global Constraints

- Match scope: **any visible text**, literal **case-insensitive substring** (not fuzzy).
- Match cap: **200**; when exceeded the counter shows `N / 200+` — never silently claim full coverage.
- Highlights are **non-destructive**: never mutate page DOM; markers are absolutely-positioned overlay rects.
- Frame: animated **Siri-style rainbow edge glow** (soft blurred pink→purple→blue→orange, brightest at corners), gated on `prefers-reduced-motion` via the existing `no-motion` class / `reducedMotion()` helper.
- Signature integration points (verbatim): prefix char `.`; mode name `find`; logo asset `chrome.runtime.getURL('/icons/footer.png')`.
- Per `MEMORY.md`: run `npm run build` (which is `tsc --noEmit && vite build && vite build --config vite.palette.config.ts`) and `npm test` as a strict `&&` chain before every commit.
- No new npm dependencies.

---

## File Structure

- `src/ui/shared/mode.ts` — **modify**: register the `.` / `find` mode (prefix set, mode map, placeholder, MODE_PREFIX).
- `src/ui/shared/mode.test.ts` — **create**: unit test for the new mapping.
- `src/features/find/index.ts` — **create**: pure `findMatches` core + DOM helpers (`buildIndex`, `rectsFor`, `activationTarget`).
- `src/features/find/find.test.ts` — **create**: unit tests for `findMatches`.
- `src/palette.ts` — **modify**: `find`-mode render branch, rainbow-frame + pill + hint CSS, highlight overlay, keyboard navigation + activation, scroll/resize reposition.
- `README.md`, `CHANGELOG.md`, `public/manifest.json`, `package.json` — **modify**: document the `.` prefix, bump version.

---

## Task 1: Register the `find` mode

**Files:**
- Modify: `src/ui/shared/mode.ts`
- Test: `src/ui/shared/mode.test.ts` (create)

**Interfaces:**
- Consumes: existing `PREFIX_CHARS`, `mode()`, `MODE_PLACEHOLDERS`, `MODE_PREFIX`.
- Produces: `mode('.') === 'find'`; `MODE_PREFIX.find === '.'`; `MODE_PLACEHOLDERS.find` defined; `'.'` present in `PREFIX_CHARS`.

- [ ] **Step 1: Write the failing test**

Create `src/ui/shared/mode.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { MODE_PLACEHOLDERS, MODE_PREFIX, PREFIX_CHARS, mode } from './mode'

describe('find mode', () => {
  it('maps the "." prefix to the find mode', () => {
    expect(mode('.')).toBe('find')
  })
  it('registers "." as a prefix char', () => {
    expect(PREFIX_CHARS.includes('.')).toBe(true)
  })
  it('exposes a find placeholder and prefix', () => {
    expect(MODE_PREFIX.find).toBe('.')
    expect(MODE_PLACEHOLDERS.find).toBe('Find & click anything on this page…')
  })
  it('still maps unknown prefixes to bookmarks', () => {
    expect(mode('')).toBe('bookmarks')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/shared/mode.test.ts`
Expected: FAIL — `mode('.')` returns `'bookmarks'`, `MODE_PREFIX.find` is `undefined`.

- [ ] **Step 3: Implement the mode wiring**

In `src/ui/shared/mode.ts`:

Change the prefix constant:
```ts
export const PREFIX_CHARS = '>@#:~%*.'
```

Add the mapping inside `mode()`, before the final `return 'bookmarks'`:
```ts
  if (prefix === '.') return 'find'
```

Add the placeholder to `MODE_PLACEHOLDERS`:
```ts
  find: 'Find & click anything on this page…',
```

Add the prefix to `MODE_PREFIX`:
```ts
  find: '.',
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/ui/shared/mode.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ui/shared/mode.ts src/ui/shared/mode.test.ts
git commit -m "feat: register . prefix as SuperFind mode"
```

---

## Task 2: Pure match core — `findMatches`

**Files:**
- Create: `src/features/find/index.ts`
- Test: `src/features/find/find.test.ts` (create)

**Interfaces:**
- Produces (relied on by Task 3 & the palette):
  ```ts
  export interface FindNode { node: Text; text: string }
  export interface FindMatch { nodeIndex: number; start: number; end: number }
  export interface FindResult { matches: FindMatch[]; total: number; capped: boolean }
  export const FIND_CAP = 200
  export function findMatches(
    index: Pick<FindNode, 'text'>[],
    query: string,
    cap?: number,
  ): FindResult
  ```
  `findMatches` enumerates every literal, case-insensitive occurrence of `query`
  across `index` in array order (document order), each as
  `{ nodeIndex, start, end }` where `[start, end)` are offsets within that node's
  `text`. `total` is the true occurrence count; `matches` is truncated to `cap`
  (default `FIND_CAP`); `capped` is `total > cap`. Empty/whitespace-only queries
  return `{ matches: [], total: 0, capped: false }`.

- [ ] **Step 1: Write the failing test**

Create `src/features/find/find.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/find/find.test.ts`
Expected: FAIL — module `./index` has no export `findMatches`.

- [ ] **Step 3: Implement `findMatches`**

Create `src/features/find/index.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/find/find.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/find/index.ts src/features/find/find.test.ts
git commit -m "feat: add SuperFind literal match core"
```

---

## Task 3: DOM helpers — scan, rects, activation target

**Files:**
- Modify: `src/features/find/index.ts`

**Interfaces:**
- Consumes: `FindNode`, `FindMatch` from Task 2.
- Produces (relied on by the palette in Tasks 4 & 5):
  ```ts
  export function buildIndex(excludeRoot: Node | null): FindNode[]
  export function rectsFor(match: FindMatch, index: FindNode[]): DOMRect[]
  export type ActivationKind = 'editable' | 'clickable' | 'text'
  export function activationTarget(node: Text): { kind: ActivationKind; el: HTMLElement | null }
  ```
  - `buildIndex` walks visible text nodes under `document.body` (skipping
    `script`/`style`/`noscript`, hidden nodes, and anything inside `excludeRoot`
    — the palette host), returning `{ node, text }` in document order. The array
    order is the `nodeIndex` space Task 2 matches against.
  - `rectsFor` builds a `Range` over the match's `[start, end)` in its node and
    returns `range.getClientRects()` as an array (viewport coords).
  - `activationTarget` classifies the nearest interactive ancestor of the matched
    text node.

*No unit test:* Vitest runs in the node environment with no DOM. These helpers
are verified by `tsc --noEmit`, the build, and manual testing in Tasks 4–5. Keep
them thin and delegate all enumerable logic to `findMatches`.

- [ ] **Step 1: Append the DOM helpers**

Add to `src/features/find/index.ts`:

```ts
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
```

- [ ] **Step 2: Verify it typechecks and builds**

Run: `npm run build`
Expected: PASS — no type errors; both bundles emit.

- [ ] **Step 3: Run the full test suite (no regressions)**

Run: `npm test`
Expected: PASS — existing suites plus Tasks 1–2 tests.

- [ ] **Step 4: Commit**

```bash
git add src/features/find/index.ts
git commit -m "feat: add SuperFind DOM scan, rects, and activation helpers"
```

---

## Task 4: SuperFind chrome — rainbow frame, pill, highlight overlay

**Files:**
- Modify: `src/palette.ts`

**Interfaces:**
- Consumes: `buildIndex`, `rectsFor`, `findMatches`, `FindNode`, `FindMatch`, `FIND_CAP` from `./features/find`; existing `currentMode()`, `updateList()`, `paletteHost`, `reducedMotion()`, `updateModeStyling()`.
- Produces (relied on by Task 5):
  ```ts
  // module-scoped state
  let findIndex: FindNode[]
  let findMatchesState: FindMatch[]
  let findSelected: number
  let findTotal: number
  let findCapped: boolean
  let findOverlay: HTMLElement | null
  function renderFind(): void          // builds/refreshes overlay + markers
  function repositionFindMarkers(): void
  function teardownFind(): void
  ```

- [ ] **Step 1: Add the import**

At the top of `src/palette.ts`, alongside the other feature imports:

```ts
import {
  FIND_CAP,
  activationTarget,
  buildIndex,
  findMatches,
  rectsFor,
  type FindMatch,
  type FindNode,
} from './features/find'
```

- [ ] **Step 2: Add the module state**

Near the other palette state (`let modePrefix = ''`, etc.):

```ts
let findIndex: FindNode[] = []
let findMatchesState: FindMatch[] = []
let findSelected = 0
let findTotal = 0
let findCapped = false
let findOverlay: HTMLElement | null = null
```

- [ ] **Step 3: Add the CSS**

In the palette's `<style>` string (the block that defines `.input-row.mode-*`),
append the SuperFind styles:

```css
/* ---------- SuperFind ---------- */
.sf-overlay {
  position: fixed;
  inset: 0;
  z-index: 2147483646;
  pointer-events: none;
}
/* Siri-style rainbow edge glow: a blurred conic ring hugging the viewport. */
.sf-frame {
  position: fixed;
  inset: 0;
  border-radius: 18px;
  padding: 3px;
  background: conic-gradient(
    from 0deg,
    #ff2d95, #ff9a3d, #ffe14d, #4dff9e, #3dc9ff, #9a5dff, #ff2d95
  );
  filter: blur(14px);
  opacity: 0.85;
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  animation: sf-spin 8s linear infinite;
}
@keyframes sf-spin { to { transform: rotate(360deg); } }
.no-motion .sf-frame, .sf-overlay.no-motion .sf-frame { animation: none; }
.sf-pill {
  position: fixed;
  top: 18px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  border-radius: 14px;
  background: rgba(20, 20, 24, 0.82);
  backdrop-filter: blur(20px) saturate(160%);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.45);
  color: #fff;
  font: 500 14px/1.2 -apple-system, system-ui, sans-serif;
}
.sf-pill .sf-logo { width: 18px; height: 18px; }
.sf-pill .sf-label { opacity: 0.7; }
.sf-pill .sf-query { font-weight: 600; }
.sf-pill .sf-count { margin-left: 8px; opacity: 0.55; font-variant-numeric: tabular-nums; }
.sf-hint {
  position: fixed;
  bottom: 18px;
  left: 50%;
  transform: translateX(-50%);
  padding: 7px 14px;
  border-radius: 10px;
  background: rgba(20, 20, 24, 0.72);
  color: rgba(255, 255, 255, 0.75);
  font: 500 12px/1.2 -apple-system, system-ui, sans-serif;
  backdrop-filter: blur(14px);
}
.sf-mark {
  position: fixed;
  border-radius: 3px;
  background: rgba(255, 225, 77, 0.28);
  box-shadow: inset 0 0 0 1.5px rgba(255, 154, 61, 0.6);
  transition: background 0.1s ease, box-shadow 0.1s ease;
}
.sf-mark.sf-current {
  background: rgba(255, 154, 61, 0.42);
  box-shadow: inset 0 0 0 2px #ff2d95, 0 0 14px rgba(255, 45, 149, 0.55);
}
.sf-empty {
  position: fixed;
  top: 62px;
  left: 50%;
  transform: translateX(-50%);
  padding: 8px 14px;
  border-radius: 10px;
  background: rgba(20, 20, 24, 0.72);
  color: rgba(255, 255, 255, 0.7);
  font: 500 13px/1.2 -apple-system, system-ui, sans-serif;
}
```

- [ ] **Step 4: Implement `renderFind`, `repositionFindMarkers`, `teardownFind`**

Add these functions to `src/palette.ts`:

```ts
function teardownFind(): void {
  window.removeEventListener('scroll', repositionFindMarkers, true)
  window.removeEventListener('resize', repositionFindMarkers, true)
  findOverlay?.remove()
  findOverlay = null
  findIndex = []
  findMatchesState = []
  findSelected = 0
  findTotal = 0
  findCapped = false
}

function repositionFindMarkers(): void {
  if (!findOverlay) return
  const marks = findOverlay.querySelectorAll<HTMLElement>('.sf-mark')
  marks.forEach((mark) => {
    const i = Number(mark.dataset.i)
    const match = findMatchesState[i]
    if (!match) return
    const rects = rectsFor(match, findIndex)
    const r = rects[0]
    if (!r) {
      mark.style.display = 'none'
      return
    }
    mark.style.display = ''
    mark.style.left = `${r.left}px`
    mark.style.top = `${r.top}px`
    mark.style.width = `${r.width}px`
    mark.style.height = `${r.height}px`
  })
}

/**
 * Render (or refresh) the SuperFind overlay for the current query. Rebuilds the
 * node index on first entry, re-runs matching each call, and paints markers.
 */
function renderFind(): void {
  if (!paletteInput || !paletteHost) return
  const shadow = paletteHost.shadowRoot
  if (!shadow) return

  if (findIndex.length === 0) findIndex = buildIndex(paletteHost)

  const query = paletteInput.value
  const result = findMatches(findIndex, query, FIND_CAP)
  findMatchesState = result.matches
  findTotal = result.total
  findCapped = result.capped
  if (findSelected >= findMatchesState.length) findSelected = 0

  // Build the overlay skeleton once.
  if (!findOverlay) {
    findOverlay = document.createElement('div')
    findOverlay.className = 'sf-overlay'
    findOverlay.innerHTML = `
      <div class="sf-frame"></div>
      <div class="sf-pill">
        <img class="sf-logo" alt="SuperChrome" />
        <span class="sf-label">SuperFind:</span>
        <span class="sf-query"></span>
        <span class="sf-count"></span>
      </div>
      <div class="sf-hint">↑↓ move&nbsp;&nbsp;↵ click&nbsp;&nbsp;esc exit</div>`
    findOverlay.querySelector<HTMLImageElement>('.sf-logo')!.src =
      chrome.runtime.getURL('/icons/footer.png')
    if (reducedMotion()) findOverlay.classList.add('no-motion')
    shadow.appendChild(findOverlay)
    window.addEventListener('scroll', repositionFindMarkers, true)
    window.addEventListener('resize', repositionFindMarkers, true)
  }

  // Update pill text + counter.
  findOverlay.querySelector('.sf-query')!.textContent = query
  const countEl = findOverlay.querySelector('.sf-count')!
  countEl.textContent = findTotal
    ? `${findSelected + 1} / ${findCapped ? `${FIND_CAP}+` : findTotal}`
    : query.trim()
      ? '0 / 0'
      : ''

  // Empty-state note.
  let empty = findOverlay.querySelector<HTMLElement>('.sf-empty')
  if (query.trim() && findTotal === 0) {
    if (!empty) {
      empty = document.createElement('div')
      empty.className = 'sf-empty'
      empty.textContent = 'No matches on this page'
      findOverlay.appendChild(empty)
    }
  } else {
    empty?.remove()
  }

  // Rebuild markers.
  findOverlay.querySelectorAll('.sf-mark').forEach((m) => m.remove())
  findMatchesState.forEach((_, i) => {
    const mark = document.createElement('div')
    mark.className = 'sf-mark' + (i === findSelected ? ' sf-current' : '')
    mark.dataset.i = String(i)
    findOverlay!.appendChild(mark)
  })
  repositionFindMarkers()
  scrollSelectedFindIntoView()
}

function scrollSelectedFindIntoView(): void {
  const match = findMatchesState[findSelected]
  if (!match) return
  const entry = findIndex[match.nodeIndex]
  entry?.node.parentElement?.scrollIntoView({ block: 'center', behavior: 'smooth' })
}
```

- [ ] **Step 5: Branch `updateList` into find mode**

In `updateList()` (around `src/palette.ts:3924`), immediately after
`updateModeStyling()` and before the `uiState === 'rename' …` early return, add:

```ts
  if (currentMode() === 'find' && uiState === 'list') {
    renderFind()
    return
  }
```

Then, so the overlay is cleared when leaving find mode, add a guard at the very
top of `updateList()` after the `token`/`renderFooter()` lines:

```ts
  if (findOverlay && currentMode() !== 'find') teardownFind()
```

- [ ] **Step 6: Tear down on close**

In `closePalette()` (around `src/palette.ts:689`), add `teardownFind()` right
after the function's first line so the overlay and its listeners never leak:

```ts
  teardownFind()
```

- [ ] **Step 7: Build and manually verify**

Run: `npm run build && npm test`
Expected: PASS.

Manual (load `dist/` unpacked, reload the extension on any content page):
1. `Cmd+P`, type `.` then `work` (or any on-page word). Expected: rainbow frame
   appears, pill reads `◆ SuperChrome  SuperFind: work  1 / N`, matches glow, the
   first is emphasized and scrolled to center.
2. Type a word not on the page. Expected: `No matches on this page`, `0 / 0`.
3. Scroll the page. Expected: markers track their text.

- [ ] **Step 8: Commit**

```bash
git add src/palette.ts
git commit -m "feat: render SuperFind rainbow frame, pill, and page highlights"
```

---

## Task 5: Keyboard navigation + activation

**Files:**
- Modify: `src/palette.ts`

**Interfaces:**
- Consumes: `findMatchesState`, `findSelected`, `findIndex`, `renderFind`, `scrollSelectedFindIntoView`, `activationTarget`, `closePalette`, `currentMode()`, `onGlobalKey`.
- Produces: `activateFindSelection(newTab: boolean): void`.

- [ ] **Step 1: Implement activation**

Add to `src/palette.ts`:

```ts
function activateFindSelection(newTab: boolean): void {
  const match = findMatchesState[findSelected]
  if (!match) return
  const entry = findIndex[match.nodeIndex]
  if (!entry) return
  const target = activationTarget(entry.node)

  if (target.kind === 'editable' && target.el) {
    const el = target.el
    closePalette()
    el.focus()
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      const caret = Math.min(match.end, el.value.length)
      el.setSelectionRange(caret, caret)
    }
    return
  }

  if (target.kind === 'clickable' && target.el) {
    const el = target.el
    if (newTab && el instanceof HTMLAnchorElement && el.href) {
      const href = el.href
      closePalette()
      window.open(href, '_blank')
      return
    }
    closePalette()
    el.click()
    return
  }

  // Plain text: select it and scroll into view.
  const range = document.createRange()
  try {
    range.setStart(entry.node, match.start)
    range.setEnd(entry.node, match.end)
  } catch {
    closePalette()
    return
  }
  const sel = window.getSelection()
  closePalette()
  sel?.removeAllRanges()
  sel?.addRange(range)
  entry.node.parentElement?.scrollIntoView({ block: 'center', behavior: 'smooth' })
}
```

- [ ] **Step 2: Wire keys in `onGlobalKey`**

In `onGlobalKey()` (starts `src/palette.ts:996`), add a find-mode block right
after the early guards (`if (!paletteHost) return` … `if (e.type !== 'keydown') return`)
and before the brand-menu / dropdown handling:

```ts
  if (currentMode() === 'find' && uiState === 'list' && findMatchesState.length) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      findSelected = (findSelected + 1) % findMatchesState.length
      renderFind()
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      findSelected = (findSelected - 1 + findMatchesState.length) % findMatchesState.length
      renderFind()
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      activateFindSelection(e.metaKey || e.ctrlKey)
      return
    }
  }
```

Note: `Esc` and `Backspace`-to-empty already work — they run through the existing
handlers, which call `closePalette()` / `setInput('')`, and `teardownFind()` is
wired into both `closePalette()` and the `updateList` mode-change guard from Task 4.

- [ ] **Step 3: Build and manually verify**

Run: `npm run build && npm test`
Expected: PASS.

Manual:
1. `.work` → `↓`/`↑` cycle matches; counter and emphasis update; page recenters.
2. `Enter` on a link → navigates; `Cmd+Enter` on a link → opens a new tab.
3. `.` on a form field's label/placeholder text → `Enter` focuses the field with
   the caret placed.
4. `.` on plain body text → `Enter` selects it and scrolls it into view.
5. `Esc` closes; `Backspace` to empty returns to the normal palette; reopening and
   leaving find mode leaves no lingering frame or markers.

- [ ] **Step 4: Commit**

```bash
git add src/palette.ts
git commit -m "feat: SuperFind keyboard navigation and activation"
```

---

## Task 6: Docs + version bump

**Files:**
- Modify: `README.md`, `CHANGELOG.md`, `public/manifest.json`, `package.json`

**Interfaces:** none (documentation/metadata only).

- [ ] **Step 1: Document the `.` prefix in `README.md`**

In the `## Usage` prefix list, add a bullet after the `%` snippets line:

```markdown
- `.` prefix → **SuperFind** — Seek-style find-and-click: type any visible text on the current page and every match lights up behind a Siri-style rainbow frame. `↑↓` move between matches, `↵` acts on the selected one (click a link/button, focus an editable and place the caret, or select plain text), `⌘↵` opens a matched link in a new tab, `Esc` exits
```

- [ ] **Step 2: Add a `CHANGELOG.md` entry**

Add a new top entry (match the existing format/heading style in the file):

```markdown
## 0.37.0

- **SuperFind** (`.` prefix): keyboard find-and-click over any visible text on the page — Siri-style rainbow frame, on-page highlights, `↑↓` navigate, `↵` click/focus/select, `⌘↵` opens links in a new tab.
```

- [ ] **Step 3: Bump the version**

In `public/manifest.json` set `"version": "0.37.0"`.
In `package.json` set `"version"` to `"0.37.0"` (if a version field is present; skip if absent).

- [ ] **Step 4: Full verification**

Run: `npm run build && npm test`
Expected: PASS — both bundles emit, all tests green.

- [ ] **Step 5: Commit**

```bash
git add README.md CHANGELOG.md public/manifest.json package.json
git commit -m "v0.37.0: SuperFind — keyboard find-and-click on-page mode"
```

---

## Self-Review

**Spec coverage:**
- `.` prefix trigger → Task 1. ✓
- Literal case-insensitive substring, any visible text → Task 2 (`findMatches`) + Task 3 (`buildIndex`). ✓
- Match cap 200 with `N / 200+` counter → Task 2 (`capped`) + Task 4 (counter). ✓
- Highlights-only, non-destructive markers → Task 4 (`sf-mark`, overlay). ✓
- Rainbow Siri frame + branded pill + hint line, reduced-motion aware → Task 4 (CSS + `no-motion`). ✓
- `↑↓` navigate, `Enter` activate, `Cmd+Enter` new tab → Task 5. ✓
- Activation branches (editable caret / clickable / plain-text select) → Task 3 (`activationTarget`) + Task 5 (`activateFindSelection`). ✓
- Exit paths (Esc, Backspace-to-empty, click-outside) + teardown → Task 4 (`teardownFind` in `closePalette` + `updateList` guard), Task 5 note. ✓
- No-match empty state → Task 4. ✓
- Scroll/resize reposition → Task 4 (`repositionFindMarkers`). ✓
- Restricted pages / cross-origin iframes: inherent to content-script scope; no code needed (documented limitation). ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete code. ✓

**Type consistency:** `findMatches`/`FindMatch`/`FindNode`/`FindResult`/`FIND_CAP` used consistently across Tasks 2–5; `activationTarget` returns `{ kind, el }` consumed exactly in Task 5; overlay state names (`findMatchesState`, `findSelected`, `findIndex`, `findOverlay`) consistent between Tasks 4 and 5. ✓
