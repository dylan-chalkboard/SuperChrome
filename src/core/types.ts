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
  /** Selecting the row types this into the palette input instead of acting. */
  fillInput?: string
  /** Indices into the ranked text that matched the query, for highlighting. */
  positions?: number[]
}
