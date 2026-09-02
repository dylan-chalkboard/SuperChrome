/** Download file-type classification (icon + tile color per extension). */

const FILE_TYPES: Array<[RegExp, { icon: string; color: string }]> = [
  [/\.pdf$/i, { icon: 'doc', color: '#e05d5d' }],
  [/\.(png|jpe?g|gif|webp|svg|heic|bmp|ico)$/i, { icon: 'image', color: '#9a6ee8' }],
  [/\.(mp4|mov|mkv|webm|avi)$/i, { icon: 'film', color: '#e57fb3' }],
  [/\.(mp3|wav|flac|m4a|ogg|aiff)$/i, { icon: 'music', color: '#e8964a' }],
  [/\.(zip|tar|gz|rar|7z|tgz)$/i, { icon: 'archive', color: '#e8c341' }],
  [/\.(js|ts|tsx|jsx|py|json|html|css|sh|go|rs|java|rb)$/i, { icon: 'code', color: '#4c9df3' }],
  [/\.(docx?|txt|md|rtf|pages)$/i, { icon: 'doc', color: '#4c9df3' }],
  [/\.(xlsx?|csv|numbers)$/i, { icon: 'table', color: '#4caf7d' }],
  [/\.(dmg|pkg|app|exe|msi|deb)$/i, { icon: 'download', color: '#8e8e93' }],
]

export function fileType(filename: string): { icon: string; color: string } {
  for (const [pattern, type] of FILE_TYPES) {
    if (pattern.test(filename)) return type
  }
  return { icon: 'doc', color: '#3aa99f' }
}

