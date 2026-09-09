/**
 * Internet speed test against Cloudflare's public speed endpoints
 * (speed.cloudflare.com — permissive CORS, no key). Pure engine: `fetch` and
 * the clock are injected so the throughput math can be unit-tested on a fake
 * stream + fake clock. Runs in the background worker (content-script fetches
 * are subject to the host page's CSP), streaming progress to the overlay.
 */

const DOWN_URL = 'https://speed.cloudflare.com/__down'
const UP_URL = 'https://speed.cloudflare.com/__up'

export type SpeedPhase = 'ping' | 'download' | 'upload' | 'done' | 'error'

export interface SpeedProgress {
  phase: SpeedPhase
  /** Round-trip latency, median of the ping samples (ms). */
  pingMs?: number
  /** Latency variation between consecutive ping samples (ms). */
  jitterMs?: number
  /** Live download throughput measured so far (Mbps). */
  downMbps?: number
  /** Live upload throughput measured so far (Mbps). */
  upMbps?: number
  /** Present on the 'error' frame. */
  error?: string
}

export interface SpeedResult {
  pingMs: number
  jitterMs: number
  downMbps: number
  upMbps: number
}

export interface SpeedTestOptions {
  fetchImpl?: typeof fetch
  now?: () => number
  signal?: AbortSignal
  onProgress?: (p: SpeedProgress) => void
  /** Download request sizes, run in order until the time budget is spent. */
  downloadBytes?: number[]
  /** Upload request sizes, run in order until the time budget is spent. */
  uploadBytes?: number[]
  pingSamples?: number
  /** Per-direction wall-clock budget (ms). */
  budgetMs?: number
}

const DEFAULT_DOWNLOAD = [1e6, 5e6, 1e7, 2.5e7, 2.5e7]
const DEFAULT_UPLOAD = [5e5, 1e6, 5e6, 5e6]

/** Throughput in Mbps from a byte count and elapsed milliseconds. */
export function mbps(bytes: number, ms: number): number {
  if (ms <= 0) return 0
  return (bytes * 8) / (ms / 1000) / 1e6
}

/** Median of a numeric list (0 when empty). */
export function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/** Mean absolute gap between consecutive samples — a simple jitter measure. */
export function jitter(values: number[]): number {
  if (values.length < 2) return 0
  let sum = 0
  for (let i = 1; i < values.length; i++) sum += Math.abs(values[i] - values[i - 1])
  return sum / (values.length - 1)
}

async function measurePing(
  fetchImpl: typeof fetch,
  now: () => number,
  samples: number,
  signal: AbortSignal | undefined,
): Promise<number[]> {
  const times: number[] = []
  for (let i = 0; i < samples; i++) {
    const start = now()
    const res = await fetchImpl(`${DOWN_URL}?bytes=0`, { cache: 'no-store', signal })
    await res.arrayBuffer()
    times.push(now() - start)
  }
  return times
}

/**
 * Run request sizes in order until the budget is spent, accumulating bytes and
 * time. Throughput is bits-over-window (steady state), reported live after each
 * request via `emit`.
 */
async function measureThroughput(
  sizes: number[],
  budgetMs: number,
  now: () => number,
  request: (bytes: number) => Promise<number>,
  emit: (value: number) => void,
): Promise<number> {
  let bytes = 0
  let ms = 0
  for (const size of sizes) {
    const start = now()
    const transferred = await request(size)
    ms += now() - start
    bytes += transferred
    emit(mbps(bytes, ms))
    if (ms >= budgetMs) break
  }
  return mbps(bytes, ms)
}

/** Deterministic filler so the uploaded body has a real size without crypto. */
function fillerBody(bytes: number): Blob {
  return new Blob([new Uint8Array(bytes)])
}

export async function runSpeedTest(opts: SpeedTestOptions = {}): Promise<SpeedResult> {
  const fetchImpl = opts.fetchImpl ?? fetch
  const now = opts.now ?? (() => Date.now())
  const signal = opts.signal
  const emit = opts.onProgress ?? (() => {})
  const budgetMs = opts.budgetMs ?? 5000

  const pings = await measurePing(fetchImpl, now, opts.pingSamples ?? 6, signal)
  const pingMs = median(pings)
  const jitterMs = jitter(pings)
  emit({ phase: 'ping', pingMs, jitterMs })

  const downMbps = await measureThroughput(
    opts.downloadBytes ?? DEFAULT_DOWNLOAD,
    budgetMs,
    now,
    async (bytes) => {
      const res = await fetchImpl(`${DOWN_URL}?bytes=${bytes}`, { cache: 'no-store', signal })
      return (await res.arrayBuffer()).byteLength
    },
    (value) => emit({ phase: 'download', pingMs, jitterMs, downMbps: value }),
  )

  const upMbps = await measureThroughput(
    opts.uploadBytes ?? DEFAULT_UPLOAD,
    budgetMs,
    now,
    async (bytes) => {
      await fetchImpl(UP_URL, { method: 'POST', body: fillerBody(bytes), cache: 'no-store', signal })
      return bytes
    },
    (value) => emit({ phase: 'upload', pingMs, jitterMs, downMbps, upMbps: value }),
  )

  const result: SpeedResult = { pingMs, jitterMs, downMbps, upMbps }
  emit({ phase: 'done', ...result })
  return result
}
