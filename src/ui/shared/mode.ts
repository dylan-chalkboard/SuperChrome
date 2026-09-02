export const PREFIX_CHARS = '>@#:~%!'

/** The palette mode selected by a typed prefix character. */
export function mode(prefix: string): string {
  if (prefix === '>') return 'commands'
  if (prefix === '@') return 'tabs'
  if (prefix === '#') return 'history'
  if (prefix === ':') return 'emoji'
  if (prefix === '~') return 'downloads'
  if (prefix === '%') return 'snippets'
  if (prefix === '!') return 'library'
  return 'bookmarks'
}

export const MODE_PLACEHOLDERS: Record<string, string> = {
  bookmarks: 'Search bookmarks and commands…',
  commands: 'Search commands…',
  tabs: 'Search open tabs…',
  history: 'Search history…',
  emoji: 'Search emoji…',
  downloads: 'Search downloads…',
  snippets: 'Search snippets…',
  library: 'Search bookmarks…',
}

export const MODE_PREFIX: Record<string, string> = {
  bookmarks: '',
  commands: '>',
  tabs: '@',
  history: '#',
  snippets: '%',
  library: '!',
}
