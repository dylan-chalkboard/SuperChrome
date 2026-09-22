import { createCanvasBackdrop } from '../backdrop-core'
import type { CanvasScene, Frame } from '../backdrop-core'
import { accents, hsla } from './palette'

const LAYERS = 4

/** Smooth, blurred ribbons rolling gently across the lower half — silky depth. */
function setup(): CanvasScene {
  const draw = ({ ctx, t, vw, vh, variant }: Frame): void => {
    const cols = accents(variant)
    const s = t * 0.35
    ctx.filter = `blur(${Math.round(Math.min(vw, vh) * 0.025)}px)`
    ctx.globalCompositeOperation = variant === 'light' ? 'multiply' : 'screen'
    for (let i = 0; i < LAYERS; i++) {
      const p = i / (LAYERS - 1)
      const baseY = vh * (0.42 + p * 0.5)
      const amp = vh * (0.04 + p * 0.05)
      const speed = 0.35 + p * 0.4
      const freq = 1.3 + p * 0.9
      ctx.beginPath()
      ctx.moveTo(0, vh)
      for (let x = 0; x <= vw; x += 14) {
        const nx = x / vw
        const y =
          baseY +
          Math.sin(nx * freq * Math.PI * 2 + s * speed) * amp +
          Math.sin(nx * freq * 0.5 * Math.PI * 2 - s * speed * 0.7) * amp * 0.5
        ctx.lineTo(x, y)
      }
      ctx.lineTo(vw, vh)
      ctx.closePath()
      const col = cols[i % cols.length]
      ctx.fillStyle = hsla(col, variant === 'light' ? 0.28 : 0.34)
      ctx.fill()
    }
    ctx.filter = 'none'
    ctx.globalCompositeOperation = 'source-over'
  }

  return { draw }
}

export const mountWaves = createCanvasBackdrop(setup)
