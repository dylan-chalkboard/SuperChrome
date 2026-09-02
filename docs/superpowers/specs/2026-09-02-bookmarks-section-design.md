# Bookmarks Section ("Library") — Design

**Date:** 2026-09-02
**Status:** Approved for planning
**Version target:** 0.21.0

## Why

Bookmarks are SuperChrome's core subject, but today they're only "the default
search results" plus a bare folder-browse. Saving dumps pages at the bar root
with no folder choice; organizing is one-at-a-time Cmd+K round trips. This
design gives bookmarks a first-class section of the palette — a dedicated
view with a real save flow and a fast way to process saves.

## Scope

**V1 (this spec):** the section shell (view, navigation, rich rows), the
save flow, and Inbox + triage.

**Explicitly v2 (not in this spec):** bulk select/marking, cleanup tools
(duplicate finder, dead-link check, empty folders), drag-and-drop, tags.

## Entry and mode behavior

- New prefix `!` enters the section; `PREFIX_CHARS` gains `!`, mode name
  `library`.
- Header chip `! Bookmarks` joins the hint row; active state uses the
  section's mode color, **star gold `#e8c341`** (tint, glyph, chip — same
  choreography as other modes; other chips collapse).
- Placeholder: `Search bookmarks…`.
- Backspace on an empty query: goes **up one folder level** while below the
  root; at the root it exits the mode (matching the folder-browse precedence
  that already exists in bookmarks mode).
- `>Bookmark Current Tab` and the section's ＋ New button both open the save
  flow (below). The existing plain-text blended search is unchanged.

## The shell

A dedicated view rendered by its own module (the settings-view pattern), not
through `renderItems`.

**Section header** (below the input row):

- **Breadcrumb**: `Bookmarks / <folder> / <subfolder>`; every segment is
  clickable and jumps to that level. Root shows the top-level roots
  (Bookmarks Bar, Other Bookmarks, …) merged into one list, folders first.
- **Inbox pill** with a count badge (item count of the Inbox folder).
  Clicking it — or pressing `Tab` while the list has focus — starts triage.
  Hidden when the Inbox has no items and doesn't exist.
- **＋ New** button: opens the save flow for the current page.

**List**: folders first, then bookmarks.

- Folder rows: blue folder glyph, name, `N items` on the right.
- Bookmark rows: favicon, title, short URL, and age from `dateAdded`
  (`2d ago`), star badge if favorited.
- Enter: drill into folder / open bookmark (`Cmd+Enter` = other-tab
  behavior, as elsewhere). Backspace or the header back arrow goes up one
  level. Cmd+K opens the existing actions panel for the row (rename, move,
  favorite, delete, …). Alt+↑/↓ reordering keeps working when browsing.

**Typing** runs a **global** bookmark-only search (bookmarks and folders,
no commands/history/calculator). Result rows show their folder path. Enter
on a folder result jumps into that folder and clears the query; clearing
the query manually returns to the folder being browsed before the search.

## Save flow

Opened by `>Bookmark Current Tab` or ＋ New.

**New page** (URL not bookmarked): panel with

- Title field, pre-filled from the page, editable, focused.
- Folder picker: fuzzy list of all folders, **Inbox** preselected. Typing a
  name that matches nothing offers `Create folder "<query>"` (created under
  Other Bookmarks).
- Enter saves (Chrome `bookmarks.create`), shows a toast, returns to the
  previous view.

**Already bookmarked** (URL exists in the tree): the panel opens in
already-saved state instead — shows the bookmark's title and folder, with
actions Move…, Rename…, Remove Bookmark, and Done. Saving a duplicate is
never the default.

## Inbox + triage

- The Inbox is a **real Chrome folder named `Inbox`**, resolved by name at
  the top level of Other Bookmarks; created on first save if missing. No
  shadow state — users can touch it from any browser surface.
- Save flow defaults to it; the pill badge is its child count.
- **Triage** (Inbox pill or `Tab`): one bookmark at a time, oldest first —
  large title, URL, age, and `N of M` progress. Keys:
  - **F** — file: fuzzy folder picker (same component as save flow); moves
    the bookmark and advances.
  - **Backspace / D** — delete the bookmark and advance.
  - **Space** — skip (stays in Inbox) and advance.
  - **Enter** — open it (background tab) without leaving triage.
  - **Esc** — exit triage back to the section.
- Triage ends when the queue is done ("Inbox zero" state) or on Esc.

## Architecture

- **View module**: `src/features/bookmarks/view.ts` (imported by
  `palette.ts`) owns rendering and key handling for the section, the save
  panel, and triage. `palette.ts` routes to it when the mode is `library`,
  the way it routes to the settings view. Popup is unaffected (frozen).
- **Pure logic** in `src/features/bookmarks/library.ts`: breadcrumb path
  building, folder-tree flattening for the picker, Inbox resolution rules,
  save-state decision (new vs already-saved), triage queue ordering. Unit
  tested.
- **Background messages** (added to the router):
  - `library-list { folderId? }` → children with `dateAdded`, counts
  - `bookmark-create { title, url, parentId }`
  - `folder-create { title, parentId }`
  - `bookmark-find-url { url }` → matching bookmark + its folder path
  - `inbox-info` → Inbox folder id + count (creating nothing)
  - Existing messages reused: folders list, rename, move, delete, open-url.
- **Mode plumbing**: `PREFIX_CHARS`, `mode()`, `MODE_PREFIX`,
  `MODE_PLACEHOLDERS`, chip markup/CSS, tint/glyph colors — one addition
  each, mirroring snippets.
- No new permissions. No storage beyond Chrome's bookmark tree.

## Error handling

- Bookmark APIs can reject (e.g., folder deleted mid-flow): failures toast
  a short message and re-render the current level rather than crashing the
  view.
- The save flow guards against pages without a URL (chrome:// etc. can't
  be reached anyway — palette doesn't run there).
- Triage re-reads the Inbox before starting; deletions elsewhere during
  triage are tolerated (a vanished item is skipped).

## Testing

- Unit tests (vitest) for `library.ts`: breadcrumbs, picker flattening,
  Inbox resolution, save-state decision, triage ordering/advance rules.
- View behavior verified manually, consistent with the rest of the UI
  (no DOM test harness exists in this repo).

## Light/dark

All new UI uses the existing theme classes; every new element gets a
`.light` variant, matching the settings view.
