# Contributing to SuperChrome

Thanks for wanting to hack on this! It's a small codebase — you can read all of it in ten minutes.

## Dev setup

```sh
npm install
npm run dev          # rebuilds dist/ on every change
```

Then in Chrome: `chrome://extensions` → Developer mode on → **Load unpacked** → select `dist/`.

Iteration loop: save a file → hit ↻ on the extension card → **refresh the tab** you're testing in (content scripts only inject into fresh page loads — though the on-demand injection fallback usually covers you when triggering via shortcut).

`npm run build` (TypeScript check + production build) and `npm test` (vitest unit suite) must both pass before a PR.

## Architecture (2 files)

- **`src/background.ts`** — MV3 service worker. Owns all `chrome.*` data access: flattens the bookmarks tree, lists tabs, executes commands (tab actions, opening `chrome://` pages), and implements the `b` omnibox keyword. Talks to the palette via `chrome.runtime` messages.
- **`src/palette.ts`** — the content script that renders the palette. **Two hard constraints, both learned the painful way:**
  1. It must not contain `import`/`export` statements — manifest content scripts load as classic scripts, not modules.
  2. All runtime code stays inside the top-level IIFE — content scripts from one extension share a global scope, and the injection fallback can run the file twice, so top-level `const`s collide (`Identifier 'E' has already been declared`).

  It renders into a **closed shadow DOM** so page CSS can't touch it, and intercepts keys on `window` in capture phase while open so page hotkeys don't fire.

## Chrome platform walls (don't file bugs for these)

- Content scripts can't run on `chrome://` pages, the Web Store, or the PDF viewer
- Extensions can't open DevTools, move the side panel, or touch any native browser UI
- `suggested_key` shortcuts only auto-bind at install time; users set them at `chrome://extensions/shortcuts`

## PRs

- Keep the no-framework, no-dependency approach for the runtime (build-time devDeps are fine)
- One feature per PR. Run `npm test` (pure logic in `src/lib.ts` is unit-tested — ranking, calculator, file types, tree walkers; add cases when you touch it) and describe how you manually tested the Chrome UI surface
- If you add a permission to the manifest, justify it in the PR description; permission creep is the main thing to guard
