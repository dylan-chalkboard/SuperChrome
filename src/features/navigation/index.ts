/** URL/host helpers shared across the extension. */


/**
 * Turn an address-bar-like query ("google.com", "localhost:3000/x") into a
 * navigable URL, or null when it reads as a search phrase instead.
 */
export function urlFromQuery(raw: string): string | null {
  const q = raw.trim()
  if (!q || /\s/.test(q)) return null
  if (/^https?:\/\/\S+$/i.test(q)) return q
  if (/^localhost(:\d+)?(\/\S*)?$/i.test(q)) return `http://${q}`
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}(:\d+)?(\/\S*)?$/i.test(q)) return `https://${q}`
  return null
}

export function hostOf(url: string | undefined): string | null {
  try {
    return url ? new URL(url).hostname.toLowerCase() : null
  } catch {
    return null
  }
}

export function basename(path: string): string {
  return path.split('/').pop() || path
}

export function ago(t: number): string {
  const s = Math.max(0, (Date.now() - t) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}
