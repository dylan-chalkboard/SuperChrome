# Quicklinks Creation Flow + Static Links

**Date:** 2026-09-04
**Status:** Approved

## Goal

Bring SuperChrome's quicklinks up to the Raycast experience: create them from
inside the palette instead of a settings textarea, and support plain static
links (no `{query}`) that open directly. The existing keyword-search mechanic
(`yt lofi beats`) is unchanged.

## Background

Quicklinks today are keyword search shortcuts stored as
`keyword | Name | template` lines, edited only via a textarea in the settings
view / options page. A template must contain `{query}` and only fires when
typed as `keyword argument`. Raycast's quicklinks additionally support static
links, match by name in root search, and are created through a small form
(Name / Link, with a placeholder hint) — that form is the model for this work.

## Design

### 1. Data model (`src/features/quicklinks/index.ts`)

- `Quicklink { keyword, name, template }` keeps its shape; `template` no
  longer has to contain `{query}`.
- `parseQuicklinks` / `serializeQuicklinks` keep the 3-part pipe format and
  drop only the `{query}` requirement. Existing settings text stays valid.
- `matchQuicklink` gains a static branch: input that is exactly a keyword
  whose template lacks `{query}` yields an open-link match. Keyword +
  argument on a `{query}` template behaves exactly as today. Keyword +
  argument on a static template does not match.
- New `searchQuicklinksByName(query, links)` fuzzy-matches quicklinks by
  their `name` field for root-search integration.

### 2. Root search integration (`src/features/bookmarks/search.ts`)

A quicklink can surface three ways:

1. **Keyword + argument** (`yt lofi`) — unchanged: "Search YouTube for
   'lofi'", opens the substituted URL.
2. **Exact bare keyword on a static link** (`dash`) — an "Open Team
   Dashboard" row in the Quicklink group.
3. **Fuzzy name match** (`team da…`) — quicklink rows appear alongside
   bookmark results with the site favicon. Selecting a static link opens
   it. Selecting a `{query}` link fills the palette input with `keyword `
   (trailing space) so the user types the argument — the adapted version of
   Raycast's argument prompt.

Static-keyword and name matches are offered as rows, never auto-opened, so
collisions with bookmark queries are harmless.

### 3. Creation form (`src/palette.ts`, new `quicklink-edit` UI state)

- New `UiState` value `quicklink-edit`, alongside `settings` / `fav-custom`,
  rendered in the list area with the settings view's row/input styling.
- Fields: **Keyword**, **Name**, **Link**, plus a hint line: "Include
  {query} to make it a search".
- No icon field — the site favicon is used automatically.
- `↵` saves from any field; `esc` cancels back to the list.
- Saving writes through the existing settings persistence path and returns
  to the list with the new quicklink live.
- The same form serves both entry commands; "Save Page as Quicklink" opens
  it prefilled.

### 4. Commands (`src/features/commands/index.ts` + palette handler)

- `create-quicklink` → **Create Quicklink** — opens the empty form.
- `save-page-quicklink` → **Save Page as Quicklink** — opens the form
  prefilled with the active tab's title (Name) and URL (Link), focus on
  Keyword.
- Edit/delete remains in the existing settings textarea (palette settings
  view and options page). No new management UI.

### 5. Validation

- All three fields required.
- Keyword is lowercased and must be unique among existing quicklinks;
  collisions show an inline error rather than overwriting.
- Link must be an `http(s)` URL (validated with `{query}` substituted when
  present).

### 6. Testing & release

- Unit tests in `src/lib.test.ts`: static lines parse, `matchQuicklink`
  static branch (bare keyword matches, keyword+argument does not),
  `searchQuicklinksByName` fuzzy behavior, serialize round-trip without
  `{query}`.
- Pre-commit gate as always: `tsc && tests && build` as a strict `&&` chain.
- Ship as v0.30.0 with a CHANGELOG entry.

## Out of scope

- Keyword-less quicklinks (keyword stays required; name matching makes it
  less load-bearing).
- Editing/deleting quicklinks from the palette rows or an actions menu.
- Raycast's Organization / Open With / Icon fields — not applicable.
- Additional dynamic placeholders beyond `{query}` (selected text,
  clipboard, etc.).
