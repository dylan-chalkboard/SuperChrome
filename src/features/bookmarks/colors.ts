/**
 * Folder colors. Chrome's bookmark tree has no color field, so colors live in
 * extension storage keyed by folder id — cosmetic-only shadow state.
 */

/** Preset name → [back, front] fills for the two-tone folder glyph. */
export const FOLDER_COLORS: Record<string, [string, string]> = {
  blue: ['#3f97ee', '#7ab8f5'],
  grey: ['#6f7a86', '#9aa4b0'],
  red: ['#e05d5d', '#ef8f8f'],
  orange: ['#e8964a', '#f2b57e'],
  yellow: ['#e0b53c', '#efd27e'],
  green: ['#4caf7d', '#7ccfa4'],
  purple: ['#9a6ee8', '#bd9bf2'],
  pink: ['#e0619e', '#eb94bd'],
}

/** The macOS-style folder glyph in the given preset color (blue when unset). */
export function folderSvg(color?: string | null): string {
  const [back, front] = FOLDER_COLORS[color ?? 'blue'] ?? FOLDER_COLORS.blue
  return (
    '<svg width="17" height="17" viewBox="0 0 16 16" fill="none">' +
    `<path d="M1.5 4.2C1.5 3.26 2.26 2.5 3.2 2.5h2.9c.45 0 .88.18 1.2.5l.9.9h4.6c.94 0 1.7.76 1.7 1.7v6.2c0 .94-.76 1.7-1.7 1.7H3.2c-.94 0-1.7-.76-1.7-1.7V4.2z" fill="${back}"/>` +
    `<path d="M1.5 6.2c0-.94.76-1.7 1.7-1.7h9.6c.94 0 1.7.76 1.7 1.7v5.6c0 .94-.76 1.7-1.7 1.7H3.2c-.94 0-1.7-.76-1.7-1.7V6.2z" fill="${front}"/>` +
    '</svg>'
  )
}
