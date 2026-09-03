/**
 * Window tiling — the buildable stand-in for native Split View, which Chrome
 * exposes no creation API for (w3c/webextensions#967): two windows split the
 * original window's bounds.
 */

export interface Bounds {
  left: number
  top: number
  width: number
  height: number
}

/** Split bounds into left/right halves (left half gets the odd pixel). */
export function halves(bounds: Bounds): { left: Bounds; right: Bounds } {
  const half = Math.floor(bounds.width / 2)
  return {
    left: { left: bounds.left, top: bounds.top, width: bounds.width - half, height: bounds.height },
    right: {
      left: bounds.left + (bounds.width - half),
      top: bounds.top,
      width: half,
      height: bounds.height,
    },
  }
}

function boundsOf(win: chrome.windows.Window): Bounds {
  return {
    left: win.left ?? 0,
    top: win.top ?? 0,
    width: win.width ?? 1200,
    height: win.height ?? 800,
  }
}

/**
 * Move `tab` into its own window on `side`; the anchor window takes the
 * other half of its own current bounds.
 */
export async function tileTab(tab: chrome.tabs.Tab, side: 'left' | 'right'): Promise<void> {
  if (tab.id === undefined || tab.windowId === undefined) return
  const win = await chrome.windows.get(tab.windowId, { populate: true })
  const { left, right } = halves(boundsOf(win))
  const tabBounds = side === 'left' ? left : right
  const restBounds = side === 'left' ? right : left
  await chrome.windows.update(win.id!, { state: 'normal', ...restBounds })
  if ((win.tabs?.length ?? 0) > 1) {
    await chrome.windows.create({ tabId: tab.id, focused: true, ...tabBounds })
  } else {
    // Lone tab: moving it would close the window — snap it and open a blank
    // window in the other half instead.
    await chrome.windows.update(win.id!, { state: 'normal', ...tabBounds })
    await chrome.windows.create({ focused: false, ...restBounds })
  }
}

/**
 * Tile `target` beside the anchor tab's window: anchor keeps the left half,
 * the target tab gets its own window on the right.
 */
export async function tileBeside(
  anchorWindowId: number,
  target: chrome.tabs.Tab,
): Promise<void> {
  if (target.id === undefined) return
  const anchor = await chrome.windows.get(anchorWindowId)
  const { left, right } = halves(boundsOf(anchor))
  await chrome.windows.update(anchorWindowId, { state: 'normal', ...left })
  if (target.windowId === anchorWindowId) {
    const populated = await chrome.windows.get(anchorWindowId, { populate: true })
    if ((populated.tabs?.length ?? 0) <= 1) return
  }
  await chrome.windows.create({ tabId: target.id, focused: false, ...right })
}
