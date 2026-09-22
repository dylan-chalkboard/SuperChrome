import { createCanvasBackdrop } from '../backdrop-core'
import type { CanvasScene, Frame } from '../backdrop-core'
import { ink } from './palette'

interface P {
  x: number
  y: number
  speed: number
}

const DENSITY = 1 / 11000 // particles per px²
const MAX = 340

/** Angle of the flow field at (x, y) — a slowly-rotating sine landscape. */
function fieldAngle(nx: number, ny: number, t: number): number {
  return (
    Math.sin(nx * 3 + t * 0.12) * 1.4 +
    Math.cos(ny * 3 - t * 0.1) * 1.4 +
    Math.sin((nx + ny) * 2 + t * 0.08) * Math.PI
  )
}

/** Fine motes drifting along an invisible, slowly-evolving flow field. */
function setup(): CanvasScene {
  let ps: P[] = []
  let w = 0
  let h = 0

  const seed = (vw: number, vh: number): void => {
    w = vw
    h = vh
    const count = Math.min(MAX, Math.max(40, Math.round(vw * vh * DENSITY)))
    ps = Array.from({ length: count }, () => ({
      x: Math.random() * vw,
      y: Math.random() * vh,
      speed: 0.35 + Math.random() * 0.55,
    }))
  }

  const draw = ({ ctx, t, vw, vh, variant, speed }: Frame): void => {
    if (!ps.length) seed(vw, vh)
    ctx.fillStyle = ink(variant, variant === 'light' ? 0.5 : 0.62)
    ctx.shadowColor = ink(variant, 0.5)
    ctx.shadowBlur = variant === 'light' ? 0 : 6
    for (const p of ps) {
      const a = fieldAngle(p.x / w, p.y / h, t)
      p.x += Math.cos(a) * p.speed * speed
      p.y += Math.sin(a) * p.speed * speed
      if (p.x < -4) p.x = vw + 4
      else if (p.x > vw + 4) p.x = -4
      if (p.y < -4) p.y = vh + 4
      else if (p.y > vh + 4) p.y = -4
      ctx.beginPath()
      ctx.arc(p.x, p.y, 1.1, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.shadowBlur = 0
  }

  return { draw, onResize: seed }
}

export const mountParticles = createCanvasBackdrop(setup)
