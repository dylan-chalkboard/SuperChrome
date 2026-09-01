<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/logo-white.png">
    <img src="assets/logo-black.png" alt="SuperChrome" width="140">
  </picture>
</p>

# SuperChrome

A Raycast/VSCode-style command palette for Chrome bookmarks — liquid-glass floating quick-open at the top of the screen. Works alongside Chrome's native bookmarks bar.

## Setup

```sh
npm install
npm run build
```

Then load it in Chrome:

1. Open `chrome://extensions`, turn on **Developer mode**
2. **Load unpacked** → pick this project's `dist/` folder
3. Bind shortcuts at `chrome://extensions/shortcuts` (suggested keys don't auto-bind after install):
   - **Quick open bookmarks** → `Cmd+P` (must be set manually to take over Print)
   - **Open command palette** → `Cmd+Shift+P`

## Usage

Open with `Cmd+P` (bookmarks), `Cmd+Shift+P` (commands), or the toolbar icon:

- Plain text → fuzzy-search **bookmarks** with favicons, ranked by how often and recently you pick them (Enter opens, `Cmd+Enter` new tab)
- `>` prefix → **commands**: bookmark/close/duplicate/pin tab, print, view source, and jump to any Chrome settings page (privacy, passwords, clear browsing data, flags, Web Store, chrome://inspect, …)
- `@` prefix → **switch to an open tab**
- `#` prefix → **search browser history** (empty query shows recent pages)
- `:` prefix → **emoji search** — Enter inserts into the field you were typing in (or copies)
- `!` prefix → **clipboard history** — the last 50 things you copied on web pages; Enter re-inserts or copies
- **Inline calculator** — type math (`142*12`, `18% of 240`, `2^10`) and the result appears as the first row; Enter copies it
- `Cmd+K` → **actions panel** for the selected item: open in new tab, copy URL, rename, move to folder, delete bookmark, remove from history, close tab
- `Esc` or click outside to dismiss

**Settings** (`>SuperChrome: Settings` or the extension's Options): glass opacity, icon tile colors, frecency decay, default mode, and per-site disable.

**Omnibox**: type `b` + Tab in the address bar to search bookmarks — works everywhere, including `chrome://` pages where content scripts can't run.

## Native DevTools bridge (macOS, optional)

Extensions can't open DevTools — no API exists. The workaround is a tiny native messaging host that presses `Cmd+Opt+I` for you, making `>Developer: Open DevTools` open the real thing:

```sh
./native-host/install.sh <your-extension-id>   # ID is on chrome://extensions
```

Then restart Chrome and grant Accessibility to Google Chrome when macOS asks (System Settings → Privacy & Security → Accessibility). Without the host installed, the command falls back to opening `chrome://inspect`.

The host is ~40 lines of Python (`native-host/host.py`) with a hardcoded action allowlist — it can only do what's in that file.

## Limitations (Chrome platform, not fixable)

- Content scripts can't run on `chrome://` pages, the Web Store, or other extensions' pages — no palette there (use the `b` keyword)
- Extensions can't open DevTools programmatically — nearest equivalents are `>Developer: View Page Source` and `>Developer: Open chrome://inspect`

## Matching Chrome browser theme

`chrome-theme/` is a separate tiny extension that skins Chrome's frame, toolbar, tabs, and omnibox in Cursor Dark. Load it via **Load unpacked** → the `chrome-theme` folder. Undo: Settings → Appearance → **Reset to default**.

## Development

```sh
npm run dev    # rebuilds dist/ on change; hit reload on chrome://extensions, then refresh test tabs
npm run build  # typecheck + production build
```

Architecture: two build entries, no framework. `background.js` (service worker: bookmark/tab data, command execution, omnibox), `palette.js` (content script — deliberately import-free so it loads as a classic script, rendering into a closed shadow DOM).

## Contributing

PRs welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) for the dev loop, the two-file architecture, and the Chrome platform constraints worth knowing before you start.

## License

[MIT](LICENSE)
