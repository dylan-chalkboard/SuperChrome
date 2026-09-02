/* ---------- Hue-shift tile gradients ---------- */

function hslToHex(h: number, s: number, l: number): string {
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const c = l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(c * 255)
      .toString(16)
      .padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

/**
 * Turn a flat tile color into a hue-shifted diagonal gradient (Raycast-style).
 * Grays and unparseable values pass through unchanged, so this is safe to
 * apply to any user-configured color.
 */
export function tileGradient(color: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(color.trim())
  if (!m) return color
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  if (d === 0) return color
  const l = (max + min) / 2
  const s = d / (1 - Math.abs(2 * l - 1))
  let h = 0
  if (max === r) h = ((g - b) / d + 6) % 6
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  h *= 60
  const stop = (dh: number) => hslToHex((h + dh + 360) % 360, s, l)
  return `linear-gradient(135deg, ${stop(-20)}, ${stop(20)})`
}

