/* ---------- Bookmark tree walkers ---------- */

export interface BookmarkNodeLike {
  id: string
  title: string
  url?: string
  children?: BookmarkNodeLike[]
}

export function collectBookmarks(
  node: BookmarkNodeLike,
  path: string[],
  out: Array<{ id: string; title: string; url: string; path: string }>,
): void {
  for (const child of node.children ?? []) {
    if (child.url) {
      out.push({
        id: child.id,
        title: child.title || child.url,
        url: child.url,
        path: path.join(' / '),
      })
    } else {
      collectBookmarks(child, [...path, child.title], out)
    }
  }
}

export function collectFolders(
  node: BookmarkNodeLike,
  path: string[],
  out: Array<{ id: string; path: string }>,
): void {
  for (const child of node.children ?? []) {
    if (child.url) continue
    const childPath = [...path, child.title]
    out.push({ id: child.id, path: childPath.join(' / ') })
    collectFolders(child, childPath, out)
  }
}
