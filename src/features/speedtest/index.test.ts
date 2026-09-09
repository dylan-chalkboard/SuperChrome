import { describe, expect, it } from 'vitest'
import { jitter, mbps, median, runSpeedTest, type SpeedPhase } from './index'

describe('mbps', () => {
  it('converts bytes over milliseconds to megabits per second', () => {
    // 12.5 MB in 1s = 100 Mbps.
    expect(mbps(12_500_000, 1000)).toBeCloseTo(100, 5)
  })
  it('is zero for non-positive time', () => {
    expect(mbps(1000, 0)).toBe(0)
  })
})

describe('median', () => {
  it('returns the middle of an odd list', () => {
    expect(median([30, 10, 20])).toBe(20)
  })
  it('averages the two middles of an even list', () => {
    expect(median([10, 20, 30, 40])).toBe(25)
  })
  it('is zero for an empty list', () => {
    expect(median([])).toBe(0)
  })
})

describe('jitter', () => {
  it('is the mean absolute gap between consecutive samples', () => {
    expect(jitter([10, 14, 12])).toBe(3) // |14-10|=4, |12-14|=2 -> 3
  })
  it('is zero with fewer than two samples', () => {
    expect(jitter([10])).toBe(0)
  })
})

/**
 * Fake network at a constant bandwidth: the clock advances by exactly the time
 * a real link at `downRate`/`upRate` Mbps would take, so throughput math should
 * recover the target rate exactly.
 */
function fakeEnv(downRate: number, upRate: number, pingMs: number) {
  let t = 0
  const now = (): number => t
  const fetchImpl = (async (url: string | URL, init?: RequestInit) => {
    const u = String(url)
    if (u.includes('/__down')) {
      const bytes = Number(new URL(u).searchParams.get('bytes'))
      if (bytes === 0) {
        t += pingMs
        return { arrayBuffer: async () => new ArrayBuffer(0) }
      }
      t += (bytes * 8) / (downRate * 1e6) * 1000
      return { arrayBuffer: async () => new ArrayBuffer(bytes) }
    }
    const bytes = (init!.body as Blob).size
    t += (bytes * 8) / (upRate * 1e6) * 1000
    return { arrayBuffer: async () => new ArrayBuffer(0) }
  }) as unknown as typeof fetch
  return { now, fetchImpl }
}

describe('runSpeedTest', () => {
  it('recovers the simulated download/upload rates and ping', async () => {
    const { now, fetchImpl } = fakeEnv(200, 50, 12)
    const result = await runSpeedTest({
      fetchImpl,
      now,
      pingSamples: 4,
      downloadBytes: [1e6, 5e6],
      uploadBytes: [1e6, 2e6],
      budgetMs: 60_000,
    })
    expect(result.downMbps).toBeCloseTo(200, 3)
    expect(result.upMbps).toBeCloseTo(50, 3)
    expect(result.pingMs).toBe(12)
    expect(result.jitterMs).toBe(0)
  })

  it('emits progress phases in order, ending with done', async () => {
    const { now, fetchImpl } = fakeEnv(100, 100, 10)
    const phases: SpeedPhase[] = []
    await runSpeedTest({
      fetchImpl,
      now,
      pingSamples: 2,
      downloadBytes: [1e6],
      uploadBytes: [1e6],
      onProgress: (p) => phases.push(p.phase),
    })
    expect(phases[0]).toBe('ping')
    expect(phases).toContain('download')
    expect(phases).toContain('upload')
    expect(phases[phases.length - 1]).toBe('done')
  })

  it('stops issuing requests once the time budget is spent', async () => {
    const { now, fetchImpl } = fakeEnv(1, 1, 5) // 1 Mbps -> slow, budget trips fast
    let downCalls = 0
    const counting = (async (url: string | URL, init?: RequestInit) => {
      if (String(url).includes('/__down') && !String(url).endsWith('bytes=0')) downCalls++
      return fetchImpl(url, init)
    }) as unknown as typeof fetch
    await runSpeedTest({
      fetchImpl: counting,
      now,
      pingSamples: 1,
      downloadBytes: [1e6, 1e6, 1e6, 1e6],
      uploadBytes: [1e6],
      budgetMs: 1, // first request already exceeds it
    })
    expect(downCalls).toBe(1)
  })
})
