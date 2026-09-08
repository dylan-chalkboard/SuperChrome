# SuperFind — design

**Date:** 2026-09-08
**Status:** Approved, pending implementation plan

## Summary

SuperFind is a keyboard-driven "find visible text and act on it" mode — the
browser-native twin of superkey.app's **Seek & Click**. You open the palette,
type `.`, and the page enters a distinct **find mode**: a glowing frame insets
the viewport, a branded pill reads `◆ SuperChrome  SuperFind: <query>`, and every
visible occurrence of what you type lights up on the page. `↑`/`↓` jump between
matches; `Enter` acts on the selected one — clicking a link/button, focusing an
editable and placing the caret, or selecting plain text — all without the mouse.

Unlike the macOS app (OCR + Accessibility API), SuperChrome runs as a content
script with full DOM access, so matching reads the live DOM directly — no OCR.

## Decisions (from brainstorming)

- **Trigger:** palette prefix `.` (no dedicated shortcut in v1).
- **Match scope:** any visible text on the page (Seek parity), literal
  case-insensitive substring — "match what you type," not fuzzy.
- **Navigate / pick:** `↑`/`↓` cycle matches, `Enter` activates.
- **Chrome:** screen-edge frame + top-center branded pill. **Highlights only** —
  no match list. On-page highlights are the interface.
- **Frame style:** an animated **Siri-style rainbow edge glow** — a soft, blurred
  multicolor gradient (pink → purple → blue → orange) hugging the viewport edges,
  brightest at the corners, slowly rotating/breathing. Not a hard border. Respects
  `prefers-reduced-motion` (static glow when motion is reduced).
- **Plain-text activation:** focus + caret if editable; otherwise select the text
  and scroll into view.
- **Out of scope:** custom keyboard shortcuts for custom commands (a separate
  follow-up). SuperFind stays a palette prefix so it won't collide with that
  future shortcut layer.

## User experience

1. `Cmd+P` opens the palette. Typing `.` switches into SuperFind mode: the normal
   floating palette panel is replaced by the SuperFind chrome (precedent: the `*`
   library view already fully takes over the palette render).
2. The SuperFind chrome is a full-viewport fixed overlay:
   - an animated **Siri-style rainbow edge glow** around the viewport (soft
     blurred pink→purple→blue→orange, brightest at corners), signalling
     "find mode",
   - a **top-center pill**: `◆ SuperChrome  SuperFind: <query>` with a
     `current / total` counter beneath (e.g. `3 / 12`),
   - a **bottom hint line**: `↑↓ move   ↵ click   esc exit`.
3. As you type, every visible occurrence of the query is painted with a highlight
   marker on the page. The **selected** match is emphasized (brighter fill +
   outline) and scrolled to center; the others are dimmed.
4. `↑`/`↓` move the selection through matches in document order (top-to-bottom),
   wrapping at the ends. The counter and emphasis update; the page scrolls to keep
   the selected match centered.
5. `Enter` activates the selected match (see Activation). `Cmd+Enter` opens a
   matched link in a new tab. On activation the overlay closes and focus goes to
   the page.
6. `Backspace` to an empty query exits find mode back to the normal empty palette
   (consistent with every other prefix). `Esc` exits find mode and closes the
   palette. Clicking outside dismisses.

## Architecture

### New module: `src/features/find/index.ts`

Owns the **pure, testable** matching logic and the DOM scan/highlight helpers,
mirroring the existing per-feature module layout.

- `buildIndex(root): FindNode[]` — walk visible text nodes with a `TreeWalker`
  over `document.body`, skipping `script`/`style`/`noscript`, hidden nodes
  (`display:none`, `visibility:hidden`, zero-size, `aria-hidden`), and the
  palette's own overlay/shadow root. Each entry keeps `{ node, text }`.
- `findMatches(index, query, cap): FindMatch[]` — pure function returning, in
  document order, every literal case-insensitive substring occurrence as
  `{ node, start, end }`, capped at `cap` (default **200**). Returns whether the
  cap was hit so the UI can show `total+` rather than silently truncating. This is
  the unit-tested core (`find.test.ts`, style per `placeholders.test.ts`) — it
  operates on plain `{ text }` records, no live DOM required.
- `rectsFor(match): DOMRect[]` — build a `Range` over `[start,end)` and return
  `range.getClientRects()`, computed **lazily** only for the matches currently in
  view / needing markers.
- `activationTarget(node): { kind, el }` — walk from the matched text node to the
  nearest interactive ancestor (`a`, `button`, `[role=button]`, `input`,
  `select`, `textarea`, `[onclick]`, `[tabindex]`, `summary`, `label`) and
  classify it as `editable` | `clickable` | `text`.

### Palette wiring: `src/palette.ts`

- When `mode === 'find'`, render the SuperFind chrome instead of the normal
  input-row + results list (same branch pattern the library view uses).
- Own the runtime state: cached node index, current matches, selected index,
  highlight-overlay element, and scroll/resize reposition listeners.
- **Highlight overlay:** a single fixed, high-`z-index` layer holding
  absolutely-positioned marker rectangles from `rectsFor`. **Non-destructive** —
  the page DOM is never mutated. Markers reposition on throttled `scroll`/`resize`
  while the mode is open and are torn down on exit.
- **Query lifecycle:** rebuild the node index on mode entry; re-run `findMatches`
  on each keystroke against the cached index; reset selection to the first
  in-viewport match (fallback: first match).

### Mode plumbing: `src/ui/shared/mode.ts`

- Add `.` to `PREFIX_CHARS`.
- `mode('.') → 'find'`.
- `MODE_PLACEHOLDERS.find = 'Find & click anything on this page…'`.
- `MODE_PREFIX.find = '.'`.
- Mode styling in `palette.ts`: the animated rainbow edge glow (a
  `conic-gradient`/blurred multi-stop gradient layer, `@keyframes` rotation gated
  on `prefers-reduced-motion`), the branded pill, and the glyph. Highlight markers
  use a warm readable fill with a rainbow-tinted outline so the selected match
  reads against any page.

## Activation (Enter)

Resolve `activationTarget(selectedNode)`:

1. **Editable** (`input` / `textarea` / `contenteditable`) → focus the element and
   place the caret at the match.
2. **Clickable** (link / button / role=button / etc.) → `el.click()`.
   `Cmd+Enter` on a link opens it in a new tab (consistent with the palette).
3. **Text** (nothing interactive nearby) → select the matched `Range` and
   `scrollIntoView({ block: 'center' })`.

Then close the overlay and return focus to the page.

## Edge cases

- **No matches:** the pill shows `0 / 0` and a quiet "No matches on this page"
  state; highlights cleared.
- **Match cap (200):** counter shows e.g. `3 / 200+`; extra occurrences beyond the
  cap are not painted. Never silently claim full coverage.
- **Cross-origin iframes:** unreachable from the content script — skipped. Noted
  as a v1 limitation. (Same-origin iframe support is a possible follow-up.)
- **Restricted pages** (`chrome://`, Chrome Web Store): content scripts can't run,
  so SuperFind is unavailable there — the same constraint the palette already has.
- **Dynamic pages:** the index is built on entry; if the query runs against a
  stale index (e.g. major DOM change), it is rebuilt. No live `MutationObserver`
  in v1.
- **Palette self-exclusion:** the palette's own overlay is excluded from the scan
  so it never matches itself.

## Testing

- **Unit** (`src/features/find/find.test.ts`): `findMatches` occurrence
  enumeration, document-order sorting, case-insensitivity, cap + cap-hit flag,
  empty/whitespace queries. Pure records, no DOM.
- **Manual:** highlight positioning across scroll/resize, ↑/↓ navigation + center
  scrolling, each activation branch (link, button, editable caret, plain-text
  select), no-match and cap-exceeded states, exit paths (Backspace, Esc, click
  outside), restricted-page unavailability.
- Per project convention (`MEMORY.md`): `tsc + tests + build` as a strict `&&`
  chain before commit.

## File changes

- `src/features/find/index.ts` — new: scan, match, rects, activation-target.
- `src/features/find/find.test.ts` — new: unit tests for `findMatches`.
- `src/ui/shared/mode.ts` — add the `.` / `find` mode entries.
- `src/palette.ts` — find-mode render branch, highlight overlay, navigation,
  activation, and `mode-find` styling.
- `README.md` / `CHANGELOG.md` — document the `.` prefix and bump the version.
