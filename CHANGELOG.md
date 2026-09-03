# Changelog

All notable changes to SuperChrome. Versions follow the extension's
`manifest.json` version.

## 0.25.5

- Confetti rebuilt as a canvas particle system: two cannons, gravity,
  drag, 3D tumble, and fade — instead of falling rectangles

## 0.25.4

- `>Confetti` 🎉 — rains palette-colored confetti over the current page
  (reduced-motion users get a tasteful 🎉 toast instead)

## 0.25.3

- Removed window tiling entirely (Tile Tab Left/Right and the fallback):
  split view is native-only via the companion host; without it, "Split
  With Current Tab" explains what's needed instead of faking it

## 0.25.2

- Split view now uses Chrome's own ⌘⌥N shortcut through the native host
  (no fragile menu scripting): "Split With Current Tab" parks the chosen
  tab next to yours and presses it; `>New Split View` presses it directly;
  window tiling stays the fallback without the host

## 0.25.1

- **Native split view via the macOS host**: ⌘K → "Split With Current Tab"
  now pulls the tab into your window and has the native host click
  Chrome's real split-view menu item (Accessibility scripting); window
  tiling remains the automatic fallback when the host is absent or the
  menu changes

## 0.25.0

- **Tab tiling** (Chrome has no API to create native Split View, so this is
  the honest version): `>Tile Tab Left/Right` snaps the current tab and its
  window into side-by-side halves, and `⌘K` on any tab row offers **Tile
  Beside Current Tab** — pick a tab from `@` and it lands next to the one
  you're on
- Tabs in a native Chrome split view show a "Split" tag in `@`

## 0.24.4

- "Switch to Tab" indicator is more prominent: a boxed right-arrow tile
  next to the label, Raycast-style

## 0.24.3

- Fixed: right-column labels rendered near-invisible in dark mode (a
  mangled light-mode CSS rule leaked into dark)

## 0.24.2

- Rows whose URL is already open show a "Switch to Tab" tag with an
  arrow-in-a-box icon on the right (bookmarks, history, and tab results)

## 0.24.1

- Opening a bookmark/history/search result whose URL is already open
  switches to that tab (hash and trailing slash ignored); `⌘↵` still
  forces a fresh tab

## 0.24.0

- **Customize Favorite** grew: 18 colors + hue-shift gradients + 8
  hand-picked gradients (sunset, ocean, candy, …), a much larger icon
  library (~60 glyphs), an Emoji tab alongside Icon/Text, and Enter closes
  the panel as Done
- **Open tabs in the main search**: matching queries surface already-open
  tabs tagged "Switch to Tab" — Enter jumps to them
- "Remove from Favorites" uses a slashed-star icon, and destructive
  actions always sit at the bottom of the ⌘K menu

## 0.23.1

- "Remove from Favorites" renders as a destructive (red) action

## 0.23.0

- **Customize Favorite…** replaces the separate color/emoji actions: one
  panel with a live preview, flat color and gradient background swatches,
  and a glyph choice of Default (favicon/command icon), a picker over the
  built-in icon library, or a text monogram (up to 3 characters)

## 0.22.0

- **Getting Started checklist** (Raycast-style walkthrough): seven checkbox
  rows on the home view — bind the ⌘P hotkey, `>`, `@`, `⌘K`, `⌘D` save,
  favorite, `*` — ticking automatically as features get used or when
  tapped; hidden once complete; `⌘K` → Hide, back via
  `>SuperChrome: Getting Started`
- **Grab Page Links** command: every anchor on the page as a filterable
  list — Enter opens, deduped, http(s) only
- **New Bookmark Folder…** command: inline naming; creates inside the
  current library folder, else Other Bookmarks
- **Right-click context menu**: rows and favorite tiles open the ⌘K panel
  at the cursor
- **Favorites bar**: wraps instead of clipping overflow, larger tiles,
  per-favorite Tile Color… and Emoji Icon… customization, and command
  tiles render the logo/ribbon icons correctly

## 0.21.0

- **Bookmarks section** (`*` prefix, red): a dedicated library view with a
  clickable breadcrumb, folders-first rows showing item counts and bookmark
  ages, and a global bookmark-only search (results carry their folder path;
  Enter on a folder jumps into it)
- **Save flow**: `>Bookmark Current Tab` and the section's ＋ New button open
  a panel with an editable title and a fuzzy folder picker (Inbox
  preselected; `Create folder "<query>"` when nothing matches) instead of
  blind-creating at the bar root; already-bookmarked pages show
  Move…/Rename…/Remove/Done — never a duplicate by default
- **Inbox + triage**: saves default to a real `Inbox` folder under Other
  Bookmarks (created on first save); the header pill shows its count, and
  the pill or `Tab` starts one-at-a-time triage, oldest first — `F` file,
  `D`/Backspace delete, `Space` skip, `↵` open in a background tab, `esc`
  exit, ending in Inbox zero
- "Open All in New Tabs" on a bookmark folder collects the tabs into a tab
  group named after the folder
- Single **Open palette** keyboard shortcut (`Cmd+P`) — the dedicated
  command-mode binding was removed; type `>` for commands
- Library polish: large breadcrumb title, `⌘D` opens the save flow, root
  shows Bookmarks Bar / Other Bookmarks as labeled sections (account
  bookmark storage handled), red ribbon icon on Browse Bookmarks, and the
  whole mode wears bookmark red
- **Folder colors**: `⌘K` → Set Color… tints the folder glyph everywhere
  (eight presets, synced)
- **Tab groups**: `@` browsing sections tabs by group (duplicates
  disambiguated), the active tab is marked, groups are editable from `⌘K`
  (rename, recolor, ungroup all), and "New Group from Tab" works again
- **Mode launchers** ("Search History", "Browse Bookmarks", …) searchable
  from the home view; mode chips condensed to colored glyphs that expand on
  hover; Esc steps out of a mode instead of closing; mode-specific
  placeholders
- `~` Files renamed to Downloads (teal); "Open Downloads" enters the mode
- **Reopen Closed Tab** command; recently-closed trimmed to a 3-item tail
  while browsing `@`
- First-item keyboard selection scrolls the list to the very top; both
  footer menus fade in

## 0.20.0

- Favorited items show a gold star badge in result rows
- `⌘K` acts on the focused favorite tile instead of the first list row
- Favorite selection ring animates, and keyboard focus scrolls the bar into view
- Icons on every `⌘K` action row, matching the brand menu
- Version bump release for the favorites polish round

## 0.19.0

- **In-palette settings**: the gear (now the bottom-left logo menu) swaps the
  list for a Raycast-style settings form — appearance, opacity, colors,
  default mode, toggles, frecency decay, and the quicklinks/snippets/disabled
  sites editors — auto-saving and applying live
- **Brand menu**: bottom-left logo opens Settings, Send Feedback, Keyboard
  Shortcuts, and the version; hover box around the logo
- **Back arrow** replaces the mode chips while browsing a bookmark folder
- Solid footer bar (the glass stops above it); footer gear removed
- Curated command order while browsing `>`; typed queries still rank by
  match + usage, so related commands (all the zoom ones, etc.) stay together
- Snippets prefix moved from `;` to `%`
- Logo renders black in light mode
- Fixed: `no-motion` class stuck for the session after toggling Reduce Motion

## 0.18.1

- **Light mode**: Appearance setting (System / Dark / Light) themes the
  palette, toast, and options page
- Fixed: `⌘K` menu appeared transparent — list rows painted over it (z-order)
- Tabs mode color changed from cyan to rose so it reads apart from command blue
- macOS-style filled blue folder icon on a transparent tile (folder color
  setting removed)
- Removed: the popup UI entirely — the injected palette is the only UI; the
  toolbar icon toggles the palette, and the omnibox `b` keyword covers
  restricted pages
- Removed: granular Chrome settings commands (one "Open Chrome Settings"
  remains), Split Tab Right (Chrome has no split-view API), Open Chrome Flags
- Restructure: feature folders (`src/features/*`, `src/core/*`,
  `src/ui/shared/*`); palette builds as a self-contained IIFE in a second
  Vite pass; background split into per-mode search modules

## 0.18.0

- **Quicklinks**: keyword searches with a `{query}` placeholder
  (`yt lofi beats`), defaults for Google/YouTube/GitHub/Wikipedia/Maps,
  editable in Settings
- **Snippets**: prefix mode inserting reusable text blocks, managed in
  Settings, with frecency ranking
- **Unit conversions** in the calculator: length, mass, temperature, time,
  data (`5km in miles`, `72f in c`, `1.5gb in mb`)

## 0.17.1

- Mode chips animate their collapse so the active chip slides into place
- Mode-specific input placeholders ("Search history…", etc.)
- Only the active mode chip stays visible while a prefix mode is on
- Flat colors for active mode chips
- Hovering a favorite takes selection focus from the list

## 0.17.0

- **History in search**: history results rank alongside bookmarks and
  commands in the default mode, deduped against bookmarks
- **Favorites bar**: pin bookmarks, commands, and folders via `⌘K`; icon
  tiles with captions above Suggested, arrow-key navigation, synced via
  `storage.sync`
- **Mode colors**: prefix modes tint the input row (animated), render the
  typed prefix as a colored glyph, and light up the matching hint chip
- **Hue-shift gradient tiles** for all non-favicon result icons
- **URL navigation**: address-shaped queries (`google.com`,
  `localhost:3000`) get a direct "Open" row
- Go Back / Go Forward commands
- Solid background for the `⌘K` actions panel

## 0.15.0

- "Search Google" fallback row so no query dead-ends
- Unit tests for ranking, calculator, and helpers
- Chrome Web Store listing kit: icon, screenshots, promo tiles, privacy
  policy; SuperChrome Dark theme prepared for store publishing

## 0.14.x

- Native color picker command (`0.14.0`); always copies and toasts (`0.14.1`)
- Copy toasts in the popup/tab palette (`0.14.2`)

## 0.13.x

- UI polish pass and copy-page commands (`0.13.0`)
- `prefers-reduced-motion` support and Reduce Motion setting (`0.13.1`)
- Full emoji set with names under each glyph (`0.13.2`)

## 0.12.x

- Sectioned home view: Suggested, then Bookmarks with folders first
  (`0.12.0`); Commands section on the home view (`0.12.1`)
- Download results get file-type icons and colors (`0.12.2`)

## 0.11.x

- Reorder bookmarks with `Alt+↑/↓` while browsing a folder (`0.11.0`)
- "Open results in a new tab" setting (`0.11.1`)
- Palette opens as a tab on restricted pages, with source-tab command
  routing and reliability fixes (`0.11.2`–`0.11.6`)

## 0.10.x

- Tab groups, downloads mode, generic menu-click bridge (`0.10.0`)
- Per-command icons and colors in the `>` list (`0.10.1`)

## 0.9.x

- Inline calculator and emoji search (`0.9.0`)
- Settings gear in the footer; copy toasts; history favicons

## 0.8.0

- Options page

## 0.7.x

- Renamed to **SuperChrome**: folder navigation, colored icons, numbered
  actions; logo across toolbar, footer, and README

## 0.6.0

- Recently closed tabs, all-window tab search

## 0.5.0

- Match highlighting, `⌘1–9` quick open, markdown links, popup actions

## 0.4.0

- Frecency ranking, history search mode, `⌘K` actions panel

## 0.3.x

- Popup palette for `chrome://` pages; keyboard shortcuts open it on
  restricted pages

## 0.1.0

- Initial release: Raycast-style bookmark command palette for Chrome, with
  the native messaging bridge for opening real DevTools on macOS
