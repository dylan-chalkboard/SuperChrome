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
  color?: string
  groupColor?: string
  grouped?: boolean
  /** Right-column override ("Active", "3 items", "2d ago"); kind label otherwise. */
  typeText?: string
  downloadId?: number
  /** Overrides the mode's default group header in the results list. */
  group?: string
  /** Indices into the ranked text that matched the query, for highlighting. */
  positions?: number[]
}
