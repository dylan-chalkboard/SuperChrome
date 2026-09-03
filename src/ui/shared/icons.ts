export const BOOKMARK_SVG =
  '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 2.5h8V14l-4-2.5L4 14V2.5z" stroke="currentColor" stroke-linejoin="round"/></svg>'
export const COMMAND_SVG =
  '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M5 4l4 4-4 4" stroke="currentColor" stroke-linecap="round"/></svg>'
export const CLOCK_SVG =
  '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor"/><path d="M8 5v3.2l2.2 1.6" stroke="currentColor" stroke-linecap="round"/></svg>'
export const DOC_SVG =
  '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 1.5h5.5L12.5 5v9.5h-8.5v-13z" stroke="currentColor" stroke-linejoin="round"/><path d="M9.5 1.5V5H12.5" stroke="currentColor" stroke-linejoin="round"/></svg>'
// Getting Started checkboxes: hollow circle (to do) and green check (done).
export const ONBOARD_TODO_SVG =
  '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.2" stroke="#8a8a8e" stroke-width="1.4"/></svg>'
export const ONBOARD_DONE_SVG =
  '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.8" fill="#4caf7d"/><path d="M5.2 8.2l1.9 1.9 3.7-4" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'

// Floppy disk for Open Downloads; transparent tile.
export const FLOPPY_SVG =
  '<svg width="17" height="17" viewBox="0 0 16 16" fill="none"><path d="M2.4 1.5h9.5l2.6 2.6v9.5c0 .5-.4.9-.9.9H2.4c-.5 0-.9-.4-.9-.9V2.4c0-.5.4-.9.9-.9z" fill="#3c3c42"/><rect x="4.9" y="1.5" width="6.3" height="4.7" rx="0.6" fill="#d7d9dd"/><rect x="8.8" y="2.3" width="1.7" height="3.1" rx="0.4" fill="#3c3c42"/><rect x="3.3" y="7.4" width="9.4" height="6.2" rx="0.6" fill="#f2f3f5"/><path d="M3.3 8c0-.33.27-.6.6-.6h8.2c.33 0 .6.27.6.6v1.1H3.3z" fill="#4c9df3"/></svg>'

// Filled red ribbon bookmark with a folded corner; transparent tile.
export const RIBBON_SVG =
  '<svg width="17" height="17" viewBox="0 0 16 16" fill="none"><path d="M11.6 1.5H5.1c-.9 0-1.6.7-1.6 1.6v10.6c0 .6.7.95 1.2.6l2.8-2.1 2.8 2.1c.5.35 1.2 0 1.2-.6V1.5z" fill="#f04438"/><path d="M11.6 1.5h.9c.9 0 1.6.72 1.6 1.6v.9c0 .88-.7 1.6-1.6 1.6h-.9V1.5z" fill="#c8362c"/></svg>'

// macOS-style filled two-tone folder; rendered on a transparent tile.
export const FOLDER_SVG =
  '<svg width="17" height="17" viewBox="0 0 16 16" fill="none"><path d="M1.5 4.2C1.5 3.26 2.26 2.5 3.2 2.5h2.9c.45 0 .88.18 1.2.5l.9.9h4.6c.94 0 1.7.76 1.7 1.7v6.2c0 .94-.76 1.7-1.7 1.7H3.2c-.94 0-1.7-.76-1.7-1.7V4.2z" fill="#3f97ee"/><path d="M1.5 6.2c0-.94.76-1.7 1.7-1.7h9.6c.94 0 1.7.76 1.7 1.7v5.6c0 .94-.76 1.7-1.7 1.7H3.2c-.94 0-1.7-.76-1.7-1.7V6.2z" fill="#7ab8f5"/></svg>'

export const CMD_ICONS: Record<string, string> = {
  confetti: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 13l3-8 5 5-8 3z" stroke="currentColor" stroke-linejoin="round"/><path d="M9.5 3.5l.5-1M12.5 6.5l1-.5M11 2.5l-.3 1.5M13.5 4l-1.5.4" stroke="currentColor" stroke-linecap="round"/></svg>',
  folder: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M1.5 3.5h4.5l1.5 2h7v7h-13v-9z" stroke="currentColor" stroke-linejoin="round"/></svg>',
  'arrow-left': '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M13 8H3M7 3.5L2.5 8 7 12.5" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  'arrow-right': '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 3.5L13.5 8 9 12.5" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  tab: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="2.5" width="13" height="11" rx="1.5" stroke="currentColor"/><path d="M1.5 5.5h13" stroke="currentColor"/></svg>',
  switch: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 5.5h8M9.5 2.5l3 3-3 3M12 10.5H4M6.5 7.5l-3 3 3 3" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  pin: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="6" r="3" stroke="currentColor"/><path d="M8 9v5" stroke="currentColor" stroke-linecap="round"/></svg>',
  split: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="3" width="13" height="10" rx="1.5" stroke="currentColor"/><path d="M8 3v10" stroke="currentColor"/></svg>',
  external: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M6.5 3.5H3v9.5h9.5V9.5M9.5 3h3.5v3.5M12.7 3.3L8 8" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  merge: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M5 2.5v3a3 3 0 003 3 3 3 0 003-3v-3M8 8.5V14M5.5 11.5L8 14l2.5-2.5" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  group: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="5" cy="5" r="2" stroke="currentColor"/><circle cx="11" cy="5" r="2" stroke="currentColor"/><circle cx="8" cy="11" r="2" stroke="currentColor"/></svg>',
  incognito: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="4.5" cy="10.5" r="2" stroke="currentColor"/><circle cx="11.5" cy="10.5" r="2" stroke="currentColor"/><path d="M6.5 10.5h3M2 7.5h12M5 7l1-3.5h4L11 7" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  'zoom-in': '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="4.5" stroke="currentColor"/><path d="M10.5 10.5L14 14M5 7h4M7 5v4" stroke="currentColor" stroke-linecap="round"/></svg>',
  'zoom-out': '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="4.5" stroke="currentColor"/><path d="M10.5 10.5L14 14M5 7h4" stroke="currentColor" stroke-linecap="round"/></svg>',
  zoom: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="4.5" stroke="currentColor"/><path d="M10.5 10.5L14 14" stroke="currentColor" stroke-linecap="round"/></svg>',
  fullscreen: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  gear: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="2.2" stroke="currentColor"/><path d="M8 1.8v1.7M8 12.5v1.7M1.8 8h1.7M12.5 8h1.7M3.6 3.6l1.2 1.2M11.2 11.2l1.2 1.2M12.4 3.6l-1.2 1.2M4.8 11.2l-1.2 1.2" stroke="currentColor" stroke-linecap="round"/></svg>',
  code: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M5.5 4.5L2 8l3.5 3.5M10.5 4.5L14 8l-3.5 3.5" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  bookmark: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 2.5h8V14l-4-2.5L4 14V2.5z" stroke="currentColor" stroke-linejoin="round"/></svg>',
  clock: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor"/><path d="M8 5v3.2l2.2 1.6" stroke="currentColor" stroke-linecap="round"/></svg>',
  download: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 2v8M5 7l3 3 3-3M3 13.5h10" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  save: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 3h8.5L13 4.5V13H3z" stroke="currentColor" stroke-linejoin="round"/><path d="M5 3v3h5V3M5 13V9.5h6V13" stroke="currentColor" stroke-linejoin="round"/></svg>',
  search: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="4.5" stroke="currentColor"/><path d="M10.5 10.5L14 14" stroke="currentColor" stroke-linecap="round"/></svg>',
  printer: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4.5 6V2.5h7V6M2.5 6h11v5h-2.5M4.5 9h7v4.5h-7zM4.5 11H2.5V6" stroke="currentColor" stroke-linejoin="round"/></svg>',
  gauge: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2.5 11.5a5.5 5.5 0 0111 0" stroke="currentColor" stroke-linecap="round"/><path d="M8 11.5L10.5 7" stroke="currentColor" stroke-linecap="round"/></svg>',
  shield: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 2l5 1.8v3.7c0 3.2-2 5.4-5 6.5-3-1.1-5-3.3-5-6.5V3.8z" stroke="currentColor" stroke-linejoin="round"/></svg>',
  key: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="5.5" cy="10.5" r="3" stroke="currentColor"/><path d="M8 8l5.5-5.5M11 5l2 2M9.5 6.5L11 8" stroke="currentColor" stroke-linecap="round"/></svg>',
  trash: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 4.5h10M6.5 4.5v-2h3v2M4.5 4.5l.7 9h5.6l.7-9M6.7 7v4M9.3 7v4" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  puzzle: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M6 2.5h4v3h3v4h-3v3H6v-3H3v-4h3z" stroke="currentColor" stroke-linejoin="round"/></svg>',
  keyboard: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="2" y="4.5" width="12" height="7" rx="1" stroke="currentColor"/><path d="M4.5 7h.1M7 7h.1M9.5 7h.1M11.5 7h.1M5 9.5h6" stroke="currentColor" stroke-linecap="round"/></svg>',
  flag: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 14V2.5M4 3h8l-2 2.5 2 2.5H4" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  info: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor"/><path d="M8 7.5V11M8 5.2v.2" stroke="currentColor" stroke-linecap="round"/></svg>',
  globe: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor"/><path d="M2 8h12M8 2c-3.5 3.5-3.5 8.5 0 12M8 2c3.5 3.5 3.5 8.5 0 12" stroke="currentColor"/></svg>',
  paint: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 2s4.5 5.2 4.5 8.2a4.5 4.5 0 01-9 0C3.5 7.2 8 2 8 2z" stroke="currentColor" stroke-linejoin="round"/></svg>',
  reset: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M13 8a5 5 0 11-1.5-3.5M13 2.5V5h-2.5" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  link: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M6.5 9.5l3-3M5 7L3.2 8.8a2.5 2.5 0 003.5 3.5L8.5 10.5M11 9l1.8-1.8a2.5 2.5 0 00-3.5-3.5L7.5 5.5" stroke="currentColor" stroke-linecap="round"/></svg>',
  doc: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 1.5h5.5L12.5 5v9.5h-8.5v-13z" stroke="currentColor" stroke-linejoin="round"/><path d="M9.5 1.5V5H12.5" stroke="currentColor" stroke-linejoin="round"/></svg>',
  image: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="10" rx="1" stroke="currentColor"/><circle cx="5.5" cy="6.5" r="1.2" stroke="currentColor"/><path d="M2 11l3.5-3 3 2.5L11 8l3 3" stroke="currentColor" stroke-linejoin="round"/></svg>',
  film: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="10" rx="1" stroke="currentColor"/><path d="M5 3v10M11 3v10M2 6h3M2 10h3M11 6h3M11 10h3" stroke="currentColor"/></svg>',
  music: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M6 12.5V3.5l7-1.5v9" stroke="currentColor" stroke-linejoin="round"/><circle cx="4" cy="12.5" r="2" stroke="currentColor"/><circle cx="11" cy="11.5" r="2" stroke="currentColor"/></svg>',
  archive: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="2.5" y="4.5" width="11" height="9" rx="1" stroke="currentColor"/><path d="M2 2.5h12v2H2zM6.5 7.5h3" stroke="currentColor" stroke-linejoin="round"/></svg>',
  table: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="10" rx="1" stroke="currentColor"/><path d="M2 6.5h12M2 9.5h12M6.5 3v10M10.5 3v10" stroke="currentColor"/></svg>',
  form: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="2.5" y="3" width="11" height="10" rx="1" stroke="currentColor"/><path d="M5 6h6M5 8.5h6M5 11h3" stroke="currentColor" stroke-linecap="round"/></svg>',
}

/** Extra glyphs for favorite-tile customization (not tied to commands). */
export const EXTRA_ICONS: Record<string, string> = {
  heart: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 13.5S2.5 10 2.5 6.2C2.5 4.4 4 3 5.7 3c1 0 1.9.5 2.3 1.3C8.4 3.5 9.3 3 10.3 3 12 3 13.5 4.4 13.5 6.2 13.5 10 8 13.5 8 13.5z" stroke="currentColor" stroke-linejoin="round"/></svg>',
  star: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 2l1.8 3.7 4 .6-2.9 2.8.7 4L8 11.2 4.4 13l.7-4-2.9-2.7 4-.6z" stroke="currentColor" stroke-linejoin="round"/></svg>',
  home: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2.5 8L8 3l5.5 5M4 7v6.5h8V7" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  mail: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="2" y="4" width="12" height="8" rx="1" stroke="currentColor"/><path d="M2.5 5l5.5 4 5.5-4" stroke="currentColor" stroke-linejoin="round"/></svg>',
  chat: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2.5 3.5h11v7H8l-3 2.5v-2.5H2.5z" stroke="currentColor" stroke-linejoin="round"/></svg>',
  calendar: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="2.5" y="3.5" width="11" height="9.5" rx="1" stroke="currentColor"/><path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" stroke="currentColor" stroke-linecap="round"/></svg>',
  terminal: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="10" rx="1" stroke="currentColor"/><path d="M4.5 6l2 2-2 2M8.5 10.5h3" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  database: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><ellipse cx="8" cy="4" rx="4.5" ry="1.8" stroke="currentColor"/><path d="M3.5 4v8c0 1 2 1.8 4.5 1.8s4.5-.8 4.5-1.8V4M3.5 8c0 1 2 1.8 4.5 1.8S12.5 9 12.5 8" stroke="currentColor"/></svg>',
  cloud: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4.5 12.5a3 3 0 010-6A4 4 0 0112.3 7a2.8 2.8 0 01-.3 5.5z" stroke="currentColor" stroke-linejoin="round"/></svg>',
  lock: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="3.5" y="7" width="9" height="6" rx="1" stroke="currentColor"/><path d="M5.5 7V5a2.5 2.5 0 015 0v2" stroke="currentColor"/></svg>',
  bell: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 2.5a4 4 0 00-4 4V9l-1.2 2h10.4L12 9V6.5a4 4 0 00-4-4zM6.8 13a1.3 1.3 0 002.4 0" stroke="currentColor" stroke-linejoin="round"/></svg>',
  book: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 3h5v10H4a1 1 0 01-1-1zM13 3H8v10h4a1 1 0 001-1z" stroke="currentColor" stroke-linejoin="round"/></svg>',
  briefcase: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="2.5" y="5" width="11" height="7.5" rx="1" stroke="currentColor"/><path d="M6 5V3.5h4V5M2.5 8.5h11" stroke="currentColor"/></svg>',
  cart: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2 3h2l1.6 7h6.8l1.6-5H5" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/><circle cx="6.3" cy="12.7" r="1" stroke="currentColor"/><circle cx="11" cy="12.7" r="1" stroke="currentColor"/></svg>',
  camera: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="2" y="4.5" width="12" height="8" rx="1.5" stroke="currentColor"/><circle cx="8" cy="8.5" r="2.3" stroke="currentColor"/><path d="M5.5 4.5l1-1.5h3l1 1.5" stroke="currentColor" stroke-linejoin="round"/></svg>',
  pin: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 14s4.5-5 4.5-8a4.5 4.5 0 10-9 0C3.5 9 8 14 8 14z" stroke="currentColor" stroke-linejoin="round"/><circle cx="8" cy="6" r="1.6" stroke="currentColor"/></svg>',
  play: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M5 3.5l8 4.5-8 4.5z" stroke="currentColor" stroke-linejoin="round"/></svg>',
  bolt: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M9 2L4 9h3l-1 5 5-7H8z" stroke="currentColor" stroke-linejoin="round"/></svg>',
  chart: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 13V7M7 13V3.5M11 13V9M2 13.5h12" stroke="currentColor" stroke-linecap="round"/></svg>',
  moon: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M12.8 9.7A5.5 5.5 0 116.3 3.2a4.5 4.5 0 006.5 6.5z" stroke="currentColor" stroke-linejoin="round"/></svg>',
  sun: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="2.5" stroke="currentColor"/><path d="M8 2v1.5M8 12.5V14M2 8h1.5M12.5 8H14M3.8 3.8l1 1M11.2 11.2l1 1M12.2 3.8l-1 1M4.8 11.2l-1 1" stroke="currentColor" stroke-linecap="round"/></svg>',
  user: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="5.3" r="2.5" stroke="currentColor"/><path d="M3 13.5a5 5 0 0110 0" stroke="currentColor" stroke-linecap="round"/></svg>',
}

/** Everything pickable in the favorite customizer. */
export const ALL_ICONS: Record<string, string> = { ...CMD_ICONS, ...EXTRA_ICONS }
