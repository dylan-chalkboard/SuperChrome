/**
 * Popup variant of the palette. Unlike the injected overlay, popups work on
 * every page — chrome:// settings, the Web Store, new tab — because they're
 * extension UI rather than content injected into the page.
 */

interface FlatBookmark {
  title: string
  url: string
  path: string
}
interface TabInfo {
  id?: number
  title: string
  url: string
}
interface CommandInfo {
  id: string
  label: string
}
interface PaletteData {
  bookmarks: FlatBookmark[]
  tabs: TabInfo[]
  commands: CommandInfo[]
}

type PaletteItem =
  | { kind: 'bookmark'; label: string; detail: string; url: string }
  | { kind: 'tab'; label: string; detail: string; tabId: number; url: string }
  | { kind: 'command'; label: string; detail: string; commandId: string }

const BOOKMARK_SVG =
  '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 2.5h8V14l-4-2.5L4 14V2.5z" stroke="currentColor" stroke-linejoin="round"/></svg>'
const COMMAND_SVG =
  '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M5 4l4 4-4 4" stroke="currentColor" stroke-linecap="round"/></svg>'

const TYPE_LABELS: Record<PaletteItem['kind'], string> = {
  bookmark: 'Bookmark',
  tab: 'Tab',
  command: 'Command',
}

// Page-local commands need the page's document; they can't run from a popup.
const PAGE_ONLY_COMMANDS = new Set(['print-page'])

const inputEl = document.getElementById('input') as HTMLInputElement
const listEl = document.getElementById('list')!

let data: PaletteData | null = null
let flatItems: PaletteItem[] = []
let selectedIndex = 0

async function boot(): Promise<void> {
  if (location.hash === '#commands') inputEl.value = '>'
  data = (await chrome.runtime.sendMessage({ type: 'palette-data' })) as PaletteData
  updateList()
}

inputEl.addEventListener('input', updateList)
inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    moveSelection(1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    moveSelection(-1)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const item = flatItems[selectedIndex]
    if (item) void executeItem(item, e.metaKey || e.ctrlKey)
  }
})

function moveSelection(delta: number): void {
  if (!flatItems.length) return
  selectedIndex = (selectedIndex + delta + flatItems.length) % flatItems.length
  highlightSelection()
}

function highlightSelection(): void {
  const rows = listEl.querySelectorAll<HTMLElement>('.item')
  rows.forEach((row, i) => row.classList.toggle('selected', i === selectedIndex))
  rows[selectedIndex]?.scrollIntoView({ block: 'nearest' })
}

async function executeItem(item: PaletteItem, altAction: boolean): Promise<void> {
  if (item.kind === 'bookmark') {
    await chrome.runtime.sendMessage({ type: 'open-url', url: item.url, newTab: altAction })
  } else if (item.kind === 'tab') {
    await chrome.runtime.sendMessage({ type: 'activate-tab', tabId: item.tabId })
  } else if (item.commandId === 'switch-to-tab') {
    inputEl.value = '@'
    inputEl.focus()
    updateList()
    return
  } else {
    await chrome.runtime.sendMessage({ type: 'run-command', id: item.commandId })
  }
  window.close()
}

function fuzzyScore(query: string, text: string): number | null {
  if (!query) return 0
  let qi = 0
  let score = 0
  let streak = 0
  for (let ti = 0; ti < text.length && qi < query.length; ti++) {
    if (text[ti] === query[qi]) {
      streak++
      const wordStart = ti === 0 || ' /-_.:'.includes(text[ti - 1])
      score += 1 + streak * 2 + (wordStart ? 6 : 0)
      qi++
    } else {
      streak = 0
    }
  }
  return qi === query.length ? score - text.length * 0.01 : null
}

function updateList(): void {
  if (!data) return
  const raw = inputEl.value
  const mode = raw.startsWith('>') ? 'commands' : raw.startsWith('@') ? 'tabs' : 'bookmarks'
  const query = raw.replace(/^[>@]/, '').trim().toLowerCase()

  listEl.textContent = ''
  flatItems = []
  selectedIndex = 0

  if (mode === 'commands') {
    const items = scoreAndSort(
      data.commands
        .filter((c) => !PAGE_ONLY_COMMANDS.has(c.id))
        .map((c) => ({
          item: { kind: 'command', label: c.label, detail: '', commandId: c.id } as PaletteItem,
          text: c.label.toLowerCase(),
        })),
      query,
    )
    appendGroup('Commands', items)
  } else if (mode === 'tabs') {
    const items = scoreAndSort(
      data.tabs
        .filter((t) => t.id !== undefined)
        .map((t) => ({
          item: {
            kind: 'tab',
            label: t.title || t.url,
            detail: shortUrl(t.url),
            tabId: t.id!,
            url: t.url,
          } as PaletteItem,
          text: `${t.title} ${t.url}`.toLowerCase(),
        })),
      query,
    )
    appendGroup('Open Tabs', items)
  } else {
    const items = scoreAndSort(
      data.bookmarks.map((b) => ({
        item: {
          kind: 'bookmark',
          label: b.title,
          detail: b.path || shortUrl(b.url),
          url: b.url,
        } as PaletteItem,
        text: `${b.title} ${b.url}`.toLowerCase(),
      })),
      query,
    ).slice(0, 50)
    appendGroup('Bookmarks', items)
  }

  if (!flatItems.length) {
    const empty = document.createElement('div')
    empty.className = 'empty'
    empty.textContent = 'No results'
    listEl.appendChild(empty)
  }
  highlightSelection()
}

function scoreAndSort(
  entries: Array<{ item: PaletteItem; text: string }>,
  query: string,
): PaletteItem[] {
  const scored: Array<{ item: PaletteItem; score: number }> = []
  for (const entry of entries) {
    const score = fuzzyScore(query, entry.text)
    if (score !== null) scored.push({ item: entry.item, score })
  }
  scored.sort((a, b) => b.score - a.score)
  return scored.map((s) => s.item)
}

function iconFor(item: PaletteItem): HTMLElement {
  const icon = document.createElement('span')
  icon.className = 'icon'
  if (item.kind === 'bookmark' || item.kind === 'tab') {
    const img = document.createElement('img')
    img.src =
      chrome.runtime.getURL('/_favicon/') + `?pageUrl=${encodeURIComponent(item.url)}&size=32`
    img.onerror = () => {
      icon.innerHTML = BOOKMARK_SVG
    }
    icon.appendChild(img)
  } else {
    icon.innerHTML = COMMAND_SVG
  }
  return icon
}

function appendGroup(label: string, items: PaletteItem[]): void {
  if (!items.length) return
  const groupLabel = document.createElement('div')
  groupLabel.className = 'group-label'
  groupLabel.textContent = label
  listEl.appendChild(groupLabel)
  for (const item of items) {
    const index = flatItems.length
    flatItems.push(item)
    const row = document.createElement('div')
    row.className = 'item'
    const title = document.createElement('span')
    title.className = 'title'
    title.textContent = item.label
    const detail = document.createElement('span')
    detail.className = 'detail'
    detail.textContent = item.detail
    const type = document.createElement('span')
    type.className = 'type'
    type.textContent = TYPE_LABELS[item.kind]
    row.append(iconFor(item), title, detail, type)
    row.addEventListener('click', (e) => void executeItem(item, e.metaKey || e.ctrlKey))
    row.addEventListener('mousemove', () => {
      if (selectedIndex !== index) {
        selectedIndex = index
        highlightSelection()
      }
    })
    listEl.appendChild(row)
  }
}

function shortUrl(url: string): string {
  try {
    const u = new URL(url)
    return u.host + (u.pathname === '/' ? '' : u.pathname)
  } catch {
    return url
  }
}

void boot()

// Popup pages load as ES modules, so module scope is fine here (unlike
// palette.ts) — and it keeps these type names out of the global scope.
export {}
