/**
 * Library ('*') section view: rendering and key handling for the section
 * shell, the save flow, and Inbox triage. palette.ts routes here when the
 * mode is 'library' (the settings-view pattern). Browse/search rows reuse the
 * palette's .item machinery through kit.renderRows, so arrows, Enter, and ⌘K
 * behave exactly like every other list.
 */

import { ago } from '../navigation'
import type { RemoteItem } from '../../ui/shared/types'
import {
  breadcrumbSegments,
  countLabel,
  defaultPickerIndex,
  folderPickerRows,
  triageQueue,
} from './library'
import type { FolderOption, PickerRow } from './library'

/** Appended to the palette stylesheet; every rule has a .light variant. */
export const LIBRARY_CSS = `
.lib-head { display: flex; align-items: center; gap: 8px; padding: 12px 10px 6px 4px; }
.lib-crumbs {
  display: flex; align-items: baseline; gap: 2px; flex: 1; min-width: 0;
  overflow: hidden; white-space: nowrap; font-size: 12.5px; color: #ffffff59;
}
.lib-seg { cursor: pointer; padding: 2px 6px; border-radius: 5px; }
.lib-seg:hover { background: #ffffff14; color: #e8e8e8; }
.lib-seg.current { color: #ffffff; font-weight: 700; font-size: 17px; cursor: default; }
.lib-seg.current:hover { background: transparent; }
.lib-sep { color: #ffffff30; }
.lib-pill {
  display: flex; align-items: center; gap: 6px; flex: none; cursor: pointer;
  padding: 3px 9px; border-radius: 999px;
  background: rgba(224, 93, 93, 0.16); color: #e97070;
  font-size: 11.5px; font-weight: 600;
}
.lib-pill:hover { background: rgba(224, 93, 93, 0.28); }
.lib-badge {
  background: #e05d5d; color: #ffffff; border-radius: 999px;
  padding: 0 5px; font-size: 10px; font-weight: 700; line-height: 15px;
}
.lib-new {
  flex: none; cursor: pointer; padding: 3px 9px; border-radius: 999px;
  background: #ffffff14; color: #ccccccbb; font-size: 11.5px;
}
.lib-new:hover { background: #ffffff24; color: #ffffff; }
.lib-panel { padding: 18px 22px; display: flex; flex-direction: column; gap: 9px; }
.lib-panel-title { font-size: 13px; font-weight: 600; color: #ffffff8c; }
.lib-label { font-size: 11px; color: #ffffff59; }
.lib-input {
  background: #ffffff10; border: 1px solid #ffffff20; border-radius: 8px;
  color: #e8e8e8; font: inherit; font-size: 14px; padding: 8px 10px; outline: none;
}
.lib-input:focus { border-color: rgba(224, 93, 93, 0.45); }
.lib-input::placeholder { color: #ffffff40; }
.lib-saved-title {
  font-size: 15px; font-weight: 600; color: #f2f2f2;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.lib-pick { display: flex; flex-direction: column; gap: 1px; max-height: 230px; overflow-y: auto; }
.lib-pick-row {
  display: flex; align-items: center; gap: 8px; flex: none;
  padding: 6px 10px; border-radius: 7px; cursor: pointer;
  color: #e0e0e0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.lib-pick-row.selected { background: rgba(255, 255, 255, 0.14); }
.lib-pick-row.danger { color: #ff8f8f; }
.lib-triage {
  padding: 36px 26px 30px; display: flex; flex-direction: column;
  align-items: center; gap: 8px; text-align: center;
}
.lib-triage-count { font-size: 11px; font-weight: 700; color: #e05d5d; letter-spacing: 0.4px; }
.lib-triage-title {
  max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-size: 19px; font-weight: 600; color: #f2f2f2;
}
.lib-triage-url {
  max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-size: 12.5px; color: #ffffff59;
}
.lib-triage-age { font-size: 11.5px; color: #ffffff40; }
.lib-triage-keys {
  display: flex; gap: 14px; flex-wrap: wrap; justify-content: center;
  margin-top: 18px; font-size: 11.5px; color: #cccccc80;
}
.lib-triage-keys .kbd { margin-right: 5px; }
.lib-zero { padding: 60px 20px; text-align: center; font-size: 16px; font-weight: 600; color: #e8e8e8; }
.lib-zero small { display: block; margin-top: 6px; font-size: 12px; font-weight: 400; color: #ffffff59; }
.light .lib-crumbs { color: #00000059; }
.light .lib-seg:hover { background: #00000010; color: #1c1c1e; }
.light .lib-seg.current { color: #1c1c1e; }
.light .lib-seg.current:hover { background: transparent; }
.light .lib-sep { color: #00000030; }
.light .lib-pill { background: rgba(200, 54, 44, 0.12); color: #b33a31; }
.light .lib-pill:hover { background: rgba(200, 54, 44, 0.22); }
.light .lib-badge { background: #c8362c; color: #ffffff; }
.light .lib-new { background: #00000010; color: #00000080; }
.light .lib-new:hover { background: #0000001c; color: #1c1c1e; }
.light .lib-panel-title { color: #00000073; }
.light .lib-label { color: #00000045; }
.light .lib-input { background: #00000008; border-color: #00000020; color: #26262b; }
.light .lib-input:focus { border-color: rgba(200, 54, 44, 0.45); }
.light .lib-input::placeholder { color: #00000040; }
.light .lib-saved-title { color: #1c1c1e; }
.light .lib-pick-row { color: #303036; }
.light .lib-pick-row.selected { background: rgba(0, 0, 0, 0.08); }
.light .lib-pick-row.danger { color: #d03d3d; }
.light .lib-triage-count { color: #b33a31; }
.light .lib-triage-title { color: #1c1c1e; }
.light .lib-triage-url { color: #00000059; }
.light .lib-triage-age { color: #00000045; }
.light .lib-triage-keys { color: #00000066; }
.light .lib-zero { color: #1c1c1e; }
.light .lib-zero small { color: #00000059; }
`

/** Hooks into the palette's live DOM and list machinery. */
export interface LibraryKit {
  list(): HTMLElement | null
  input(): HTMLInputElement | null
  renderRows(groupLabel: string, items: RemoteItem[], header: HTMLElement): void
  send(message: Record<string, unknown>): Promise<Record<string, unknown> | undefined>
  toast(message: string): void
  /** Re-runs the palette's updateList (which routes back into this view). */
  refresh(): void
  hideInputRow(hidden: boolean): void
  enterRename(item: RemoteItem): void
  kbd(text: string): HTMLElement
}

interface LibraryChild {
  id: string
  title: string
  url?: string
  dateAdded?: number
  count?: number
  group?: string
}

type LibState = 'browse' | 'save' | 'saved' | 'save-move' | 'triage' | 'triage-file' | 'zero'

let kit: LibraryKit | null = null
let state: LibState = 'browse'
let stack: Array<{ id: string; label: string }> = []
let inboxId: string | null = null
let inboxCount = 0
let renderToken = 0

/* Save flow */
let savePage: { title: string; url: string } | null = null
let savedMatch: { id: string; title: string; url: string } | null = null
let savedPath = ''
let savedIndex = 0
let titleInput: HTMLInputElement | null = null
let filterInput: HTMLInputElement | null = null
let pickerListEl: HTMLElement | null = null
let folderOptions: FolderOption[] = []
let pickRows: PickerRow[] = []
let pickIndex = 0
let pickQuery = ''
let pickerPreselectInbox = false

/* Triage */
let queue: Array<{ id: string; title: string; url: string; dateAdded?: number }> = []
let queueIndex = 0
let zeroTimer: ReturnType<typeof setTimeout> | undefined

export function initLibrary(k: LibraryKit): void {
  kit = k
}

export function libraryDepth(): number {
  return stack.length
}

export function libraryCurrentFolderId(): string | undefined {
  return stack.length ? stack[stack.length - 1].id : undefined
}

/** Snapshot/restore of the browse stack, for palette state restoration. */
export function libraryStackSnapshot(): Array<{ id: string; label: string }> {
  return [...stack]
}

export function restoreLibraryStack(saved: Array<{ id: string; label: string }>): void {
  stack = [...saved]
}

/** True while a save panel or triage owns the keyboard and hides the input row. */
export function libraryOwnsInput(): boolean {
  return state !== 'browse'
}

/** Back to a clean browse state (palette closed or reopened). */
export function resetLibrary(): void {
  state = 'browse'
  stack = []
  savePage = null
  savedMatch = null
  titleInput = null
  filterInput = null
  pickerListEl = null
  queue = []
  queueIndex = 0
  clearTimeout(zeroTimer)
}

/* ---------- Browse / search rendering ---------- */

export async function renderLibrary(): Promise<void> {
  if (!kit) return
  // Save panel and triage own the list DOM; browse re-renders on refresh.
  if (state !== 'browse') return
  const query = kit.input()?.value.trim() ?? ''
  const token = ++renderToken
  if (query) {
    // Global bookmark-only search; rows carry their folder path.
    const resp = await kit.send({ type: 'palette-query', mode: 'library', query })
    if (token !== renderToken || state !== 'browse' || !kit.list()) return
    kit.renderRows('Results', (resp?.items as RemoteItem[] | undefined) ?? [], buildHeader())
    return
  }
  const folderId = stack.length ? stack[stack.length - 1].id : undefined
  const [listResp, inboxResp] = await Promise.all([
    kit.send({ type: 'library-list', folderId }),
    kit.send({ type: 'inbox-info' }),
  ])
  if (token !== renderToken || state !== 'browse' || !kit.list()) return
  inboxId = (inboxResp?.folderId as string | null | undefined) ?? null
  inboxCount = (inboxResp?.count as number | undefined) ?? 0
  if (!listResp || listResp.error) {
    // Folder vanished mid-browse: toast and fall back to the root once.
    if (folderId) {
      kit.toast('Folder no longer exists')
      stack = []
      void renderLibrary()
    } else {
      kit.renderRows('Bookmarks', [], buildHeader())
    }
    return
  }
  // The reply carries the true ancestor chain — keeps breadcrumbs right
  // after search jumps and renames from other surfaces.
  if (folderId) stack = (listResp.path as Array<{ id: string; label: string }>) ?? stack
  const children = (listResp.items as LibraryChild[] | undefined) ?? []
  const items = children.map(
    (c): RemoteItem =>
      c.url
        ? {
            kind: 'bookmark',
            label: c.title || c.url,
            detail: '',
            url: c.url,
            id: c.id,
            typeText: c.dateAdded ? ago(c.dateAdded) : '',
            group: c.group,
          }
        : {
            kind: 'folder',
            label: c.title,
            detail: '',
            id: c.id,
            typeText: countLabel(c.count ?? 0),
            group: c.group,
          },
  )
  // No group label while browsing — the breadcrumb title already names the level.
  kit.renderRows('', items, buildHeader())
}

function buildHeader(): HTMLElement {
  const head = document.createElement('div')
  head.className = 'lib-head'
  const crumbs = document.createElement('div')
  crumbs.className = 'lib-crumbs'
  const segments = breadcrumbSegments(stack)
  segments.forEach((seg, index) => {
    if (index) {
      const sep = document.createElement('span')
      sep.className = 'lib-sep'
      sep.textContent = '/'
      crumbs.appendChild(sep)
    }
    const el = document.createElement('span')
    const last = index === segments.length - 1
    el.className = 'lib-seg' + (last ? ' current' : '')
    el.textContent = seg.label
    if (!last) {
      el.addEventListener('mousedown', (e) => {
        e.preventDefault()
        stack = stack.slice(0, index)
        clearQueryAndRender()
      })
    }
    crumbs.appendChild(el)
  })
  head.appendChild(crumbs)
  if (inboxId && inboxCount > 0) {
    const pill = document.createElement('span')
    pill.className = 'lib-pill'
    pill.title = 'Triage Inbox (Tab)'
    pill.textContent = 'Inbox'
    const badge = document.createElement('span')
    badge.className = 'lib-badge'
    badge.textContent = String(inboxCount)
    pill.appendChild(badge)
    pill.addEventListener('mousedown', (e) => {
      e.preventDefault()
      void startTriage()
    })
    head.appendChild(pill)
  }
  const add = document.createElement('span')
  add.className = 'lib-new'
  add.textContent = '＋ New'
  add.title = 'Bookmark current page (⌘D)'
  add.addEventListener('mousedown', (e) => {
    e.preventDefault()
    openLibrarySave()
  })
  head.appendChild(add)
  return head
}

function clearQueryAndRender(): void {
  const input = kit?.input()
  if (input) {
    input.value = ''
    input.focus()
  }
  kit?.refresh()
}

/** Enter on a folder row: drill in (search results jump, query clears). */
export function libraryEnterFolder(item: RemoteItem): void {
  if (!kit || !item.id) return
  void kit.send({ type: 'record-usage', key: `folder:${item.id}` })
  // The next browse render replaces this with the true ancestor path.
  stack = [...stack, { id: item.id, label: item.label }]
  clearQueryAndRender()
}

/** Up one folder level (header back arrow, Backspace on empty query). */
export function libraryUp(): void {
  if (!stack.length) return
  stack.pop()
  clearQueryAndRender()
}

/* ---------- Key routing ---------- */

/** Returns true when the key was consumed by the library view. */
export function libraryKey(e: KeyboardEvent): boolean {
  if (!kit) return false
  switch (state) {
    case 'browse':
      return browseKey(e)
    case 'save':
      return saveKey(e)
    case 'saved':
      return savedKey(e)
    case 'save-move':
    case 'triage-file':
      return pickerKey(e)
    case 'triage':
      return triageKey(e)
    case 'zero':
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        endTriage()
      }
      return true
  }
}

function browseKey(e: KeyboardEvent): boolean {
  const empty = !kit!.input()?.value
  if (e.key === 'Tab' && empty && inboxId && inboxCount > 0) {
    e.preventDefault()
    void startTriage()
    return true
  }
  if (e.key === 'Backspace' && empty && stack.length) {
    e.preventDefault()
    libraryUp()
    return true
  }
  if (e.key === 'Escape' && stack.length) {
    e.preventDefault()
    libraryUp()
    return true
  }
  return false
}

/* ---------- Save flow ---------- */

/** ＋ New or >Bookmark Current Tab: open the save flow for this page. */
export function openLibrarySave(): void {
  if (!kit) return
  const url = location.href
  if (!url || !/^(https?|file|ftp):/i.test(url)) {
    kit.toast('This page can’t be bookmarked')
    return
  }
  savePage = { title: document.title || url, url }
  void beginSave()
}

async function beginSave(): Promise<void> {
  if (!kit || !savePage) return
  const find = await kit.send({ type: 'bookmark-find-url', url: savePage.url })
  if (!kit.list()) return
  kit.hideInputRow(true)
  const match = find?.match as { id: string; title: string; url: string } | null | undefined
  if (match) {
    // Already bookmarked: never default to saving a duplicate.
    savedMatch = match
    savedPath = (find?.folderPath as string | undefined) ?? ''
    savedIndex = 0
    state = 'saved'
    renderSavedPanel()
    return
  }
  const [foldersResp, inboxResp] = await Promise.all([
    kit.send({ type: 'folders' }),
    kit.send({ type: 'inbox-info' }),
  ])
  if (!kit.list()) return
  folderOptions = (foldersResp?.folders as FolderOption[] | undefined) ?? []
  inboxId = (inboxResp?.folderId as string | null | undefined) ?? null
  inboxCount = (inboxResp?.count as number | undefined) ?? 0
  state = 'save'
  renderSavePanel()
}

function textEl(className: string, text: string): HTMLElement {
  const el = document.createElement('div')
  el.className = className
  el.textContent = text
  return el
}

function libInput(placeholder: string): HTMLInputElement {
  const input = document.createElement('input')
  input.className = 'lib-input'
  input.placeholder = placeholder
  input.spellcheck = false
  return input
}

function renderSavePanel(): void {
  const list = kit?.list()
  if (!list || !savePage) return
  list.textContent = ''
  const panel = document.createElement('div')
  panel.className = 'lib-panel'
  titleInput = libInput('Title')
  titleInput.value = savePage.title
  filterInput = libInput('Search folders…')
  filterInput.addEventListener('input', () => refilterPicker(filterInput?.value ?? ''))
  pickerListEl = document.createElement('div')
  pickerListEl.className = 'lib-pick'
  panel.append(
    textEl('lib-panel-title', 'Save Bookmark'),
    textEl('lib-label', 'Title'),
    titleInput,
    textEl('lib-label', 'Folder'),
    filterInput,
    pickerListEl,
    textEl('lib-label', '↵ Save · ⇥ Switch field · esc Cancel'),
  )
  list.appendChild(panel)
  pickerPreselectInbox = true
  refilterPicker('')
  titleInput.focus()
}

function saveKey(e: KeyboardEvent): boolean {
  if (e.key === 'Escape') {
    e.preventDefault()
    closePanel()
  } else if (e.key === 'Enter') {
    e.preventDefault()
    void commitSave()
  } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault()
    movePick(e.key === 'ArrowDown' ? 1 : -1)
  } else if (e.key === 'Tab') {
    e.preventDefault()
    if (titleInput?.matches(':focus')) filterInput?.focus()
    else titleInput?.focus()
  }
  // Everything else falls through to the focused field, not the palette.
  return true
}

async function commitSave(): Promise<void> {
  const row = pickRows[pickIndex]
  if (!kit || !row || !savePage) return
  try {
    const parentId = await resolvePickerParent(row)
    const title = titleInput?.value.trim() || savePage.url
    const resp = await kit.send({ type: 'bookmark-create', title, url: savePage.url, parentId })
    if (!resp || resp.error) throw new Error(String(resp?.error))
    kit.toast('Bookmark saved')
  } catch {
    kit.toast('Couldn’t save bookmark')
  }
  closePanel()
}

/** Picker row → parent folder id, creating Inbox / "Create folder …" targets. */
async function resolvePickerParent(row: PickerRow): Promise<string> {
  if (row.create || row.virtualInbox) {
    const created = await kit!.send({
      type: 'folder-create',
      title: row.virtualInbox ? 'Inbox' : pickQuery.trim(),
    })
    const id = created?.id as string | undefined
    if (!id) throw new Error('folder-create failed')
    return id
  }
  if (!row.id) throw new Error('no folder selected')
  return row.id
}

function pickedLabel(row: PickerRow): string {
  return row.virtualInbox ? 'Inbox' : row.create ? pickQuery.trim() : row.label
}

/* ---------- Already-saved panel ---------- */

const SAVED_ACTIONS: Array<{ id: string; label: string; danger?: boolean }> = [
  { id: 'move', label: 'Move…' },
  { id: 'rename', label: 'Rename…' },
  { id: 'remove', label: 'Remove Bookmark', danger: true },
  { id: 'done', label: 'Done' },
]

function renderSavedPanel(): void {
  const list = kit?.list()
  if (!list || !savedMatch) return
  list.textContent = ''
  const panel = document.createElement('div')
  panel.className = 'lib-panel'
  panel.append(
    textEl('lib-panel-title', 'Already Saved'),
    textEl('lib-saved-title', savedMatch.title || savedMatch.url),
    textEl('lib-label', savedPath ? `in ${savedPath}` : 'in Bookmarks'),
  )
  const rows = document.createElement('div')
  rows.className = 'lib-pick'
  SAVED_ACTIONS.forEach((action, index) => {
    const row = document.createElement('div')
    row.className =
      'lib-pick-row' + (action.danger ? ' danger' : '') + (index === savedIndex ? ' selected' : '')
    row.textContent = action.label
    row.addEventListener('mousedown', (e) => {
      e.preventDefault()
      void runSavedAction(action.id)
    })
    row.addEventListener('mousemove', () => {
      if (savedIndex !== index) {
        savedIndex = index
        renderSavedPanel()
      }
    })
    rows.appendChild(row)
  })
  panel.appendChild(rows)
  list.appendChild(panel)
}

function savedKey(e: KeyboardEvent): boolean {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault()
    const delta = e.key === 'ArrowDown' ? 1 : -1
    savedIndex = (savedIndex + delta + SAVED_ACTIONS.length) % SAVED_ACTIONS.length
    renderSavedPanel()
  } else if (e.key === 'Enter') {
    e.preventDefault()
    void runSavedAction(SAVED_ACTIONS[savedIndex].id)
  } else if (e.key === 'Escape') {
    e.preventDefault()
    closePanel()
  }
  return true
}

async function runSavedAction(id: string): Promise<void> {
  if (!kit || !savedMatch) return
  if (id === 'done') {
    closePanel()
    return
  }
  if (id === 'remove') {
    const resp = await kit.send({ type: 'bookmark-delete', id: savedMatch.id })
    kit.toast(!resp || resp.error ? 'Couldn’t remove bookmark' : 'Bookmark removed')
    closePanel()
    return
  }
  if (id === 'rename') {
    // Hand off to the palette's existing rename sub-state.
    const item: RemoteItem = {
      kind: 'bookmark',
      label: savedMatch.title,
      detail: '',
      url: savedMatch.url,
      id: savedMatch.id,
    }
    state = 'browse'
    savePage = null
    savedMatch = null
    kit.hideInputRow(false)
    kit.enterRename(item)
    return
  }
  if (id === 'move') {
    const resp = await kit.send({ type: 'folders' })
    folderOptions = (resp?.folders as FolderOption[] | undefined) ?? []
    state = 'save-move'
    pickerPreselectInbox = false
    renderPickerPanel(`Move "${savedMatch.title || savedMatch.url}" to…`)
  }
}

function closePanel(): void {
  state = 'browse'
  savePage = null
  savedMatch = null
  titleInput = null
  filterInput = null
  pickerListEl = null
  kit?.hideInputRow(false)
  kit?.input()?.focus()
  kit?.refresh()
}

/* ---------- Folder picker (save flow + Move… + triage File) ---------- */

function renderPickerPanel(titleText: string): void {
  const list = kit?.list()
  if (!list) return
  list.textContent = ''
  const panel = document.createElement('div')
  panel.className = 'lib-panel'
  filterInput = libInput('Search folders…')
  filterInput.addEventListener('input', () => refilterPicker(filterInput?.value ?? ''))
  pickerListEl = document.createElement('div')
  pickerListEl.className = 'lib-pick'
  panel.append(textEl('lib-panel-title', titleText), filterInput, pickerListEl)
  list.appendChild(panel)
  refilterPicker('')
  filterInput.focus()
}

function refilterPicker(query: string): void {
  pickQuery = query
  pickRows = folderPickerRows(folderOptions, query, inboxId !== null)
  pickIndex =
    !query.trim() && pickerPreselectInbox ? defaultPickerIndex(pickRows, inboxId) : 0
  renderPickRows()
}

function renderPickRows(): void {
  if (!pickerListEl) return
  pickerListEl.textContent = ''
  if (!pickRows.length) {
    pickerListEl.appendChild(textEl('lib-label', 'No folders'))
    return
  }
  pickRows.forEach((row, index) => {
    const el = document.createElement('div')
    el.className = 'lib-pick-row' + (index === pickIndex ? ' selected' : '')
    el.textContent = row.label
    el.addEventListener('mousedown', (e) => {
      e.preventDefault()
      pickIndex = index
      if (state === 'save') void commitSave()
      else void commitPicker()
    })
    el.addEventListener('mousemove', () => {
      if (pickIndex !== index) {
        pickIndex = index
        renderPickRows()
      }
    })
    pickerListEl!.appendChild(el)
  })
  pickerListEl.children[pickIndex]?.scrollIntoView({ block: 'nearest' })
}

function movePick(delta: number): void {
  if (!pickRows.length) return
  pickIndex = (pickIndex + delta + pickRows.length) % pickRows.length
  renderPickRows()
}

function pickerKey(e: KeyboardEvent): boolean {
  if (e.key === 'Escape') {
    e.preventDefault()
    if (state === 'triage-file') {
      state = 'triage'
      renderTriage()
    } else {
      state = 'saved'
      renderSavedPanel()
    }
  } else if (e.key === 'Enter') {
    e.preventDefault()
    void commitPicker()
  } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault()
    movePick(e.key === 'ArrowDown' ? 1 : -1)
  }
  return true
}

async function commitPicker(): Promise<void> {
  const row = pickRows[pickIndex]
  if (!kit || !row) return
  if (state === 'save-move' && savedMatch) {
    try {
      const parentId = await resolvePickerParent(row)
      const resp = await kit.send({ type: 'bookmark-move', id: savedMatch.id, parentId })
      if (!resp || resp.error) throw new Error(String(resp?.error))
      kit.toast(`Moved to ${pickedLabel(row)}`)
    } catch {
      kit.toast('Couldn’t move bookmark')
    }
    closePanel()
    return
  }
  if (state === 'triage-file') {
    const item = queue[queueIndex]
    if (item) {
      try {
        const parentId = await resolvePickerParent(row)
        await kit.send({ type: 'bookmark-move', id: item.id, parentId })
      } catch {
        // Item vanished mid-triage — tolerated, just move on.
      }
    }
    state = 'triage'
    advance()
  }
}

/* ---------- Inbox triage ---------- */

async function startTriage(): Promise<void> {
  if (!kit) return
  // Re-read the Inbox at start; other surfaces may have touched it.
  const info = await kit.send({ type: 'inbox-info' })
  const folderId = (info?.folderId as string | null | undefined) ?? null
  if (!folderId) {
    kit.toast('No Inbox folder yet')
    return
  }
  const resp = await kit.send({ type: 'library-list', folderId })
  if (!kit.list()) return
  const items = ((resp?.items as LibraryChild[] | undefined) ?? []).filter(
    (i): i is LibraryChild & { url: string } => !!i.url,
  )
  queue = triageQueue(items).map((i) => ({
    id: i.id,
    title: i.title,
    url: i.url,
    dateAdded: i.dateAdded,
  }))
  queueIndex = 0
  kit.hideInputRow(true)
  if (!queue.length) {
    state = 'zero'
    renderZero()
    return
  }
  state = 'triage'
  renderTriage()
}

function renderTriage(): void {
  const list = kit?.list()
  const item = queue[queueIndex]
  if (!list || !item) return
  list.textContent = ''
  const card = document.createElement('div')
  card.className = 'lib-triage'
  card.append(
    textEl('lib-triage-count', `${queueIndex + 1} of ${queue.length}`),
    textEl('lib-triage-title', item.title || item.url),
    textEl('lib-triage-url', item.url),
    textEl('lib-triage-age', item.dateAdded ? `Added ${ago(item.dateAdded)}` : ''),
  )
  const keys = document.createElement('div')
  keys.className = 'lib-triage-keys'
  const hints: Array<[string, string]> = [
    ['F', 'File'],
    ['D', 'Delete'],
    ['Space', 'Skip'],
    ['↵', 'Open'],
    ['esc', 'Exit'],
  ]
  for (const [key, label] of hints) {
    const hint = document.createElement('span')
    hint.append(kit!.kbd(key), document.createTextNode(label))
    keys.appendChild(hint)
  }
  card.appendChild(keys)
  list.appendChild(card)
}

function triageKey(e: KeyboardEvent): boolean {
  if (e.key === 'Escape') {
    e.preventDefault()
    endTriage()
    return true
  }
  const item = queue[queueIndex]
  if (!item || e.metaKey || e.ctrlKey || e.altKey) return true
  const key = e.key.toLowerCase()
  if (key === 'f') {
    e.preventDefault()
    void openTriageFile()
  } else if (key === 'd' || e.key === 'Backspace') {
    e.preventDefault()
    // Errors (item already gone) are tolerated — advance either way.
    void kit!.send({ type: 'bookmark-delete', id: item.id })
    advance()
  } else if (e.key === ' ') {
    e.preventDefault()
    advance()
  } else if (e.key === 'Enter') {
    e.preventDefault()
    void kit!.send({ type: 'open-url-background', url: item.url })
  }
  return true
}

async function openTriageFile(): Promise<void> {
  if (!kit) return
  const resp = await kit.send({ type: 'folders' })
  if (state !== 'triage') return
  folderOptions = (resp?.folders as FolderOption[] | undefined) ?? []
  state = 'triage-file'
  pickerPreselectInbox = false
  const item = queue[queueIndex]
  renderPickerPanel(`File "${item.title || item.url}" to…`)
}

function advance(): void {
  queueIndex++
  if (queueIndex >= queue.length) {
    state = 'zero'
    renderZero()
    return
  }
  renderTriage()
}

function renderZero(): void {
  const list = kit?.list()
  if (!list) return
  list.textContent = ''
  const zero = textEl('lib-zero', 'Inbox zero')
  const small = document.createElement('small')
  small.textContent = 'All processed — back to Bookmarks'
  zero.appendChild(small)
  list.appendChild(zero)
  clearTimeout(zeroTimer)
  zeroTimer = setTimeout(() => {
    if (state === 'zero') endTriage()
  }, 1500)
}

function endTriage(): void {
  clearTimeout(zeroTimer)
  state = 'browse'
  queue = []
  queueIndex = 0
  kit?.hideInputRow(false)
  kit?.input()?.focus()
  kit?.refresh()
}
