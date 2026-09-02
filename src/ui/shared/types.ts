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
  downloadId?: number
  group?: string
  positions?: number[]
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
}
