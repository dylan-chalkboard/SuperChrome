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

/* ---------- Favorite-tile palettes (superset of the folder presets) ---------- */

export const TILE_COLORS: Record<string, [string, string]> = {
  ...FOLDER_COLORS,
  teal: ['#3aa99f', '#6cc4bc'],
  cyan: ['#3ab5c6', '#72cdd9'],
  indigo: ['#5a67e8', '#8d96f0'],
  rose: ['#e0619e', '#eb94bd'],
  gold: ['#bf9a15', '#d9bb50'],
  slate: ['#64748b', '#93a0b3'],
  lime: ['#8fbc3a', '#b3d474'],
  navy: ['#2f5ecc', '#6b8bdd'],
  brown: ['#a07850', '#bd9d7e'],
  black: ['#2c2c30', '#55555c'],
}

/** Hand-picked multi-hue gradients, beyond the hue-shift ones. */
export const TILE_GRADIENTS: Record<string, string> = {
  sunset: 'linear-gradient(135deg, #f04438, #e8c341)',
  ocean: 'linear-gradient(135deg, #4c9df3, #3aa99f)',
  candy: 'linear-gradient(135deg, #e0619e, #9a6ee8)',
  forest: 'linear-gradient(135deg, #4caf7d, #2f6f4f)',
  fire: 'linear-gradient(135deg, #e8964a, #e05d5d)',
  night: 'linear-gradient(135deg, #5a67e8, #1e1e3c)',
  dawn: 'linear-gradient(135deg, #e8c341, #e0619e)',
  steel: 'linear-gradient(135deg, #93a0b3, #3c4453)',
}
