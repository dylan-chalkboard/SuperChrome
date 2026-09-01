# Chrome Web Store listing kit

Upload: `superchrome-<version>.zip` (built via `npm run build`, then `cd dist && zip -r ../superchrome-<version>.zip .`)

## Listing copy

**Name:** SuperChrome

**Summary (132 chars max):**
Raycast-style command palette for Chrome — search bookmarks, tabs, history, and downloads, run commands, all from one shortcut.

**Description:**
SuperChrome puts a fast, keyboard-first command palette in every tab.

Press Cmd+P (Ctrl+P) and type — bookmarks, folders, open tabs, history, downloads, and browser commands all resolve from one search box, ranked by how often and recently you use them.

- Plain text searches bookmarks, folders, and commands; anything else falls through to web search
- `>` runs commands: tab actions, split view, zoom, and quick jumps to any Chrome settings page
- `@` switches between open tabs across all windows, including recently closed
- `#` searches your browser history
- `~` finds recent downloads, with file-type icons
- `:` opens an emoji picker that inserts into the field you were typing in
- Inline calculator: type math, Enter copies the result
- Pick Color: sample any pixel on screen with Chrome's native eyedropper
- Cmd+K actions on every result: open, copy, rename, move, delete, and more
- Options: glass opacity, icon colors, default mode, reduced motion, per-site disable

Everything runs locally. No accounts, no analytics, no data leaves your browser.

Open source: https://github.com/dylan-chalkboard/SuperChrome

**Category:** Productivity → Tools

## Privacy tab answers

**Single purpose:**
SuperChrome provides a keyboard-driven command palette to search and act on the user's own browser data (bookmarks, tabs, history, downloads) and run browser commands.

**Permission justifications:**
- `bookmarks` — core feature: searching, opening, creating, renaming, moving, reordering, and deleting the user's bookmarks from the palette.
- `tabs` — the `@` mode lists and switches between open tabs (titles/URLs shown to the user); commands act on the current tab (pin, duplicate, close, zoom, split).
- `tabGroups` — shows each tab's group name/color and lets users move tabs between groups.
- `history` — the `#` mode searches the user's browsing history; results open on selection; users can remove entries.
- `sessions` — lists recently closed tabs in `@` mode so users can reopen them.
- `downloads` / `downloads.open` — the `~` mode lists recent downloads; selection opens the file or reveals it in the file manager.
- `storage` — stores user settings (sync) and local usage counts that power result ranking. Nothing else is stored.
- `favicon` — renders site favicons next to bookmark/tab/history results.
- `scripting` — injects the palette UI on demand into the active tab when the keyboard shortcut is pressed on a page where the declared content script has not loaded (e.g. tabs opened before install).
- `nativeMessaging` — optional integration with a small local helper the user installs manually (open DevTools, click browser menu items). The extension functions fully without it.
- Host permission `<all_urls>` — the palette is an overlay rendered inside the current page via content script; it must be able to appear on any site the user invokes it on. The content script renders UI and captures palette keystrokes only; it does not read or modify page content.

**Remote code:** No. All code is packaged; the manifest CSP forbids remote scripts.

**Data usage:** No user data is collected or transmitted. Settings sync via Chrome's own storage.sync; usage counts for ranking stay in storage.local on the device.

## Assets checklist

- [x] Icon 128×128 (`public/icons/icon128.png` — note: white glyph, upload on a dark tile or regenerate a dark-on-light variant for the store page)
- [ ] Screenshot(s) 1280×800: palette over a colorful page; `>` commands list; emoji grid; options page
- [ ] Optional small promo tile 440×280

## Post-publish notes

- The published extension gets a NEW extension ID. Re-run `native-host/install.sh <new-id>` and restart Chrome, or the DevTools bridge silently falls back.
- Local settings/usage from the unpacked install do not migrate (fresh storage under the new ID). Sync settings re-sync only if the ID matched — they won't; expect defaults once.
- Keep the unpacked version disabled while the store version is installed, or shortcuts will fight.
