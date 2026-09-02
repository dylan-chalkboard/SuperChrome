/**
 * Pure logic for the bookmarks section ('!' library mode): breadcrumb
 * building, folder-picker flattening/filtering, Inbox resolution, the
 * new-vs-already-saved decision, and triage queue ordering. No Chrome APIs —
 * everything here is unit-tested.
 */

export interface LibraryNodeLike {
  id: string
  title: string
  url?: string
  dateAdded?: number
}

/* ---------- Breadcrumbs ---------- */

export interface CrumbSegment {
  /** null marks the merged root level ("Bookmarks"). */
  id: string | null
  label: string
}

/** The clickable breadcrumb path for the current library folder stack. */
export function breadcrumbSegments(
  stack: ReadonlyArray<{ id: string; label: string }>,
): CrumbSegment[] {
  return [{ id: null, label: 'Bookmarks' }, ...stack.map((s) => ({ id: s.id, label: s.label }))]
}

/* ---------- Listing order ---------- */

/** Section lists always show folders first, then bookmarks, order preserved. */
export function foldersFirst<T extends { url?: string }>(items: readonly T[]): T[] {
  return [...items.filter((i) => !i.url), ...items.filter((i) => !!i.url)]
}

/** Right-hand count label on folder rows. */
export function countLabel(n: number): string {
  return n === 1 ? '1 item' : `${n} items`
}

/* ---------- Folder picker ---------- */

/** Subsequence fuzzy score; null when the query isn't a subsequence. */
export function fuzzyScore(query: string, text: string): number | null {
  if (!query) return 0
  let qi = 0
  let score = 0
  let streak = 0
  for (let ti = 0; ti < text.length && qi < query.length; ti++) {
    if (text[ti] === query[qi]) {
      streak++
      score += 1 + streak * 2
      qi++
    } else {
      streak = 0
    }
  }
  return qi === query.length ? score : null
}

export interface FolderOption {
  id: string
  path: string
}

export interface PickerRow {
  /** null for synthetic rows (virtual Inbox, "Create folder"). */
  id: string | null
  label: string
  /** Row that creates a folder named after the query. */
  create?: boolean
  /** Row for the Inbox folder that doesn't exist yet (created on save). */
  virtualInbox?: boolean
}

/**
 * Fuzzy-filtered rows for the save-flow/triage folder picker. When no real
 * Inbox exists, a virtual Inbox row is offered (the save flow creates it);
 * a query matching nothing yields a single `Create folder "<query>"` row.
 */
export function folderPickerRows(
  folders: readonly FolderOption[],
  query: string,
  hasInbox: boolean,
): PickerRow[] {
  const q = query.trim().toLowerCase()
  const scored: Array<{ row: PickerRow; score: number }> = []
  if (!hasInbox) {
    const s = fuzzyScore(q, 'inbox')
    if (s !== null) scored.push({ row: { id: null, label: 'Inbox', virtualInbox: true }, score: s })
  }
  for (const f of folders) {
    const s = fuzzyScore(q, f.path.toLowerCase())
    if (s !== null) scored.push({ row: { id: f.id, label: f.path }, score: s })
  }
  // Stable sort: equal scores keep original order (virtual Inbox first).
  const rows = scored
    .map((entry, index) => ({ ...entry, index }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((x) => x.row)
  if (!rows.length && q) {
    rows.push({ id: null, label: `Create folder "${query.trim()}"`, create: true })
  }
  return rows
}

/** Index of the row to preselect: the Inbox (real or virtual), else the top. */
export function defaultPickerIndex(rows: readonly PickerRow[], inboxId: string | null): number {
  const index = rows.findIndex((r) => (inboxId !== null ? r.id === inboxId : r.virtualInbox))
  return index >= 0 ? index : 0
}

/* ---------- Inbox resolution ---------- */

/**
 * The Inbox is a real folder named "Inbox" at the top level of Other
 * Bookmarks — resolved by name (case-insensitive), never shadow state.
 */
export function resolveInbox(otherChildren: readonly LibraryNodeLike[]): LibraryNodeLike | null {
  return otherChildren.find((c) => !c.url && c.title.trim().toLowerCase() === 'inbox') ?? null
}

/* ---------- Save-state decision ---------- */

export type SaveDecision<T> = { state: 'new' } | { state: 'saved'; match: T }

/** New bookmark vs already-saved, given find-by-url results for the page. */
export function decideSaveState<T extends { url?: string }>(
  url: string,
  matches: readonly T[],
): SaveDecision<T> {
  const match = matches.find((m) => m.url === url)
  return match ? { state: 'saved', match } : { state: 'new' }
}

/* ---------- Triage ---------- */

/** Triage processes the Inbox's bookmarks (folders skipped), oldest first. */
export function triageQueue<T extends { url?: string; dateAdded?: number }>(
  items: readonly T[],
): T[] {
  return items.filter((i) => !!i.url).sort((a, b) => (a.dateAdded ?? 0) - (b.dateAdded ?? 0))
}
