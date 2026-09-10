# New Tab → Palette (with animated branded backdrop)

**Date:** 2026-09-10
**Status:** Approved (design)

## Problem

Opening a new tab lands on Google, and there's no way to reach the SuperChrome
palette ("codepanel") from there — a new tab / `chrome://newtab` is a page the
extension's content script cannot inject into. The user wants a new tab to open
straight into the palette, ready to type.

## Goal

Replace the default new tab page with an extension page that renders an animated
branded backdrop and auto-opens the existing SuperChrome palette, focused and
empty. All existing palette behavior (bookmarks, `>` commands, `@` tabs, `#`
history, actions, quicklinks) works unchanged because it's the same code.

Non-goals: rebuilding the palette, a start-page dashboard of tiles, changing the
browser homepage (this overrides only the new tab surface).

## Approach

New tab **override page that hosts the existing palette**. The page reuses the
already-built `palette.js` rather than forking or reimplementing palette logic.
Only new code is the backdrop and a small "page mode" flag.

Rejected alternatives:
- Standalone mini-palette rebuilt for new tab — discards ~5000 lines of working
  search/command/tab logic.
- Redirect new tabs to an external URL — cannot host the palette; defeats the
  purpose.

## Components

### 1. New tab override page — `newtab.html` + `src/newtab.ts`

- Manifest gains `chrome_url_overrides: { "newtab": "newtab.html" }`. Chrome
  shows a one-time "an extension changed your new tab page — keep it?" prompt;
  expected.
- `newtab.html`: full-viewport container for the animated backdrop; loads
  `palette.js` via a `<script>` tag (classic script, as built).
- `src/newtab.ts`: builds the backdrop DOM + CSS, and sets the page-mode flag
  before `palette.js` runs, then signals the palette to open. Built by the main
  Vite pass (ESM) alongside `background` / `options` (add as a rollup input in
  `vite.config.ts`).

### 2. Palette "page mode"

A small behavioral variant of the existing palette, detected via a global flag
`window.__scPageMode = true` set by `newtab.ts` before `palette.js` executes,
read once at startup.

- **Auto-opens on load**, focused and empty.
- **Non-dismissable:** Escape and backdrop click **clear the input** instead of
  closing (page mode changes only that branch; normal pages still close on
  Escape).
- **No palette dimming backdrop** in page mode — the animated backdrop shows
  through; the palette panel keeps its normal frosted, centered look.
- Everything else identical (same code path).

### 3. Animated branded backdrop

Vertical blue "light blinds" (per user reference image), pure CSS, GPU-friendly,
no canvas:

- **Base:** deep navy → blue radial glow, brightest toward center.
- **Bands:** vertical stripes via `repeating-linear-gradient`, alternating
  lighter/darker blue with soft edges (the blinds look).
- **Shimmer:** a slow bright vertical highlight sweeping horizontally across the
  bands (~12–18s loop), plus subtle per-band brightness "breathing" so it feels
  alive rather than one sliding element.
- **Light mode:** a lighter blue variant, keyed off the palette's existing
  `light` setting, so it isn't jarring.
- **Reduce motion:** if the user's reduce-motion pref is on, render static (bands
  + glow, no sweep) — consistent with the palette's existing `no-motion` handling.
- **Corner wordmark:** a subtle SuperChrome wordmark in a corner; easy to remove.

## Data flow

1. User opens a new tab → Chrome loads `newtab.html`.
2. `newtab.ts` runs: builds backdrop, sets `window.__scPageMode = true`.
3. `palette.js` loads: detects page mode, auto-opens the palette focused/empty,
   suppresses its own dimming backdrop, and switches Escape/backdrop-click to
   clear-input.
4. User types → existing palette search/command/tab/history logic runs unchanged.

## Error handling / edge cases

- Reduce-motion pref on → static backdrop.
- Light vs dark → backdrop variant matches palette theme.
- Escape / backdrop click in page mode → clears input, never closes to blank.
- If `palette.js` fails to load, the backdrop still renders (no hard error page).

## Testing

- **Unit:** page-mode detection; the Escape-clears-vs-closes branch (existing
  `*.test.ts` setup).
- **Build gate:** `tsc && tests && build`; confirm `newtab.html` + `newtab.js`
  land in `dist/` and the manifest override resolves.
- **Manual smoke:** load unpacked → new tab shows animated backdrop, palette
  auto-opens focused; typing searches; Escape clears; `>` / `@` / `#` modes work;
  light mode + reduce-motion behave.
- Bump version; follow always-build-after-change before commit.

## Files touched

- `public/manifest.json` — add `chrome_url_overrides.newtab`, bump version.
- `newtab.html` — new page (project root, like `options.html`).
- `src/newtab.ts` — new: backdrop + page-mode bootstrap.
- `src/palette.ts` — add page-mode branch (auto-open, non-dismissable, no dim).
- `vite.config.ts` — add `newtab` rollup input.
- Tests for page-mode logic.
