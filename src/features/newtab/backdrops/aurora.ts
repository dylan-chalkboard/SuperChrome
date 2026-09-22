import { createCanvasBackdrop } from '../backdrop-core'
import type { CanvasScene, Frame } from '../backdrop-core'
import { accents, hsla } from './palette'

interface Path {
  i: number
  /** Lissajous drift params — each blob loops on its own slow orbit. */
  ax: number
  ay: number
  px: number
  py: number
  sx: number
  sy: number
}

const PATHS: Path[] = [
  { i: 0, ax: 0.26, ay: 0.2, px: 0.0, py: 1.1, sx: 0.06, sy: 0.08 },
  { i: 1, ax: 0.22, ay: 0.24, px: 2.1, py: 0.3, sx: 0.08, sy: 0.05 },
  { i: 2, ax: 0.28, ay: 0.18, px: 4.0, py: 2.4, sx: 0.045, sy: 0.09 },
  { i: 3, ax: 0.2, ay: 0.22, px: 1.2, py: 3.3, sx: 0.07, sy: 0.06 },
]

/** Soft, blurred ribbons of color drifting and blending — calm northern lights. */
function setup(): CanvasScene {
  const draw = ({ ctx, t, vw, vh, variant }: Frame): void => {
    const cols = accents(variant)
    const light = variant === 'light'
    // Screen-blend the blobs so overlaps brighten smoothly instead of muddying;
    // a heavy blur melts the gradients into one another for that creamy mesh.
    ctx.globalCompositeOperation = light ? 'multiply' : 'screen'
    ctx.filter = `blur(${Math.round(Math.min(vw, vh) * 0.06)}px)`
    const radius = Math.hypot(vw, vh) * 0.42
    const peak = light ? 0.42 : 0.5
    const s = t * 0.4 // slow everything down
    for (const p of PATHS) {
      const cx = vw * (0.5 + p.ax * Math.sin(s * p.sx + p.px))
      const cy = vh * (0.5 + p.ay * Math.cos(s * p.sy + p.py))
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius)
      g.addColorStop(0, hsla(cols[p.i], peak))
      g.addColorStop(1, hsla(cols[p.i], 0))
      ctx.fillStyle = g
      ctx.fillRect(-radius, -radius, vw + radius * 2, vh + radius * 2)
    }
    ctx.filter = 'none'
    ctx.globalCompositeOperation = 'source-over'
  }

  return { draw }
}

export const mountAurora = createCanvasBackdrop(setup)
