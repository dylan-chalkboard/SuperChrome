/* ---------- Snippets: reusable text inserted like emoji ---------- */

export interface Snippet {
  name: string
  text: string
}

/**
 * Options-page format: snippets separated by lines containing only `---`;
 * the first line of each block is the name, the rest is the snippet body
 * (blank lines inside a body are preserved).
 */
export function parseSnippets(text: string): Snippet[] {
  return text
    .split(/^---\s*$/m)
    .map((block) => block.replace(/^\n+|\n+$/g, ''))
    .filter(Boolean)
    .map((block) => {
      const newline = block.indexOf('\n')
      const name = (newline < 0 ? block : block.slice(0, newline)).trim()
      const body = newline < 0 ? '' : block.slice(newline + 1)
      return { name, text: body }
    })
    .filter((s) => s.name && s.text)
}

export function serializeSnippets(snippets: Snippet[]): string {
  return snippets.map((s) => `${s.name}\n${s.text}`).join('\n---\n')
}

