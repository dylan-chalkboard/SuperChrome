# New Tab → Palette Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Chrome's new tab page with an extension page that shows an animated blue "light blinds" backdrop and auto-opens the existing SuperChrome palette, focused and ready to type.

**Architecture:** A new tab override page (`newtab.html`) sets a `window.__scPageMode` flag, renders the animated backdrop, and injects the already-built `palette.js`. The palette detects page mode and (a) auto-opens on load and (b) becomes non-dismissable — `closePalette()` resets to an empty home instead of tearing down. Reuses all existing palette logic; no fork.

**Tech Stack:** TypeScript, Vite (two-pass build), Chrome MV3, pure CSS animation, existing Vitest setup.

## Global Constraints

- MV3, `minimum_chrome_version: 114`.
- Build gate before every commit: `npm run build` must run `tsc && tests && build` as a strict `&&` chain (always-build-after-change).
- Palette content script must stay a self-contained IIFE (built by `vite.palette.config.ts`); source may import freely.
- Respect the user's `reduceMotion` setting (palette uses `no-motion` / `reducedMotion()`); backdrop must render static when it's on.
- Respect `appearance` setting (`system` | `light` | `dark`) for the backdrop variant.

---

### Task 1: Backdrop variant helper (pure, TDD)

Pure logic for choosing the backdrop theme, kept out of the DOM so it's unit-testable.

**Files:**
- Create: `src/features/newtab/backdrop.ts`
- Test: `src/features/newtab/backdrop.test.ts`

**Interfaces:**
- Produces: `backdropVariant(appearance: 'system' | 'light' | 'dark', prefersLight: boolean): 'light' | 'dark'`
- Produces: `BACKDROP_CSS: string` (added in Task 2; Task 1 only ships the function)

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { backdropVariant } from './backdrop'

describe('backdropVariant', () => {
  it('honors explicit light', () => {
    expect(backdropVariant('light', false)).toBe('light')
  })
  it('honors explicit dark even when system prefers light', () => {
    expect(backdropVariant('dark', true)).toBe('dark')
  })
  it('follows system preference when set to system', () => {
    expect(backdropVariant('system', true)).toBe('light')
    expect(backdropVariant('system', false)).toBe('dark')
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run src/features/newtab/backdrop.test.ts`
Expected: FAIL — cannot find module `./backdrop`.

- [ ] **Step 3: Implement the helper**

```ts
export type BackdropVariant = 'light' | 'dark'

export function backdropVariant(
  appearance: 'system' | 'light' | 'dark',
  prefersLight: boolean,
): BackdropVariant {
  if (appearance === 'light') return 'light'
  if (appearance === 'dark') return 'dark'
  return prefersLight ? 'light' : 'dark'
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npx vitest run src/features/newtab/backdrop.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/newtab/backdrop.ts src/features/newtab/backdrop.test.ts
git commit -m "feat: backdrop variant helper for new tab page"
```

---

### Task 2: Animated backdrop CSS + builder

The visual: deep navy → blue center glow, vertical band stripes, a slow horizontal shimmer sweep, gentle per-band breathing. Static when reduce-motion is on. Light variant for light mode. Subtle corner wordmark.

**Files:**
- Modify: `src/features/newtab/backdrop.ts` (add `BACKDROP_CSS` + `buildBackdrop`)

**Interfaces:**
- Consumes: `backdropVariant` (Task 1)
- Produces: `buildBackdrop(opts: { variant: 'light' | 'dark'; motion: boolean }): { style: HTMLStyleElement; root: HTMLElement }`
- Produces: `BACKDROP_CSS: string`

- [ ] **Step 1: Add the CSS and builder to `backdrop.ts`**

Append to `src/features/newtab/backdrop.ts`:

```ts
export const BACKDROP_CSS = `
:root { --nt-bg: #05070f; }
html, body { margin: 0; height: 100%; background: var(--nt-bg); overflow: hidden; }
.nt-backdrop {
  position: fixed; inset: 0; z-index: 0; overflow: hidden;
  background:
    radial-gradient(120% 90% at 50% 55%, #1f6bff 0%, #0b3aa8 34%, #061a55 62%, #05070f 100%);
}
/* Vertical blinds: soft alternating light/dark bands. */
.nt-backdrop .nt-bands {
  position: absolute; inset: -10% -10%;
  background: repeating-linear-gradient(
    90deg,
    rgba(255,255,255,0.00) 0px,
    rgba(120,180,255,0.16) 14px,
    rgba(255,255,255,0.02) 30px,
    rgba(6,20,70,0.55) 46px,
    rgba(255,255,255,0.00) 62px
  );
  mix-blend-mode: screen;
  animation: nt-breathe 9s ease-in-out infinite;
}
/* Bright shimmer sweeping across the bands. */
.nt-backdrop .nt-sweep {
  position: absolute; top: -10%; bottom: -10%; width: 45%;
  background: linear-gradient(90deg,
    rgba(255,255,255,0) 0%, rgba(180,220,255,0.28) 50%, rgba(255,255,255,0) 100%);
  filter: blur(6px);
  mix-blend-mode: screen;
  animation: nt-sweep 15s linear infinite;
}
.nt-backdrop .nt-mark {
  position: fixed; left: 18px; bottom: 14px; z-index: 1;
  opacity: 0.5; width: 96px; height: auto; filter: drop-shadow(0 1px 6px rgba(0,0,0,0.4));
  pointer-events: none;
}
.nt-backdrop.light {
  background: radial-gradient(120% 90% at 50% 55%, #dbeaff 0%, #a9c8ff 40%, #6f9bff 78%, #4c7bf0 100%);
}
.nt-backdrop.light .nt-bands { mix-blend-mode: multiply; opacity: 0.5; }
.nt-backdrop.light .nt-sweep { mix-blend-mode: overlay; }
@keyframes nt-sweep {
  0% { left: -50%; } 100% { left: 105%; }
}
@keyframes nt-breathe {
  0%,100% { opacity: 0.85; transform: translateX(0); }
  50% { opacity: 1; transform: translateX(-10px); }
}
.nt-static .nt-sweep { display: none; }
.nt-static .nt-bands { animation: none; }
`

/** Builds the backdrop DOM. Caller appends style to <head> and root to <body>. */
export function buildBackdrop(opts: { variant: BackdropVariant; motion: boolean }): {
  style: HTMLStyleElement
  root: HTMLElement
} {
  const style = document.createElement('style')
  style.textContent = BACKDROP_CSS

  const root = document.createElement('div')
  root.className = `nt-backdrop ${opts.variant === 'light' ? 'light' : ''} ${
    opts.motion ? '' : 'nt-static'
  }`.trim()

  const bands = document.createElement('div')
  bands.className = 'nt-bands'
  const sweep = document.createElement('div')
  sweep.className = 'nt-sweep'
  const mark = document.createElement('img')
  mark.className = 'nt-mark'
  mark.src = 'icons/logo-white.png'
  mark.alt = 'SuperChrome'

  root.append(bands, sweep, mark)
  return { style, root }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/newtab/backdrop.ts
git commit -m "feat: animated blue backdrop CSS + builder"
```

---

### Task 3: Palette page mode

Make the palette auto-open and non-dismissable when `window.__scPageMode` is set.

**Files:**
- Modify: `src/palette.ts` — add `pageMode` const, a `closePalette` early-return reset branch, an auto-open bootstrap, and a centered-panel CSS tweak.

**Interfaces:**
- Consumes: `window.__scPageMode: boolean` (set by Task 4)
- Reuses existing: `openPalette`, `closePalette`, `setInput`, `exitSubState`, `teardownFind`, `teardownSpeedTest`

- [ ] **Step 1: Add the `pageMode` flag.** Near the other module-level `let`/`const` state (e.g. just after the `let brandMenuEl` group around line 729), add:

```ts
const pageMode = (window as unknown as { __scPageMode?: boolean }).__scPageMode === true
```

- [ ] **Step 2: Make `closePalette` reset instead of tearing down in page mode.** At the very top of `function closePalette()` (line ~863), insert:

```ts
  if (pageMode) {
    // The palette IS the new tab page — never tear down. Reset to empty home.
    exitSubState(false)
    teardownFind()
    teardownSpeedTest()
    setInput('')
    return
  }
```

- [ ] **Step 3: Center the panel + suppress backdrop close in page mode.** In `openPalette`, right after `backdrop.className = 'backdrop'` (line ~918), add the page class so CSS can reposition:

```ts
  if (pageMode) backdrop.classList.add('page')
```

Then change the backdrop mousedown handler (line ~919-921) from:

```ts
  backdrop.addEventListener('mousedown', (e) => {
    if (e.target === backdrop) closePalette()
  })
```

to:

```ts
  backdrop.addEventListener('mousedown', (e) => {
    if (e.target !== backdrop) return
    if (pageMode) paletteInput?.focus()
    else closePalette()
  })
```

- [ ] **Step 4: Add page-mode panel CSS.** In `PALETTE_CSS`, just after the `.backdrop { … }` rule (line ~101), add:

```css
.backdrop.page { background: transparent; }
.backdrop.page .panel { top: 16vh; }
```

- [ ] **Step 5: Auto-open on load in page mode.** At the very end of the file, immediately before the closing `})()` of the IIFE (after the `initLibrary({ … })` call), add:

```ts
if (pageMode) openPalette('')
```

- [ ] **Step 6: Typecheck + existing tests still pass**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no type errors; all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/palette.ts
git commit -m "feat: palette page mode (auto-open, non-dismissable)"
```

---

### Task 4: New tab page + manifest wiring

The HTML entry that Chrome loads for new tabs: sets the page-mode flag, builds the backdrop, and injects the built `palette.js`.

**Files:**
- Create: `newtab.html` (project root, like `options.html`)
- Create: `src/newtab.ts`
- Modify: `vite.config.ts` (add `newtab` rollup input)
- Modify: `public/manifest.json` (add `chrome_url_overrides`, bump version)

**Interfaces:**
- Consumes: `buildBackdrop`, `backdropVariant` (Tasks 1–2); `window.__scPageMode` read by palette (Task 3)

- [ ] **Step 1: Create `newtab.html`.**

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>New Tab</title>
    <script>
      window.__scPageMode = true
    </script>
    <script type="module" src="/src/newtab.ts"></script>
  </head>
  <body></body>
</html>
```

- [ ] **Step 2: Create `src/newtab.ts`.**

```ts
import { backdropVariant, buildBackdrop } from './features/newtab/backdrop'

async function readPrefs(): Promise<{ appearance: 'system' | 'light' | 'dark'; reduceMotion: boolean }> {
  try {
    const { settings } = await chrome.storage.sync.get('settings')
    return {
      appearance: settings?.appearance ?? 'system',
      reduceMotion: settings?.reduceMotion === true,
    }
  } catch {
    return { appearance: 'system', reduceMotion: false }
  }
}

async function init(): Promise<void> {
  const prefs = await readPrefs()
  const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches
  const variant = backdropVariant(prefs.appearance, prefersLight)
  const systemReduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const motion = !(prefs.reduceMotion || systemReduce)

  const { style, root } = buildBackdrop({ variant, motion })
  document.head.appendChild(style)
  document.body.appendChild(root)

  // Inject the palette content-script bundle; it reads window.__scPageMode and
  // auto-opens itself.
  const s = document.createElement('script')
  s.src = chrome.runtime.getURL('palette.js')
  document.head.appendChild(s)
}

void init()
```

- [ ] **Step 3: Add `newtab` as a build input.** In `vite.config.ts`, change the `input` block to include newtab:

```ts
      input: {
        background: 'src/background.ts',
        options: 'options.html',
        newtab: 'newtab.html',
      },
```

- [ ] **Step 4: Wire the manifest.** In `public/manifest.json`, bump `"version"` to `"0.38.0"` and add, after the `"action"` block:

```json
  "chrome_url_overrides": {
    "newtab": "newtab.html"
  },
```

- [ ] **Step 5: Full build gate.**

Run: `npm run build`
Expected: `tsc` clean, all vitest pass, both Vite passes succeed. Then verify output exists:

Run: `ls dist/newtab.html dist/newtab.js dist/palette.js && grep -c chrome_url_overrides dist/manifest.json`
Expected: all three files listed; grep prints `1`.

- [ ] **Step 6: Commit**

```bash
git add newtab.html src/newtab.ts vite.config.ts public/manifest.json
git commit -m "feat: new tab page opens the palette with animated backdrop"
```

---

### Task 5: Manual smoke test + changelog

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Load `dist/` unpacked in Chrome** (`chrome://extensions` → Load unpacked → `dist`). Accept the "keep new tab page" prompt.

- [ ] **Step 2: Verify** by opening a new tab:
  - Animated blue backdrop shows, palette auto-opens focused and empty.
  - Typing searches bookmarks; `>` commands, `@` tabs, `#` history all work.
  - Escape / clicking the backdrop clears the input and keeps the palette (never blank).
  - Toggle `appearance` = light in options → new tab backdrop is the light variant.
  - Toggle `reduceMotion` on → backdrop renders static (no sweep).

- [ ] **Step 3: Add a CHANGELOG entry** under a new `0.38.0` heading describing the new tab page.

- [ ] **Step 4: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: changelog for new tab palette page"
```

---

## Self-Review

- **Spec coverage:** override page (T4) ✓; page mode auto-open + non-dismissable + no dim (T3) ✓; animated blue backdrop with light + reduce-motion variants + corner wordmark (T1/T2) ✓; testing + build gate (T4/T5) ✓; version bump (T4) ✓.
- **Placeholders:** none — all steps show real code/commands.
- **Type consistency:** `backdropVariant` / `buildBackdrop` signatures match across T1/T2/T4; `window.__scPageMode` set in T4 HTML, read in T3.
