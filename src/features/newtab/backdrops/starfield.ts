import { createCanvasBackdrop } from '../backdrop-core'
import type { CanvasScene, Frame } from '../backdrop-core'
import { ink } from './palette'

interface Star {
  x: number
  y: number
  vx: number
  vy: number
  r: number
}

const DENSITY = 1 / 18000 // stars per px²
const MAX = 130
const LINK = 120 // px — draw a line between stars closer than this
const LINK2 = LINK * LINK

/** Drifting points with faint threads between near neighbours — a quiet web. */
function setup(): CanvasScene {
  let stars: Star[] = []

  const seed = (vw: number, vh: number): void => {
    const count = Math.min(MAX, Math.max(20, Math.round(vw * vh * DENSITY)))
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * vw,
      y: Math.random() * vh,
      vx: (Math.random() - 0.5) * 0.12,
      vy: (Math.random() - 0.5) * 0.12,
      r: 0.7 + Math.random() * 1.1,
    }))
  }

  const draw = ({ ctx, vw, vh, variant, speed }: Frame): void => {
    if (!stars.length) seed(vw, vh)

    for (const s of stars) {
      s.x += s.vx * speed
      s.y += s.vy * speed
      if (s.x < 0) s.x += vw
      else if (s.x > vw) s.x -= vw
      if (s.y < 0) s.y += vh
      else if (s.y > vh) s.y -= vh
    }

    // Faint links first, so dots sit on top of the web.
    ctx.lineWidth = 1
    for (let i = 0; i < stars.length; i++) {
      for (let j = i + 1; j < stars.length; j++) {
        const dx = stars[i].x - stars[j].x
        const dy = stars[i].y - stars[j].y
        const d2 = dx * dx + dy * dy
        if (d2 > LINK2) continue
        const a = (1 - Math.sqrt(d2) / LINK) * 0.16
        ctx.strokeStyle = ink(variant, a)
        ctx.beginPath()
        ctx.moveTo(stars[i].x, stars[i].y)
        ctx.lineTo(stars[j].x, stars[j].y)
        ctx.stroke()
      }
    }

    ctx.fillStyle = ink(variant, 0.75)
    for (const s of stars) {
      ctx.beginPath()
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  return { draw, onResize: seed }
}

export const mountStarfield = createCanvasBackdrop(setup)
