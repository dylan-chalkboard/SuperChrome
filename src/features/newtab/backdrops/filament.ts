import { createCanvasBackdrop } from '../backdrop-core'
import type { CanvasScene, Frame } from '../backdrop-core'

// Adapted from the classic hex-branching "growing lines" canvas effect, retuned
// for a calm, Apple-like look: a narrow hue drift through blue/indigo/teal
// rather than a full-spectrum rainbow, softer glow, and theme awareness.
const CFG = {
  count: 55,
  baseTime: 10,
  addedTime: 10,
  dieChance: 0.05,
  spawnChance: 1,
  sparkChance: 0.08,
  sparkDist: 8,
  sparkSize: 1.4,
  fade: 0.055, // per-frame trail decay
  glow: 5,
}

const BASE_RAD = (Math.PI * 2) / 6

/** Slowly branching filaments of light that grow from the centre and fade. */
function setup(): CanvasScene {
  let lines: Line[] = []
  let tick = 0
  let cx = 0
  let cy = 0
  let len = 20
  let dieX = 0
  let dieY = 0
  let light = false
  let spd = 1
  // The live frame's context — refreshed each draw so Line.step can paint.
  let g: CanvasRenderingContext2D | null = null

  /** A muted, drifting accent that stays within a cool blue→teal band. */
  const strokeColor = (lum: number): string => {
    const hue = 205 + 48 * Math.sin(tick * 0.0016)
    return light ? `hsla(${hue}, 46%, 40%, 0.5)` : `hsl(${hue}, 66%, ${lum}%)`
  }

  class Line {
    x = 0
    y = 0
    addedX = 0
    addedY = 0
    rad = 0
    time = 0
    targetTime = 0
    cumulative = 0
    lightMul = 0.01 + 0.02 * Math.random()

    constructor() {
      this.beginPhase()
    }

    reset(): void {
      this.x = this.y = this.addedX = this.addedY = this.rad = 0
      this.cumulative = 0
      this.beginPhase()
    }

    beginPhase(): void {
      this.x += this.addedX
      this.y += this.addedY
      this.time = 0
      this.targetTime = (CFG.baseTime + CFG.addedTime * Math.random()) | 0
      this.rad += BASE_RAD * (Math.random() < 0.5 ? 1 : -1)
      this.addedX = Math.cos(this.rad)
      this.addedY = Math.sin(this.rad)
      if (
        Math.random() < CFG.dieChance ||
        this.x > dieX ||
        this.x < -dieX ||
        this.y > dieY ||
        this.y < -dieY
      ) {
        this.reset()
      }
    }

    step(): void {
      if (!g) return
      this.time += spd
      this.cumulative += spd
      if (this.time >= this.targetTime) this.beginPhase()

      const prop = this.time / this.targetTime
      const wave = Math.sin((prop * Math.PI) / 2)
      const px = cx + (this.x + this.addedX * wave) * len
      const py = cy + (this.y + this.addedY * wave) * len

      const lum = 56 + 10 * Math.sin(this.cumulative * this.lightMul)
      g.shadowBlur = prop * CFG.glow
      g.fillStyle = g.shadowColor = strokeColor(lum)
      g.fillRect(px, py, 2, 2)

      if (Math.random() < CFG.sparkChance) {
        const dx = Math.random() * CFG.sparkDist * (Math.random() < 0.5 ? 1 : -1)
        const dy = Math.random() * CFG.sparkDist * (Math.random() < 0.5 ? 1 : -1)
        g.fillRect(px + dx - CFG.sparkSize / 2, py + dy - CFG.sparkSize / 2, CFG.sparkSize, CFG.sparkSize)
      }
    }
  }

  const configure = (vw: number, vh: number): void => {
    cx = vw / 2
    cy = vh / 2
    len = Math.max(13, Math.min(vw, vh) / 24)
    dieX = vw / 2 / len
    dieY = vh / 2 / len
  }

  const clear = ({ ctx, vw, vh, variant }: Frame): void => {
    ctx.globalCompositeOperation = 'source-over'
    ctx.shadowBlur = 0
    ctx.fillStyle = variant === 'light' ? '#eef1fb' : '#05070f'
    ctx.fillRect(0, 0, vw, vh)
    lines = []
    tick = 0
  }

  const draw = ({ ctx, vw, vh, variant, speed }: Frame): void => {
    g = ctx
    light = variant === 'light'
    spd = speed
    tick++

    // Fade the previous frame toward the base colour, then add new light.
    ctx.globalCompositeOperation = 'source-over'
    ctx.shadowBlur = 0
    ctx.fillStyle = light ? `rgba(238,241,251,${CFG.fade})` : `rgba(5,7,15,${CFG.fade})`
    ctx.fillRect(0, 0, vw, vh)
    ctx.globalCompositeOperation = light ? 'source-over' : 'lighter'

    if (lines.length < CFG.count && Math.random() < CFG.spawnChance) lines.push(new Line())
    for (const line of lines) line.step()

    ctx.shadowBlur = 0
    ctx.globalCompositeOperation = 'source-over'
  }

  return { draw, clear, onResize: configure, persist: true, warmup: 260 }
}

export const mountFilament = createCanvasBackdrop(setup)
