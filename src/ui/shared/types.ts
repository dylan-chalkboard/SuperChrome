export interface RemoteItem {
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
  /** Chrome tab-group id + title, present on grouped tab rows. */
  groupId?: number
  groupTitle?: string
  downloadId?: number
  group?: string
  positions?: number[]
  /** Overrides the kind label in the row's right-hand column ("3 items", "2d ago"). */
  typeText?: string
}

export interface PaletteAction {
  id: string
  label: string
  danger?: boolean
}

export interface FavoriteEntry {
  kind: 'bookmark' | 'command' | 'folder'
  label: string
  url?: string
  commandId?: string
  id?: string
  icon?: string
  color?: string
  /** User customization: preset tile color name and/or an emoji glyph. */
  tileColor?: string
  emojiIcon?: string
}
