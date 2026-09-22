import { createCanvasBackdrop } from '../backdrop-core'
import type { CanvasScene, Frame } from '../backdrop-core'
import { accents, hsla } from './palette'

interface Orb {
  x: number
  y: number
  r: number
  speed: number
  sway: number
  phase: number
  alpha: number
  hue: number
}

const DENSITY = 1 / 26000
const MAX = 80

/** Soft tinted circles drifting slowly upward — dreamy, out-of-focus lights. */
function setup(): CanvasScene {
  let orbs: Orb[] = []

  const seed = (vw: number, vh: number): void => {
    const count = Math.min(MAX, Math.max(14, Math.round(vw * vh * DENSITY)))
    orbs = Array.from({ length: count }, () => ({
      x: Math.random() * vw,
      y: Math.random(),
      r: 8 + Math.random() * 50,
      speed: 0.0004 + Math.random() * 0.0016,
      sway: 8 + Math.random() * 26,
      phase: Math.random() * Math.PI * 2,
      alpha: 0.05 + Math.random() * 0.12,
      hue: Math.floor(Math.random() * 4),
    }))
  }

  const draw = ({ ctx, t, vw, vh, variant }: Frame): void => {
    if (!orbs.length) seed(vw, vh)
    const cols = accents(variant)
    ctx.globalCompositeOperation = variant === 'light' ? 'multiply' : 'screen'
    for (const o of orbs) {
      o.y -= o.speed
      if (o.y < -0.1) o.y = 1.1
      const cy = o.y * vh
      const cx = o.x + Math.sin(t * 0.4 + o.phase) * o.sway
      const col = cols[o.hue]
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, o.r)
      g.addColorStop(0, hsla(col, o.alpha))
      g.addColorStop(1, hsla(col, 0))
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(cx, cy, o.r, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalCompositeOperation = 'source-over'
  }

  return { draw, onResize: seed }
}

export const mountBokeh = createCanvasBackdrop(setup)
