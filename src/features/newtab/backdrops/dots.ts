import { createCanvasBackdrop } from '../backdrop-core'
import type { Frame } from '../backdrop-core'
import { ink } from './palette'

const GAP = 26 // px between dots

/**
 * A calm halftone field. A slow, gentle swell moves brightness across an even
 * grid of small dots — refined and quiet rather than busy.
 */
function draw({ ctx, t, vw, vh, variant }: Frame): void {
  const s = t * 0.5 // unhurried
  for (let y = GAP / 2; y <= vh; y += GAP) {
    const ny = y / vh
    // Very light depth: the field settles slightly toward the bottom.
    const depth = 0.65 + 0.35 * ny
    for (let x = GAP / 2; x <= vw; x += GAP) {
      const nx = x / vw
      const wave =
        Math.sin(nx * 3 + s) + Math.sin(ny * 2.4 - s * 0.8) + Math.sin((nx + ny) * 2.6 + s * 0.5)
      const v = (wave + 3) / 6 // 0..1
      const r = (1.1 + 1.4 * v) * depth
      const alpha = (0.12 + 0.5 * v) * depth
      ctx.fillStyle = ink(variant, alpha)
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

export const mountDots = createCanvasBackdrop(() => ({ draw }))
