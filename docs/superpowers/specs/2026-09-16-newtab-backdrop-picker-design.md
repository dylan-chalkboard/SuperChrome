# New Tab Backdrop Picker — Design

**Date:** 2026-09-16
**Status:** Approved

## Problem

The new tab page renders a single hardcoded animated backdrop (the halftone
dot-wave). Users can't change it. We want a small set of pickable animated
backdrops selectable from the options page.

## Scope

- A registry of built-in backdrops. No user uploads, no custom colors/images.
- Six choices: **None** (static), **Dot-wave** (existing), **Flow-field
  particles**, **Aurora mesh**, **Starfield/constellation**, **Animated
  gradient**.
- A live-preview picker in the options page.
- Every choice stays theme-aware (light/dark) and honors reduce-motion by
  freezing to a static frame (or, for None, no animation at all).

Out of scope: uploaded images, solid/gradient color pickers, per-site backdrops.

## Architecture

Split the current `backdrop.ts` into a shared harness plus one file per
animation, coordinated by a registry.

### `src/features/newtab/backdrop-core.ts`
Shared primitives, moved out of today's `backdrop.ts`:
- `BackdropVariant`, `backdropVariant()`, `dotInk()` (unchanged behavior).
- `BACKDROP_CSS` (background colors per variant, canvas, footer mark).
- `createCanvasBackdrop(draw)` — returns a `mount(container, { variant, motion })
  => stop` function that owns: style injection, the `.nt-backdrop` root, the
  footer mark, the `<canvas>`, DPR scaling, resize handling, the RAF loop, and
  motion/reduce-motion (static frame at `t=0` when `motion` is false). Each
  animation supplies only `draw(ctx, frame)` where
  `frame = { t: number; vw: number; vh: number; variant: BackdropVariant }`.

### One file per animation
Each exports metadata + a `mount` built via `createCanvasBackdrop` (except
`none`, which just injects the static background):
- `dots.ts` — the current dot-wave, refactored onto the harness (identical look).
- `particles.ts` — flow-field particles drifting along a slowly-rotating noise
  field.
- `aurora.ts` — a few large blurred radial color blobs drifting and blending.
- `starfield.ts` — drifting points with lines drawn between nearby neighbors.
- `gradient.ts` — CSS-based animated `linear-gradient` (no canvas); still fronted
  by the same `mount/stop` interface.
- `none.ts` — static theme background, no canvas, no animation.

### `src/features/newtab/registry.ts`
- `BackdropDef { id: string; label: string; mount: MountFn }`.
- `BACKDROPS: BackdropDef[]` — ordered list (None first or Dot-wave first; UI
  order matches this array).
- `DEFAULT_BACKDROP_ID = 'dots'`.
- `resolveBackdrop(id): BackdropDef` — returns the match, or the default for
  unknown/legacy/undefined ids.

`backdrop.ts` becomes a thin re-export barrel (or is removed and imports updated)
to keep existing imports/tests working. The existing `backdrop.test.ts` keeps
testing `backdropVariant`/`dotInk` via the new location.

## Settings & data flow

- Add `backdrop: string` to `UserSettings` in `src/core/settings.ts` and the
  duplicated interface in `src/options.ts`. Default `'dots'`.
- `newtab.ts`: read `settings.backdrop`, call
  `resolveBackdrop(id).mount(document.body, { variant, motion })`. Unknown id
  falls back to default. Variant/motion logic unchanged.

## Options UI — live preview picker

New "Backdrop" card in `options.html`, above or within Appearance:
- A grid of thumbnails, one per `BACKDROPS` entry. Each thumbnail is a small box
  (~160×100) into which the same `mount()` renders a live mini backdrop, using
  the current resolved variant and the user's motion preference.
- The selected thumbnail gets a highlighted border; its label shows beneath.
- Clicking a thumbnail sets `settings.backdrop` and saves immediately, matching
  the existing debounced-save pattern in `options.ts`.
- Thumbnails re-mount when the appearance/variant changes so previews match the
  chosen theme. Reduce-motion freezes thumbnails to a static frame.

Because the harness accepts any container, previews reuse production code — no
separate preview rendering path.

## Testing

Canvas drawing isn't unit-tested. Cover the logic:
- `resolveBackdrop` returns the right def and falls back to default for
  unknown/undefined ids.
- Registry integrity: every entry has a non-empty `id`, `label`, and a `mount`
  function; ids are unique; `DEFAULT_BACKDROP_ID` exists in the registry.
- Existing `backdropVariant`/`dotInk` tests continue to pass from their new home.
- Settings default includes `backdrop: 'dots'` and merges correctly.

Gate before commit: `tsc --noEmit && vitest run && npm run build`.

## Build notes

No new Vite inputs — everything is imported by the existing `newtab`/`options`
entries. The palette second-pass build is untouched.
