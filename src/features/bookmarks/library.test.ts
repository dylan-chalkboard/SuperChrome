import { describe, expect, it } from 'vitest'
import {
  breadcrumbSegments,
  countLabel,
  decideSaveState,
  defaultPickerIndex,
  folderPickerRows,
  foldersFirst,
  fuzzyScore,
  resolveInbox,
  triageQueue,
} from './library'
import type { FolderOption, LibraryNodeLike } from './library'

describe('breadcrumbSegments', () => {
  it('is just the root when the stack is empty', () => {
    expect(breadcrumbSegments([])).toEqual([{ id: null, label: 'Bookmarks' }])
  })

  it('prepends the root to every stack level in order', () => {
    const stack = [
      { id: '10', label: 'Projects' },
      { id: '20', label: 'Active' },
    ]
    expect(breadcrumbSegments(stack)).toEqual([
      { id: null, label: 'Bookmarks' },
      { id: '10', label: 'Projects' },
      { id: '20', label: 'Active' },
    ])
  })
})

describe('foldersFirst', () => {
  it('moves folders ahead of bookmarks, preserving relative order', () => {
    const items = [
      { id: 'b1', url: 'https://a.com' },
      { id: 'f1' },
      { id: 'b2', url: 'https://b.com' },
      { id: 'f2' },
    ]
    expect(foldersFirst(items).map((i) => i.id)).toEqual(['f1', 'f2', 'b1', 'b2'])
  })

  it('handles all-folder and all-bookmark lists', () => {
    const folders: Array<{ id: string; url?: string }> = [{ id: 'f' }]
    const bookmarks: Array<{ id: string; url?: string }> = [{ id: 'b', url: 'x' }]
    expect(foldersFirst(folders).map((i) => i.id)).toEqual(['f'])
    expect(foldersFirst(bookmarks).map((i) => i.id)).toEqual(['b'])
  })
})

describe('countLabel', () => {
  it('pluralizes item counts', () => {
    expect(countLabel(0)).toBe('0 items')
    expect(countLabel(1)).toBe('1 item')
    expect(countLabel(12)).toBe('12 items')
  })
})

describe('folderPickerRows', () => {
  const folders: FolderOption[] = [
    { id: '1', path: 'Bookmarks Bar' },
    { id: '2', path: 'Other Bookmarks' },
    { id: '3', path: 'Other Bookmarks / Inbox' },
    { id: '4', path: 'Bookmarks Bar / Recipes' },
  ]

  it('returns all folders in order for an empty query', () => {
    const rows = folderPickerRows(folders, '', true)
    expect(rows.map((r) => r.id)).toEqual(['1', '2', '3', '4'])
  })

  it('fuzzy-filters by path', () => {
    const rows = folderPickerRows(folders, 'recip', true)
    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe('4')
  })

  it('offers a virtual Inbox row first when no Inbox exists', () => {
    const rows = folderPickerRows(folders.slice(0, 2), '', false)
    expect(rows[0]).toMatchObject({ label: 'Inbox', virtualInbox: true, id: null })
    expect(rows).toHaveLength(3)
  })

  it('offers Create folder "<query>" when nothing matches', () => {
    const rows = folderPickerRows(folders, 'zzz new folder', true)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ create: true, label: 'Create folder "zzz new folder"' })
  })

  it('does not offer a create row for an empty query', () => {
    expect(folderPickerRows([], '', true)).toEqual([])
  })
})

describe('defaultPickerIndex', () => {
  it('preselects the real Inbox by id', () => {
    const rows = folderPickerRows(
      [
        { id: '1', path: 'Bookmarks Bar' },
        { id: '3', path: 'Other Bookmarks / Inbox' },
      ],
      '',
      true,
    )
    expect(defaultPickerIndex(rows, '3')).toBe(1)
  })

  it('preselects the virtual Inbox when none exists', () => {
    const rows = folderPickerRows([{ id: '1', path: 'Bookmarks Bar' }], '', false)
    expect(defaultPickerIndex(rows, null)).toBe(0)
    expect(rows[0].virtualInbox).toBe(true)
  })

  it('falls back to the first row', () => {
    const rows = folderPickerRows([{ id: '1', path: 'Bookmarks Bar' }], '', true)
    expect(defaultPickerIndex(rows, '999')).toBe(0)
  })
})

describe('fuzzyScore', () => {
  it('scores empty queries zero and misses null', () => {
    expect(fuzzyScore('', 'anything')).toBe(0)
    expect(fuzzyScore('xyz', 'inbox')).toBeNull()
  })

  it('rewards consecutive matches', () => {
    expect(fuzzyScore('inb', 'inbox')!).toBeGreaterThan(fuzzyScore('ibx', 'inbox')!)
  })
})

describe('resolveInbox', () => {
  const folder = (id: string, title: string): LibraryNodeLike => ({ id, title })

  it('finds a top-level folder named Inbox, case-insensitively', () => {
    expect(resolveInbox([folder('7', 'Stuff'), folder('9', 'inbox')])?.id).toBe('9')
    expect(resolveInbox([folder('9', ' Inbox ')])?.id).toBe('9')
  })

  it('ignores bookmarks named Inbox', () => {
    expect(resolveInbox([{ id: '5', title: 'Inbox', url: 'https://mail.example' }])).toBeNull()
  })

  it('is null when absent', () => {
    expect(resolveInbox([])).toBeNull()
    expect(resolveInbox([folder('7', 'Inbox2')])).toBeNull()
  })
})

describe('decideSaveState', () => {
  const results: LibraryNodeLike[] = [
    { id: '1', title: 'Docs', url: 'https://example.com/docs' },
    { id: '2', title: 'Home', url: 'https://example.com/' },
  ]

  it('is new when no result matches the exact URL', () => {
    expect(decideSaveState('https://example.com/other', results)).toEqual({ state: 'new' })
    expect(decideSaveState('https://example.com', results)).toEqual({ state: 'new' })
  })

  it('is saved with the exact-URL match', () => {
    const decision = decideSaveState('https://example.com/', results)
    expect(decision.state).toBe('saved')
    if (decision.state === 'saved') expect(decision.match.id).toBe('2')
  })
})

describe('triageQueue', () => {
  it('orders bookmarks oldest-first by dateAdded and skips folders', () => {
    const queue = triageQueue([
      { id: 'newer', url: 'https://a', dateAdded: 300 },
      { id: 'folder' },
      { id: 'oldest', url: 'https://b', dateAdded: 100 },
      { id: 'middle', url: 'https://c', dateAdded: 200 },
    ] as Array<LibraryNodeLike>)
    expect(queue.map((i) => i.id)).toEqual(['oldest', 'middle', 'newer'])
  })

  it('treats missing dateAdded as oldest', () => {
    const queue = triageQueue([
      { id: 'dated', url: 'https://a', dateAdded: 50 },
      { id: 'undated', url: 'https://b' },
    ] as Array<LibraryNodeLike>)
    expect(queue.map((i) => i.id)).toEqual(['undated', 'dated'])
  })
})
