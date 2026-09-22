import type { BackdropVariant } from '../backdrop-core'

/** An accent hue in HSL, kept muted for a calm, Apple-like feel. */
export interface Accent {
  h: number
  s: number
  l: number
}

/**
 * A restrained, cohesive accent set — soft blue, indigo, teal, and rose. Lower
 * saturation than the old neon palette so blends stay creamy, not garish.
 */
export function accents(variant: BackdropVariant): Accent[] {
  return variant === 'light'
    ? [
        { h: 214, s: 78, l: 74 }, // sky blue
        { h: 258, s: 62, l: 78 }, // periwinkle
        { h: 186, s: 62, l: 76 }, // pale teal
        { h: 330, s: 64, l: 82 }, // rose
      ]
    : [
        { h: 218, s: 74, l: 60 }, // blue
        { h: 262, s: 60, l: 62 }, // indigo
        { h: 186, s: 66, l: 56 }, // teal
        { h: 326, s: 62, l: 62 }, // rose
      ]
}

export function hsla({ h, s, l }: Accent, alpha: number): string {
  return `hsla(${h}, ${s}%, ${l}%, ${alpha})`
}

/** Soft monochrome ink for dots/lines — cool white on dark, slate on light. */
export function ink(variant: BackdropVariant, a: number): string {
  return variant === 'light' ? `rgba(60, 68, 92, ${a})` : `rgba(226, 232, 246, ${a})`
}
