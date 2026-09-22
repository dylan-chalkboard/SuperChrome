import { createCanvasBackdrop } from '../backdrop-core'
import type { CanvasScene, Frame } from '../backdrop-core'
import { ink } from './palette'

interface Drop {
  x: number
  y: number
  len: number
  speed: number
  alpha: number
}

const DENSITY = 1 / 9000
const MAX = 200

/** Thin streaks falling with a slight slant — quiet digital rain. */
function setup(): CanvasScene {
  let drops: Drop[] = []

  const seed = (vw: number, vh: number): void => {
    const count = Math.min(MAX, Math.max(30, Math.round(vw * vh * DENSITY)))
    drops = Array.from({ length: count }, () => ({
      x: Math.random() * vw,
      y: Math.random() * vh,
      len: 12 + Math.random() * 26,
      speed: 2 + Math.random() * 3.5,
      alpha: 0.06 + Math.random() * 0.2,
    }))
  }

  const draw = ({ ctx, vw, vh, variant, speed }: Frame): void => {
    if (!drops.length) seed(vw, vh)
    ctx.lineWidth = 1
    const slant = 0.18
    for (const d of drops) {
      d.y += d.speed * speed
      d.x += d.speed * slant * speed
      if (d.y - d.len > vh || d.x > vw + 4) {
        d.y = -d.len
        d.x = Math.random() * vw
      }
      ctx.strokeStyle = ink(variant, d.alpha)
      ctx.beginPath()
      ctx.moveTo(d.x, d.y)
      ctx.lineTo(d.x - d.len * slant, d.y - d.len)
      ctx.stroke()
    }
  }

  return { draw, onResize: seed }
}

export const mountRain = createCanvasBackdrop(setup)
