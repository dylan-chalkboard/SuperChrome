# Quicklinks Arguments Engine + Dynamic Placeholders

**Date:** 2026-09-04
**Status:** Approved
**Builds on:** 2026-09-04-quicklinks-creation-design.md (v0.30.0)

## Goal

Bring SuperChrome quicklinks to parity with Raycast's argument system:
named arguments with dropdown options and defaults, dynamic placeholders
substituted at open time, pipe modifiers, and in-palette management
(edit / duplicate / delete). Ships as v0.31.0.

## Placeholder engine (`src/features/quicklinks/placeholders.ts`)

Pure, fully unit-tested. Parses templates into literal and placeholder
segments.

Supported placeholders:

- `{argument}` / `{query}` (alias) — prompts the user. Attributes:
  - `name="repo"` — same name reused in the URL fills both spots with one
    value; anonymous arguments are positional and distinct.
  - `default="main"` — argument becomes optional; when unprompted the
    default is used.
  - `options="en, es, fr"` — dropdown choices; `Label|value` entries give
    friendly labels for encoded values.
- `{clipboard}` — clipboard text at open time.
- `{selection}` — the page's selected text, captured when the palette opens.
- `{date}`, `{time}`, `{datetime}`, `{day}` — with `format="yyyy-MM-dd"`
  (tokens: yyyy yy MMM MM M dd d HH H hh h mm ss a) and `offset="+2d -1M"`
  (units m h d M y).
- `{uuid}` — random UUID.

Modifiers via pipe, applied in order: `trim`, `uppercase`, `lowercase`,
`percent-encode`, `raw`. User content (argument/clipboard/selection) is
percent-encoded by default (templates are URLs); `raw` disables it.
Generated values (dates, uuid) render as-is unless `percent-encode` is
asked for explicitly.

Unknown placeholder types are left as literal text. Not supported (out of
scope): `{calculator}`, `{browser-tab}`, `{snippet}`, `{cursor}`, clipboard
history offsets, date `locale=`.

API:

- `parseTemplate(template)` → segments
- `templateArguments(template)` → ordered `ArgumentSpec[]` (deduped by
  name; anonymous args keyed positionally)
- `renderTemplate(template, ctx)` → final URL; ctx carries argument
  values, clipboard, selection, `now`, and a uuid factory (injectable for
  tests).

## Matching (`src/features/quicklinks/index.ts`, `bookmarks/search.ts`)

`matchQuicklink` returns `{ link, rest, args }`:

- keyword with no arguments (static or dynamic-only template): bare
  keyword matches, any trailing text does not.
- keyword with arguments: bare keyword matches (prompt flow), and
  `keyword text` matches with `rest` prefilling the first argument (for a
  dropdown argument, `rest` matches an option by label or value,
  case-insensitively; otherwise it is used verbatim).

Quicklink rows (exact-keyword and name-matched alike) carry the template
and any prefilled first-argument text; final URL construction moves to the
palette at open time, because clipboard and selection only exist in the
page. The v0.30.0 `fillInput` mechanism is removed in favor of the prompt
flow.

Row labels: no arguments → "Open <Name>"; arguments with rest typed →
"Search <Name> for “rest”"; arguments pending → "Open <Name>…".

## Argument prompt flow (palette, new `ql-args` UI state)

Palette-native sequential prompting:

- Selecting an arg-ful quicklink starts the flow. The input clears; its
  placeholder shows the argument name (or "value").
- Dropdown argument: options render as result rows (typing filters,
  Enter picks; labels shown, values substituted).
- Free-text argument: a single row previews "<name>: <typed>"; Enter
  commits.
- Arguments with defaults are skipped (default used). Multiple arguments
  prompt in template order. Esc steps back one argument, then exits to
  the list with the pre-flow query restored.
- After the last argument the palette renders the template — capturing
  `window.getSelection()` at palette open and reading the clipboard via
  `navigator.clipboard.readText()` (empty string on failure; manifest
  gains `clipboardRead`) — and opens the URL.

## Management

Quicklink rows get ⌘K actions:

- **Edit** — opens the quicklink-edit form prefilled; saving replaces the
  original (matched by its pre-edit keyword; the uniqueness check ignores
  the row being edited).
- **Duplicate** — opens the form prefilled with the same link, name
  "<Name> Copy", empty keyword.
- **Delete** — removes it, toast confirms, list refreshes.

The pipe-format settings textarea remains the bulk import/export surface;
no JSON import/export.

## Form copy

Create-form hint becomes: "Include {argument} to prompt (add
options=\"a, b\" for a dropdown) — or {clipboard}, {selection}, {date},
{uuid}. {query} still works."

## Testing & release

- Engine: exhaustive unit tests (parse, attrs, options label|value,
  modifiers, encoding defaults, dates with format/offset, uuid injection,
  unknown placeholders literal).
- Matching: updated matchQuicklink tests (args, rest prefill, dropdown
  rest matching).
- Gate: `tsc && vitest && build`; ship v0.31.0 with CHANGELOG entry.
