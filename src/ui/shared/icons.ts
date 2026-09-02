export const BOOKMARK_SVG =
  '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 2.5h8V14l-4-2.5L4 14V2.5z" stroke="currentColor" stroke-linejoin="round"/></svg>'
export const COMMAND_SVG =
  '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M5 4l4 4-4 4" stroke="currentColor" stroke-linecap="round"/></svg>'
export const CLOCK_SVG =
  '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor"/><path d="M8 5v3.2l2.2 1.6" stroke="currentColor" stroke-linecap="round"/></svg>'
export const DOC_SVG =
  '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 1.5h5.5L12.5 5v9.5h-8.5v-13z" stroke="currentColor" stroke-linejoin="round"/><path d="M9.5 1.5V5H12.5" stroke="currentColor" stroke-linejoin="round"/></svg>'
export const FOLDER_SVG =
  '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M1.5 3.5h4.5l1.5 2h7v7h-13v-9z" stroke="currentColor" stroke-linejoin="round"/></svg>'

export const CMD_ICONS: Record<string, string> = {
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
