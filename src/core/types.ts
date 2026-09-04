export type PaletteMode = 'bookmarks' | 'commands' | 'tabs' | 'history'

export interface PaletteItem {
  kind: 'bookmark' | 'tab' | 'history' | 'command' | 'closed' | 'folder' | 'calc' | 'emoji' | 'download' | 'search' | 'snippet'
  label: string
  detail: string
  url?: string
  id?: string
  tabId?: number
  commandId?: string
  sessionId?: string
  emoji?: string
  text?: string
  icon?: string
  /** Direct image URL for the row icon (page thumbnails). */
  iconUrl?: string
  color?: string
  groupColor?: string
  grouped?: boolean
  /** Chrome tab-group id + title, present on grouped tab rows. */
  groupId?: number
  groupTitle?: string
  /** Right-column override ("Active", "3 items", "2d ago"); kind label otherwise. */
  typeText?: string
  /** URL is already open in a tab: row shows "Open Tab" + arrow and switches. */
  openTab?: boolean
  downloadId?: number
  /** Overrides the mode's default group header in the results list. */
  group?: string
  /** Quicklink rows: URL template rendered at open time (arguments, clipboard, dates…). */
  template?: string
  /** Text typed after the quicklink keyword — prefills the first argument. */
  qlRest?: string
  qlKeyword?: string
  qlName?: string
  /** Indices into the ranked text that matched the query, for highlighting. */
  positions?: number[]
}
