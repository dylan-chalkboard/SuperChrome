import type { UsageMap } from '../features/ranking'

export async function getUsage(): Promise<UsageMap> {
  try {
    const result = await chrome.storage.local.get('usage')
    return result.usage ?? {}
  } catch {
    return {}
  }
}

export async function recordUsage(key: string): Promise<void> {
  const usage = await getUsage()
  const entry = usage[key]
  usage[key] = { n: (entry?.n ?? 0) + 1, t: Date.now() }
  await chrome.storage.local.set({ usage }).catch(() => {})
}
