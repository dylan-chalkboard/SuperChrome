/**
 * Palette content script. Chrome loads content scripts as classic scripts, so
 * dist/palette.js must stay a self-contained IIFE — but the source can import
 * freely: a second build pass (vite.palette.config.ts) inlines everything.
 *
 * Modes: plain text = bookmarks, '>' = commands, '@' = open tabs, '#' = history,
 * '*' = the bookmarks section (library view with save flow and Inbox triage).
 * Cmd+K opens a Raycast-style actions panel for the selected item.
 */

import { getSettings } from './core/settings'
import { FOLDER_COLORS, TILE_COLORS, TILE_GRADIENTS, folderSvg } from './features/bookmarks/colors'
import { folderColorOf, loadFolderColors, setFolderColor } from './ui/shared/folder-colors'
import { ONBOARD_STEPS, onboardProgress, onboardVisible } from './features/onboarding'
import {
  dismissOnboarding,
  loadOnboarding,
  markOnboard,
  onboardingState,
  reviveOnboarding,
} from './ui/shared/onboarding'
import type { UserSettings } from './core/settings'
import {
  LIBRARY_CSS,
  initLibrary,
  libraryDepth,
  libraryEnterFolder,
  libraryKey,
  libraryOwnsInput,
  libraryUp,
  libraryCurrentFolderId,
  openLibrarySave,
  renderLibrary,
  resetLibrary,
} from './features/bookmarks/view'
import { tileGradient } from './features/gradients'
import { GROUP_COLORS } from './features/tabs/search'
import { cleanHost } from './features/navigation'
import { parseQuicklinks, serializeQuicklinks } from './features/quicklinks'
import { parseSnippets, serializeSnippets } from './features/snippets'
import {
  favKey,
  favToItem,
  favoriteActionFor,
  favoriteKeyOf,
  isFavorite,
  loadFavorites,
  toggleFavorite,
  updateFavorite,
} from './ui/shared/favorites'
import { ALL_ICONS, BOOKMARK_SVG, CLOCK_SVG, CMD_ICONS, COMMAND_SVG, DOC_SVG, FLOPPY_SVG, ONBOARD_DONE_SVG, ONBOARD_TODO_SVG, RIBBON_SVG } from './ui/shared/icons'
import { MODE_PLACEHOLDERS, MODE_PREFIX, PREFIX_CHARS, mode } from './ui/shared/mode'
import type { FavoriteEntry, PaletteAction, RemoteItem } from './ui/shared/types'

interface FolderInfo {
  id: string
  path: string
}

// IIFE + load guard: the manifest injection and the on-demand scripting
// fallback can both run this file in the same isolated world.
;(() => {
const world = window as unknown as Record<string, unknown>
if (world.__codePanelPaletteLoaded) return
world.__codePanelPaletteLoaded = true

const PALETTE_CSS = `
* { box-sizing: border-box; }
.backdrop {
  position: fixed; inset: 0;
}
.panel {
  position: fixed; top: 12px; left: 50%; transform: translateX(-50%);
  transition: opacity 0.13s ease, transform 0.13s ease;
  width: min(720px, 94vw);
  background: rgba(24, 24, 26, var(--sc-op, 0.8));
  backdrop-filter: blur(60px) saturate(1.6);
  -webkit-backdrop-filter: blur(60px) saturate(1.6);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 16px;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.14),
    inset 0 0 0 0.5px rgba(255, 255, 255, 0.06),
    0 16px 48px rgba(0, 0, 0, 0.6);
  font: 13px -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  color: #ccccccdd;
  overflow: hidden;
}
.panel.enter, .panel.closing {
  opacity: 0;
  transform: translateX(-50%) translateY(-6px) scale(0.985);
}
.input-row {
  display: flex; align-items: center; position: relative;
  border-bottom: 1px solid #ffffff10;
  transition: border-bottom-color 0.25s;
}
.input-row > * { position: relative; }
.input-row::before {
  content: ''; position: absolute; inset: 0; pointer-events: none;
  background: linear-gradient(180deg, var(--mode-tint, transparent), transparent);
  opacity: 0; transition: opacity 0.25s;
}
.input-row[class*=" mode-"]::before { opacity: 1; }
.input-row.mode-commands { --mode-tint: rgba(76, 157, 243, 0.22); border-bottom-color: rgba(76, 157, 243, 0.35); }
.input-row.mode-tabs { --mode-tint: rgba(224, 97, 158, 0.22); border-bottom-color: rgba(224, 97, 158, 0.35); }
.input-row.mode-history { --mode-tint: rgba(154, 110, 232, 0.22); border-bottom-color: rgba(154, 110, 232, 0.35); }
.input-row.mode-emoji { --mode-tint: rgba(76, 175, 125, 0.22); border-bottom-color: rgba(76, 175, 125, 0.35); }
.input-row.mode-downloads { --mode-tint: rgba(58, 169, 159, 0.22); border-bottom-color: rgba(58, 169, 159, 0.35); }
.input-row.mode-snippets { --mode-tint: rgba(232, 150, 74, 0.22); border-bottom-color: rgba(232, 150, 74, 0.35); }
.input-row.mode-library { --mode-tint: rgba(224, 93, 93, 0.22); border-bottom-color: rgba(224, 93, 93, 0.35); }
@keyframes menu-in {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: none; }
}
.actions, .brand-menu { animation: menu-in 0.14s ease-out; }
@keyframes glyph-in {
  from { opacity: 0; transform: translateX(-4px); }
  to { opacity: 1; transform: none; }
}
.back-btn {
  display: none; align-items: center; justify-content: center;
  width: 26px; height: 26px; margin-left: 12px; border-radius: 7px;
  background: #ffffff14; color: #ccccccbb; cursor: pointer; flex: none;
}
.back-btn:hover { background: #ffffff24; color: #ffffff; }
.input-row.browsing .input { padding-left: 9px; }
.light .back-btn { background: #00000010; color: #00000080; }
.light .back-btn:hover { background: #0000001c; color: #1c1c1e; }
.mode-glyph {
  display: none; padding-left: 16px;
  font-size: 15px; font-weight: 700; line-height: 1;
}
[class*=" mode-"] > .mode-glyph { display: block; animation: glyph-in 0.18s ease-out; }
.mode-commands .mode-glyph { color: #4c9df3; }
.mode-tabs .mode-glyph { color: #e0619e; }
.mode-history .mode-glyph { color: #9a6ee8; }
.mode-emoji .mode-glyph { color: #4caf7d; }
.mode-downloads .mode-glyph { color: #3aa99f; }
.mode-snippets .mode-glyph { color: #e8964a; }
.mode-library .mode-glyph { color: #e05d5d; }
.mode-commands .input, .mode-tabs .input, .mode-history .input,
.mode-emoji .input, .mode-downloads .input, .mode-snippets .input,
.mode-library .input { padding-left: 7px; }
.input {
  flex: 1; min-width: 0;
  background: transparent; border: none; outline: none;
  padding: 14px 16px; color: #e8e8e8;
  font-size: 15px; font-family: inherit;
}
.input::placeholder { color: #ffffff40; }
.hint { display: flex; margin-right: 14px; flex-shrink: 0; }
.kbd {
  background: #ffffff14; color: #cccccc99;
  border-radius: 4px; padding: 2px 7px; font-size: 11px;
}
.hint .kbd {
  margin-right: 6px; max-width: 100px; overflow: hidden; white-space: nowrap;
  transition: max-width 0.25s ease, opacity 0.2s, padding 0.25s ease, margin-right 0.25s ease;
}
.hint .kbd:last-child { margin-right: 0; }
/* Glyph-first chips: just the colored prefix char until hovered or active. */
.kbd .lbl { display: none; }
.kbd.active .lbl, .hint .kbd:hover .lbl { display: inline; }
.kbd .pfx { font-weight: 700; }
.chip-commands .pfx { color: #4c9df3; }
.chip-tabs .pfx { color: #e0619e; }
.chip-history .pfx { color: #9a6ee8; }
.chip-emoji .pfx { color: #4caf7d; }
.chip-downloads .pfx { color: #3aa99f; }
.chip-snippets .pfx { color: #e8964a; }
.chip-library .pfx { color: #e05d5d; }
.kbd.active .pfx { color: inherit; }
.input-row[class*=" mode-"] .hint .kbd:not(.active),
.input-row.typing .hint .kbd:not(.active) {
  max-width: 0; opacity: 0; padding-left: 0; padding-right: 0; margin-right: 0;
}
.kbd.chip-commands.active { background: #4c9df3; color: #ffffff; }
.kbd.chip-tabs.active { background: #e0619e; color: #ffffff; }
.kbd.chip-history.active { background: #9a6ee8; color: #ffffff; }
.kbd.chip-emoji.active { background: #4caf7d; color: #ffffff; }
.kbd.chip-downloads.active { background: #3aa99f; color: #ffffff; }
.kbd.chip-snippets.active { background: #e8964a; color: #ffffff; }
.kbd.chip-library.active { background: #e05d5d; color: #ffffff; }
.list { height: 55vh; overflow-y: auto; padding: 8px; position: relative; }
.selector {
  position: absolute; left: 8px; right: 8px; top: 0; height: 40px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.14);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
  transition: transform 0.1s ease, height 0.1s ease;
  pointer-events: none;
  will-change: transform;
  opacity: 0;
}
.group-label {
  font-size: 11px; font-weight: 600;
  color: #ffffff59; padding: 8px 8px 4px;
}
.item {
  display: flex; align-items: center; gap: 10px;
  height: 40px; padding: 0 10px; border-radius: 8px; cursor: pointer;
  white-space: nowrap;
  position: relative; z-index: 1;
}
.emoji-grid {
  display: grid; grid-template-columns: repeat(8, 1fr); gap: 2px; padding: 2px;
}
.emoji-cell {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 3px; height: 58px; padding: 4px; border-radius: 8px; cursor: pointer;
  min-width: 0;
}
.emoji-cell .glyph { font-size: 22px; line-height: 1; }
.emoji-cell .emoji-name {
  max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-size: 9px; color: #ffffff59;
}
.emoji-cell.selected, .emoji-cell:hover { background: rgba(255, 255, 255, 0.14); }
.item .icon {
  display: flex; align-items: center; justify-content: center;
  width: 24px; height: 24px; border-radius: 6px;
  background: #ffffff10;
  flex-shrink: 0;
}
.item .icon.plain { background: transparent; }
.fav-bar { display: flex; flex-wrap: wrap; gap: 6px; padding: 10px 12px 4px; }
.fav-item {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  width: 64px; flex: none;
}
.fav-tile {
  width: 46px; height: 46px; border-radius: 12px;
  background: #ffffff10; color: #ffffff;
  display: flex; align-items: center; justify-content: center;
  transition: box-shadow 0.12s ease;
}
.fav-tile .fav-emoji { font-size: 24px; line-height: 1; }
.fav-item:hover .fav-tile, .fav-item.selected .fav-tile { box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.35); }
.fav-star { display: flex; flex-shrink: 0; color: #e8c341; }
.fav-tile img { width: 28px; height: 28px; border-radius: 6px; }
.fav-tile svg { width: 23px; height: 23px; }
.fav-cap {
  max-width: 62px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-size: 9px; color: #ffffff59;
}
.item .icon.kind-command { background: var(--sc-command, linear-gradient(135deg, #4cd5f3, #4c65f3)); color: #ffffff; }
.item .icon.kind-folder { background: transparent; }
.item .icon.kind-history { background: var(--sc-history, linear-gradient(135deg, #716ee8, #c36ee8)); color: #ffffff; }
.item .icon.kind-bookmark, .item .icon.kind-tab, .item .icon.kind-closed {
  background: var(--sc-fallback, linear-gradient(135deg, #e05d89, #e0895d)); color: #ffffff;
}
.item .icon.kind-download { background: linear-gradient(135deg, #3aa97a, #3a8ea9); color: #ffffff; }
.item .icon.kind-snippet { background: linear-gradient(135deg, #e8614a, #e8cb4a); color: #ffffff; }
.group-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.item .icon.kind-calc { background: linear-gradient(135deg, #4caf5c, #4caf9e); color: #ffffff; font-weight: 700; font-size: 14px; }
.item .icon.emoji-glyph { font-size: 17px; }
.item .icon img { width: 18px; height: 18px; border-radius: 4px; }
.item .title {
  overflow: hidden; text-overflow: ellipsis;
  flex-shrink: 0; max-width: 55%;
  color: #e8e8e8; font-weight: 500;
}
.item .title b { color: #ffffff; font-weight: 700; }
.item .detail {
  flex: 1; overflow: hidden; text-overflow: ellipsis;
  color: #ffffff4d; font-size: 13px;
}
.open-tab-arrow {
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  width: 24px; height: 24px; margin-left: 8px; border-radius: 7px;
  background: #ffffff14; color: #e8e8e8;
}
.light .open-tab-arrow { background: #00000010; color: #303036; }
.item .type {
  flex-shrink: 0; margin-left: auto;
  color: #ffffff4d; font-size: 12px;
}
.empty { padding: 16px; color: #ffffff59; }
.footer {
  display: flex; align-items: center; gap: 14px;
  height: 38px; padding: 0 14px;
  border-top: 1px solid #ffffff10;
  /* Solid at all times — the glass treatment stops above this bar. */
  background: #1b1b1e;
  color: #cccccc80; font-size: 12px;
}
.light .footer { background: #ececef; }
.footer .spacer { flex: 1; }
.footer .action { display: flex; align-items: center; gap: 6px; }
.footer .brand-logo {
  width: 26px; height: 26px; opacity: 0.5; cursor: pointer;
  box-sizing: content-box; padding: 3px; margin: -3px; border-radius: 6px;
}
.footer .brand-logo:hover { opacity: 0.9; background: #ffffff14; }
.light .footer .brand-logo:hover { background: #00000010; }
.brand-menu {
  position: absolute; left: 10px; bottom: 46px;
  min-width: 210px; z-index: 5;
  background: #232326;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 10px; padding: 4px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 8px 24px #00000088;
}
.brand-menu .action-row:hover { background: rgba(255, 255, 255, 0.14); }
.brand-menu .menu-version {
  padding: 6px 10px 4px; font-size: 11px; color: #ffffff40; cursor: default;
}
.menu-icon {
  display: flex; align-items: center; justify-content: center;
  width: 16px; color: #cccccc99; flex: none;
}
.action-row.danger .menu-icon { color: inherit; }
.light .menu-icon { color: #00000059; }
.light .brand-menu { background: #ffffff; border-color: rgba(0, 0, 0, 0.12); box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25); }
.light .brand-menu .action-row:hover { background: rgba(0, 0, 0, 0.08); }
.light .brand-menu .menu-version { color: #00000045; }
.actions {
  position: absolute; right: 10px; bottom: 46px;
  min-width: 230px;
  /* Above .item rows (z-index 1) — without this their text paints over the menu. */
  z-index: 5;
  background: #232326;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 10px; padding: 4px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 8px 24px #00000088;
}
.action-row {
  display: flex; align-items: center; gap: 10px;
  height: 30px; padding: 0 10px; border-radius: 6px; cursor: pointer;
  color: #e0e0e0; white-space: nowrap;
}
.action-row .spacer { flex: 1; min-width: 16px; }
.action-row.selected { background: rgba(255, 255, 255, 0.14); }
.action-row.danger { color: #ff8f8f; }
.list::-webkit-scrollbar { width: 10px; }
.list::-webkit-scrollbar-thumb { background: #ffffff1a; border-radius: 5px; }
/* ---------- Customize Favorite panel ---------- */
.fav-preview { display: flex; justify-content: center; padding: 4px 0 2px; }
.swatch-strip { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.swatch-dot {
  width: 24px; height: 24px; border-radius: 50%; cursor: pointer;
  border: 1px solid #ffffff20; box-sizing: border-box;
}
.swatch-dot.none {
  background:
    linear-gradient(to top left, transparent 46%, #e05d5d 47%, #e05d5d 53%, transparent 54%),
    #ffffff10;
}
.swatch-dot.on { box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.7); }
.icon-grid { display: flex; flex-wrap: wrap; gap: 6px; max-height: 160px; overflow-y: auto; }
.icon-cell {
  width: 30px; height: 30px; border-radius: 7px; cursor: pointer;
  background: #ffffff10; color: #ccccccbb;
  display: flex; align-items: center; justify-content: center; flex: none;
}
.icon-cell:hover { background: #ffffff20; color: #ffffff; }
.icon-cell.on { background: #4c9df3; color: #ffffff; }
.fav-tile .fav-text {
  font-size: 15px; font-weight: 700; letter-spacing: 0.3px; text-transform: uppercase;
}
.light .swatch-dot { border-color: #00000020; }
.light .swatch-dot.none { background:
    linear-gradient(to top left, transparent 46%, #d03d3d 47%, #d03d3d 53%, transparent 54%),
    #00000008; }
.light .swatch-dot.on { box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.45); }
.light .icon-cell { background: #00000008; color: #00000073; }
.light .icon-cell:hover { background: #00000014; color: #1c1c1e; }
.light .icon-cell.on { background: #4c9df3; color: #ffffff; }

/* ---------- In-palette settings view (Raycast-style two-column form) ---------- */
.settings { padding: 20px 24px 22px; display: flex; flex-direction: column; gap: 13px; }
.set-row { display: grid; grid-template-columns: 150px 1fr; gap: 16px; align-items: center; }
.set-row.top { align-items: start; }
.set-row > label { text-align: right; color: #ffffff8c; font-size: 13px; padding-top: 1px; }
.set-hint { display: block; font-size: 11px; color: #ffffff40; margin-top: 3px; }
.set-div { height: 1px; background: #ffffff10; margin: 8px -24px; }
.seg { display: inline-flex; gap: 4px; }
.seg button {
  background: none; border: none; color: #cccccc99; font: inherit; font-size: 12.5px;
  padding: 4px 13px; border-radius: 999px; cursor: pointer;
}
.seg button.on { background: #ffffff1f; color: #ffffff; }
.check { display: flex; align-items: center; gap: 8px; color: #e0e0e0; font-size: 13px; cursor: pointer; }
.settings input[type='range'] { width: 200px; accent-color: #4c9df3; }
.settings select, .settings input[type='number'] {
  background: #ffffff10; border: 1px solid #ffffff20; border-radius: 6px;
  color: #e8e8e8; font: inherit; padding: 4px 8px; outline: none;
}
.settings input[type='number'] { width: 70px; }
.settings input[type='color'] {
  width: 38px; height: 26px; padding: 2px; cursor: pointer;
  background: #ffffff10; border: 1px solid #ffffff20; border-radius: 6px;
}
.settings input[type='checkbox'] { width: 15px; height: 15px; accent-color: #4c9df3; margin: 0; }
.settings textarea {
  width: 100%; min-height: 72px; resize: vertical;
  background: #ffffff10; border: 1px solid #ffffff20; border-radius: 6px;
  color: #e8e8e8; font: 12px ui-monospace, Menlo, monospace; padding: 8px; outline: none;
}
.set-swatches { display: flex; gap: 12px; align-items: center; }
.set-swatches span { font-size: 11px; color: #ffffff59; }
.light .set-row > label { color: #00000073; }
.light .set-hint { color: #00000045; }
.light .set-div { background: #00000010; }
.light .seg button { color: #00000073; }
.light .seg button.on { background: #00000014; color: #1c1c1e; }
.light .check { color: #303036; }
.light .set-swatches span { color: #00000059; }
.light .settings select, .light .settings input[type='number'],
.light .settings input[type='color'], .light .settings textarea {
  background: #00000008; border-color: #00000020; color: #26262b;
}

/* ---------- Light mode (appearance setting or system preference) ---------- */
.panel.light {
  background: rgba(244, 244, 246, var(--sc-op, 0.8));
  border-color: rgba(0, 0, 0, 0.1);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6), 0 16px 48px rgba(0, 0, 0, 0.25);
  color: #333338;
}
.light .input { color: #1c1c1e; }
.light .input::placeholder { color: #00000040; }
.light .input-row { border-bottom-color: #00000012; }
.light .kbd { background: #00000010; color: #00000073; }
.light .selector { background: rgba(0, 0, 0, 0.07); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4); }
.light .group-label { color: #00000059; }
.light .item .title { color: #26262b; }
.light .item .title b { color: #000000; }
.light .item .detail, .light .item .type { color: #00000045; }
.light .item .icon { background: #00000010; }
.light .item .icon.plain, .light .item .icon.kind-folder { background: transparent; }
.light .fav-tile { background: #0000000d; }
.light .fav-item:hover .fav-tile, .light .fav-item.selected .fav-tile { box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.25); }
.light .fav-cap { color: #00000059; }
.light .emoji-cell.selected, .light .emoji-cell:hover { background: rgba(0, 0, 0, 0.08); }
.light .emoji-cell .emoji-name { color: #00000059; }
.light .actions { background: #ffffff; border-color: rgba(0, 0, 0, 0.12); box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25); }
.light .action-row { color: #303036; }
.light .action-row.selected { background: rgba(0, 0, 0, 0.08); }
.light .action-row.danger { color: #d03d3d; }
.light .footer { border-top-color: #00000010; color: #00000066; }
.light .empty { color: #00000059; }
.light .list::-webkit-scrollbar-thumb { background: #00000022; }
/* The logo asset is white; invert to black anywhere it shows in light mode. */
.light .brand-logo { filter: invert(1); opacity: 0.75; }
.light .logo-img { filter: invert(1); }
@media (prefers-reduced-motion: reduce) {
  .panel, .selector, .toast, .input-row, .input-row::before, .hint .kbd { transition: none !important; }
  .mode-glyph, .actions, .brand-menu { animation: none !important; }
}
.panel.no-motion, .no-motion .selector { transition: none !important; }
.no-motion .input-row, .no-motion .input-row::before, .no-motion .hint .kbd { transition: none !important; }
.no-motion .mode-glyph, .no-motion .actions, .no-motion .brand-menu { animation: none !important; }
`

const TYPE_LABELS: Record<string, string> = {
  bookmark: 'Bookmark',
  tab: 'Tab',
  history: 'History',
  command: 'Command',
  folder: 'Folder',
  closed: 'Closed',
  calc: 'Calculator',
  emoji: 'Emoji',
  download: 'Download',
  search: 'Search',
  snippet: 'Snippet',
}

const GROUP_LABELS: Record<string, string> = {
  bookmarks: 'Bookmarks',
  commands: 'Commands',
  tabs: 'Open Tabs',
  history: 'History',
  emoji: 'Emoji',
  downloads: 'Downloads',
  snippets: 'Snippets',
  library: 'Bookmarks',
}

type UiState = 'list' | 'actions' | 'rename' | 'move' | 'group' | 'settings' | 'links' | 'fav-custom'

let paletteHost: HTMLDivElement | null = null
let paletteInput: HTMLInputElement | null = null
let paletteList: HTMLElement | null = null
let paletteFooter: HTMLElement | null = null
let panelEl: HTMLElement | null = null
let inputRowEl: HTMLElement | null = null
let backBtnEl: HTMLElement | null = null
let hintEl: HTMLElement | null = null
let modeGlyphEl: HTMLElement | null = null
/**
 * The typed mode prefix ('>', '@', '#', ':', '~', '%', '*'), held outside the input so
 * it can render as a colored glyph; the input holds only the query text.
 */
let modePrefix = ''
let actionsEl: HTMLElement | null = null
let brandMenuEl: HTMLElement | null = null
let pageLinks: RemoteItem[] = []
let creatingFolder = false
let newFolderParentId: string | undefined
let favCustomKey: string | null = null
let favGlyphTab: 'default' | 'icon' | 'emoji' | 'text' | null = null

let uiState: UiState = 'list'
let flatItems: RemoteItem[] = []
let selectedIndex = 0
let queryToken = 0

let currentActions: PaletteAction[] = []
let actionIndex = 0
let actionTarget: RemoteItem | null = null
let subStateTarget: RemoteItem | null = null
let savedQuery = ''
let foldersCache: FolderInfo[] | null = null
let browseStack: Array<{ id: string; label: string }> = []
let lastFocused: HTMLElement | null = null
let prefersNewTab = false
let selectorEl: HTMLElement | null = null
const GRID_COLS = 8
let reduceMotionPref = false
let lightMode = false

function reducedMotion(): boolean {
  return reduceMotionPref || window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Insert into the element that had focus before the palette opened, else copy. */
function insertOrCopy(text: string): void {
  const target = lastFocused
  closePalette()
  if (
    target &&
    (target.isContentEditable ||
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement)
  ) {
    target.focus()
    if (document.execCommand('insertText', false, text)) return
  }
  copyText(text)
}

chrome.runtime.onMessage.addListener((message: { type?: string; mode?: string }) => {
  if (message?.type === 'toggle-palette') {
    void togglePalette(MODE_PREFIX[message.mode ?? 'bookmarks'] ?? '')
  }
})

async function togglePalette(prefix: string): Promise<void> {
  if (paletteHost && paletteInput) {
    const currentPrefix = modePrefix === '>' ? '>' : ''
    if (currentPrefix === prefix && uiState === 'list') {
      closePalette()
    } else {
      exitSubState(false)
      setInput(prefix)
    }
    return
  }
  openPalette(prefix)
}

/** Options-page settings (opacity, icon colors) applied as CSS variables. */
async function applyUserSettings(): Promise<void> {
  try {
    const { settings } = await chrome.storage.sync.get('settings')
    if (!panelEl) return
    const appearance = settings?.appearance ?? 'system'
    lightMode =
      appearance === 'light' ||
      (appearance !== 'dark' && window.matchMedia('(prefers-color-scheme: light)').matches)
    panelEl.classList.toggle('light', lightMode)
    if (!settings) return
    if (typeof settings.glassOpacity === 'number') {
      panelEl.style.setProperty('--sc-op', String(settings.glassOpacity))
    }
    const colors = settings.iconColors ?? {}
    for (const key of ['command', 'folder', 'history', 'fallback'] as const) {
      if (typeof colors[key] === 'string') {
        panelEl.style.setProperty(`--sc-${key}`, tileGradient(colors[key]))
      }
    }
    prefersNewTab = settings.openInNewTab === true
    reduceMotionPref = settings.reduceMotion === true
    // toggle, not add: live settings edits can turn this back off.
    panelEl.classList.toggle('no-motion', reduceMotionPref)
    renderFooter()
  } catch {
    // Defaults baked into the CSS cover this.
  }
}

function setInput(value: string): void {
  if (!paletteInput) return
  modePrefix = value && PREFIX_CHARS.includes(value[0]) ? value[0] : ''
  const rest = modePrefix ? value.slice(1) : value
  paletteInput.value = rest
  paletteInput.focus()
  paletteInput.setSelectionRange(rest.length, rest.length)
  void updateList()
}

/** Pull a just-typed leading prefix char out of the input into modePrefix. */
function captureModePrefix(): void {
  if (!paletteInput || modePrefix || uiState !== 'list') return
  const first = paletteInput.value[0]
  if (first && PREFIX_CHARS.includes(first)) {
    modePrefix = first
    paletteInput.value = paletteInput.value.slice(1)
  }
}

function closePalette(): void {
  for (const type of ['keydown', 'keypress', 'keyup'] as const) {
    window.removeEventListener(type, onGlobalKey, true)
  }
  const host = paletteHost
  const panel = panelEl
  if (host && panel && !reducedMotion()) {
    host.style.pointerEvents = 'none'
    panel.classList.add('closing')
    setTimeout(() => host.remove(), 140)
  } else {
    host?.remove()
  }
  paletteHost = null
  paletteInput = null
  paletteList = null
  paletteFooter = null
  panelEl = null
  actionsEl = null
  uiState = 'list'
  actionTarget = null
  subStateTarget = null
  browseStack = []
  resetLibrary()
}

function openPalette(prefix: string): void {
  lastFocused = document.activeElement as HTMLElement | null
  paletteHost = document.createElement('div')
  paletteHost.style.cssText = 'position:fixed;inset:0;z-index:2147483647;'
  const shadow = paletteHost.attachShadow({ mode: 'closed' })

  const style = document.createElement('style')
  style.textContent = PALETTE_CSS + LIBRARY_CSS

  const backdrop = document.createElement('div')
  backdrop.className = 'backdrop'
  backdrop.addEventListener('mousedown', (e) => {
    if (e.target === backdrop) closePalette()
  })

  panelEl = document.createElement('div')
  panelEl.className = 'panel'
  // Warm the cache so ⌘K can label Add/Remove from Favorites synchronously.
  void loadFavorites()
  void loadFolderColors()
  void loadOnboarding()

  const inputRow = document.createElement('div')
  inputRow.className = 'input-row'

  paletteInput = document.createElement('input')
  paletteInput.className = 'input'
  paletteInput.placeholder = 'Search bookmarks and commands…'
  paletteInput.spellcheck = false
  modePrefix = prefix && PREFIX_CHARS.includes(prefix[0]) ? prefix[0] : ''
  paletteInput.value = modePrefix ? prefix.slice(1) : prefix
  paletteInput.addEventListener('input', () => {
    if (uiState === 'actions') closeActions()
    if (uiState === 'rename') return
    captureModePrefix()
    void updateList()
  })
  paletteInput.addEventListener('blur', () => {
    // Pages like google.com aggressively re-focus their own search box.
    // Clicks outside are handled by the backdrop, so on blur we reclaim
    // focus instead of closing.
    setTimeout(() => {
      // Settings form controls (and the library's save/triage panels) own
      // focus while those views are open.
      if (
        paletteHost &&
        paletteInput &&
        uiState !== 'settings' &&
        !libraryOwnsInput() &&
        shadow.activeElement !== paletteInput
      ) {
        paletteInput.focus()
      }
    }, 0)
  })

  const hint = document.createElement('div')
  hint.className = 'hint'
  const chipModes: Array<[string, string]> = [
    ['> Cmds', 'commands'],
    ['@ Tabs', 'tabs'],
    ['# History', 'history'],
    [': Emoji', 'emoji'],
    ['~ Downloads', 'downloads'],
    ['% Snips', 'snippets'],
    ['* Bookmarks', 'library'],
  ]
  for (const [text, chipMode] of chipModes) {
    const [pfx, ...rest] = text.split(' ')
    const chip = document.createElement('span')
    chip.className = `kbd chip-${chipMode}`
    chip.title = rest.join(' ')
    const glyph = document.createElement('b')
    glyph.className = 'pfx'
    glyph.textContent = pfx
    const label = document.createElement('span')
    label.className = 'lbl'
    label.textContent = ` ${rest.join(' ')}`
    chip.append(glyph, label)
    hint.appendChild(chip)
  }

  modeGlyphEl = document.createElement('span')
  modeGlyphEl.className = 'mode-glyph'
  backBtnEl = document.createElement('span')
  backBtnEl.className = 'back-btn'
  backBtnEl.title = 'Back'
  backBtnEl.innerHTML = CMD_ICONS['arrow-left']
  backBtnEl.addEventListener('mousedown', (e) => {
    e.preventDefault()
    popFolder()
  })
  inputRow.append(backBtnEl, modeGlyphEl, paletteInput, hint)
  inputRowEl = inputRow
  hintEl = hint

  paletteList = document.createElement('div')
  paletteList.className = 'list'

  paletteFooter = document.createElement('div')
  paletteFooter.className = 'footer'

  panelEl.append(inputRow, paletteList, paletteFooter)
  backdrop.appendChild(panelEl)
  shadow.append(style, backdrop)
  if (!reducedMotion()) {
    panelEl.classList.add('enter')
    requestAnimationFrame(() => panelEl?.classList.remove('enter'))
  }
  document.documentElement.appendChild(paletteHost)
  for (const type of ['keydown', 'keypress', 'keyup'] as const) {
    window.addEventListener(type, onGlobalKey, true)
  }
  paletteInput.focus()
  const caret = paletteInput.value.length
  paletteInput.setSelectionRange(caret, caret)
  void applyUserSettings()
  void updateList()
}

function kbd(text: string): HTMLElement {
  const chip = document.createElement('span')
  chip.className = 'kbd'
  chip.textContent = text
  return chip
}

function currentMode(): string {
  return mode(modePrefix)
}

/** Inside a real folder (bookmarks browse or the library section)? */
function inFolderContext(): boolean {
  const m = currentMode()
  return (m === 'bookmarks' && browseStack.length > 0) || (m === 'library' && libraryDepth() > 0)
}

/** Tint the input row, color the prefix glyph, and light up the mode's chip. */
function updateModeStyling(): void {
  if (!inputRowEl) return
  const mode = currentMode()
  const browsing =
    (mode === 'bookmarks' && browseStack.length > 0) || (mode === 'library' && libraryDepth() > 0)
  inputRowEl.className =
    'input-row' +
    (mode === 'bookmarks' ? '' : ` mode-${mode}`) +
    (browsing ? ' browsing' : '') +
    (paletteInput?.value ? ' typing' : '')
  if (backBtnEl) backBtnEl.style.display = browsing ? 'flex' : 'none'
  if (hintEl) hintEl.style.display = browsing ? 'none' : 'flex'
  if (modeGlyphEl) modeGlyphEl.textContent = modePrefix
  // Sub-states (rename, move, group) own the placeholder while active.
  if (paletteInput && uiState === 'list') {
    paletteInput.placeholder = MODE_PLACEHOLDERS[mode] ?? MODE_PLACEHOLDERS.bookmarks
  }
  inputRowEl.querySelectorAll<HTMLElement>('.kbd').forEach((chip) => {
    chip.classList.toggle('active', chip.classList.contains(`chip-${mode}`))
  })
}

function renderFooter(): void {
  if (!paletteFooter) return
  paletteFooter.textContent = ''
  const brand = document.createElement('img')
  brand.className = 'brand-logo'
  brand.src = chrome.runtime.getURL('/icons/footer.png')
  brand.alt = 'SuperChrome'
  brand.title = 'SuperChrome'
  brand.draggable = false
  brand.addEventListener('mousedown', (e) => {
    e.preventDefault()
    toggleBrandMenu()
  })
  const spacer = document.createElement('span')
  spacer.className = 'spacer'
  paletteFooter.append(brand, spacer)

  const mode = currentMode()
  const primary = document.createElement('span')
  primary.className = 'action'
  const primaryLabel =
    uiState === 'settings' || uiState === 'fav-custom'
      ? 'Done'
      : uiState === 'move'
        ? 'Move Here'
        : mode === 'commands'
          ? 'Run'
          : mode === 'tabs'
            ? 'Switch'
            : mode === 'emoji' || mode === 'snippets'
              ? 'Insert'
              : 'Open'
  primary.append(document.createTextNode(primaryLabel), kbd(uiState === 'settings' || uiState === 'fav-custom' ? 'esc' : '↵'))
  paletteFooter.appendChild(primary)

  if (uiState === 'list' && (mode === 'bookmarks' || mode === 'history' || mode === 'library')) {
    const secondary = document.createElement('span')
    secondary.className = 'action'
    secondary.append(
      document.createTextNode(prefersNewTab ? 'Current Tab' : 'New Tab'),
      kbd('⌘↵'),
    )
    paletteFooter.appendChild(secondary)
  }

  if (uiState === 'list') {
    if (mode === 'library') {
      const newBm = document.createElement('span')
      newBm.className = 'action'
      newBm.append(document.createTextNode('New'), kbd('⌘D'))
      paletteFooter.appendChild(newBm)
    }
    if (inFolderContext()) {
      const reorder = document.createElement('span')
      reorder.className = 'action'
      reorder.append(document.createTextNode('Reorder'), kbd('⌥↑↓'))
      paletteFooter.appendChild(reorder)
    }
    const actions = document.createElement('span')
    actions.className = 'action'
    actions.append(document.createTextNode('Actions'), kbd('⌘K'))
    paletteFooter.appendChild(actions)
  }

}

/* ---------- Key handling ---------- */

/**
 * Runs in capture phase on window while the palette is open, so page hotkey
 * handlers never see keystrokes. stopPropagation skips all downstream
 * listeners — including our input's — so key handling lives here; plain
 * typing still lands in the focused input via the default action.
 */
function onGlobalKey(e: KeyboardEvent): void {
  if (!paletteHost) return
  e.stopPropagation()
  if (e.type !== 'keydown') return

  if (brandMenuEl && e.key === 'Escape') {
    e.preventDefault()
    closeBrandMenu()
    return
  }

  // Settings/customize views own the keyboard: controls get everything but Esc.
  if (uiState === 'settings' || uiState === 'fav-custom') {
    if (e.key === 'Escape' || (uiState === 'fav-custom' && e.key === 'Enter')) {
      e.preventDefault()
      if (uiState === 'settings') exitSettings()
      else exitFavCustomize()
    }
    return
  }

  // Library section: save panel and triage own the keyboard (settings
  // pattern); in plain browse the view only claims its own keys, so ⌘K,
  // arrows, and Enter still run through the shared list machinery below.
  if (uiState === 'list' && currentMode() === 'library' && libraryKey(e)) return

  if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
    e.preventDefault()
    if (uiState === 'actions') closeActions()
    else if (uiState === 'list') openActions()
    return
  }

  // ⌘D in the bookmarks section: new bookmark (Chrome's own bookmark key).
  if (e.key === 'd' && (e.metaKey || e.ctrlKey) && uiState === 'list' && currentMode() === 'library') {
    e.preventDefault()
    openLibrarySave()
    return
  }

  if ((e.metaKey || e.ctrlKey) && e.key >= '1' && e.key <= '9' && uiState === 'list') {
    e.preventDefault()
    const item = flatItems[Number(e.key) - 1]
    if (item) void executeItem(item, false)
    return
  }

  if (uiState === 'actions') {
    if (/^[1-9]$/.test(e.key)) {
      e.preventDefault()
      const action = currentActions[Number(e.key) - 1]
      if (action && actionTarget) void runAction(action, actionTarget)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      closeActions()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      actionIndex = (actionIndex + 1) % currentActions.length
      highlightActions()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      actionIndex = (actionIndex - 1 + currentActions.length) % currentActions.length
      highlightActions()
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const action = currentActions[actionIndex]
      if (action && actionTarget) void runAction(action, actionTarget)
    }
    return
  }

  if (uiState === 'rename') {
    if (e.key === 'Escape') {
      e.preventDefault()
      exitSubState(false)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      void commitRename()
    }
    return
  }

  if (
    e.altKey &&
    (e.key === 'ArrowUp' || e.key === 'ArrowDown') &&
    uiState === 'list' &&
    inFolderContext()
  ) {
    e.preventDefault()
    const item = flatItems[selectedIndex]
    if (item) void reorderItem(item, e.key === 'ArrowUp' ? -1 : 1)
    return
  }

  const gridActive = uiState === 'list' && currentMode() === 'emoji'
  if (gridActive && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
    e.preventDefault()
    moveSelection(e.key === 'ArrowRight' ? 1 : -1)
    return
  }
  if (gridActive && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
    e.preventDefault()
    moveSelection(e.key === 'ArrowDown' ? GRID_COLS : -GRID_COLS)
    return
  }

  // Favorites bar navigation: ↑ from the top row enters it, ←/→ move
  // within it, ↓ (or Esc) returns to the list, ↵ opens the tile.
  if (uiState === 'list' && favIndex >= 0 && favBarItems.length) {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault()
      const delta = e.key === 'ArrowRight' ? 1 : -1
      setFavIndex((favIndex + delta + favBarItems.length) % favBarItems.length)
      return
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (e.key === 'ArrowDown') setFavIndex(-1)
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      const f = favBarItems[favIndex]
      if (f) void executeItem(favToItem(f), e.metaKey || e.ctrlKey)
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      setFavIndex(-1)
      return
    }
  }

  if (e.key === 'Escape') {
    e.preventDefault()
    if (uiState === 'move' || uiState === 'group' || uiState === 'links') exitSubState(false)
    else if (browseStack.length && currentMode() === 'bookmarks') popFolder()
    // Inside a prefix mode, Esc steps back to home; only home Esc closes.
    else if (modePrefix) setInput('')
    else closePalette()
  } else if (
    e.key === 'Backspace' &&
    paletteInput?.value === '' &&
    modePrefix &&
    uiState === 'list'
  ) {
    // Deleting the last query char steps back out of the prefix mode.
    e.preventDefault()
    modePrefix = ''
    void updateList()
  } else if (
    e.key === 'Backspace' &&
    paletteInput?.value === '' &&
    browseStack.length &&
    currentMode() === 'bookmarks' &&
    uiState === 'list'
  ) {
    e.preventDefault()
    popFolder()
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    moveSelection(1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (uiState === 'list' && favBarItems.length && selectedIndex === 0) setFavIndex(0)
    else moveSelection(-1)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const item = flatItems[selectedIndex]
    if (item) void executeItem(item, e.metaKey || e.ctrlKey)
  } else if (e.key === 'Tab') {
    e.preventDefault()
  } else if (paletteInput && document.activeElement !== paletteHost) {
    // Page stole focus — reclaim it so typing keeps landing in the palette.
    paletteInput.focus()
  }
}

function moveSelection(delta: number): void {
  if (!flatItems.length) return
  selectedIndex = (selectedIndex + delta + flatItems.length) % flatItems.length
  highlightSelection()
}

function highlightSelection(instant = false): void {
  if (!paletteList) return
  // Any list highlight takes focus back from the favorites bar.
  if (favIndex >= 0) {
    favIndex = -1
    paletteList
      .querySelectorAll<HTMLElement>('.fav-item')
      .forEach((el) => el.classList.remove('selected'))
  }
  const cells = paletteList.querySelectorAll<HTMLElement>('.emoji-cell')
  if (cells.length) {
    cells.forEach((cell, i) => cell.classList.toggle('selected', i === selectedIndex))
    // The first item scrolls to the very top so headers and labels show.
    if (selectedIndex === 0) paletteList.scrollTop = 0
    else cells[selectedIndex]?.scrollIntoView({ block: 'nearest' })
    return
  }
  const rows = paletteList.querySelectorAll<HTMLElement>('.item')
  rows.forEach((row, i) => row.classList.toggle('selected', i === selectedIndex))
  const row = rows[selectedIndex]
  if (row && selectorEl) {
    if (instant) selectorEl.style.transition = 'none'
    selectorEl.style.opacity = '1'
    selectorEl.style.transform = `translateY(${row.offsetTop}px)`
    selectorEl.style.height = `${row.offsetHeight}px`
    if (instant) {
      selectorEl.getBoundingClientRect()
      selectorEl.style.transition = ''
    }
  } else if (selectorEl) {
    selectorEl.style.opacity = '0'
  }
  // The first item scrolls to the very top so the header, favorites bar, and
  // group label above it stay visible; elsewhere, nearest-edge scrolling.
  if (selectedIndex === 0) paletteList.scrollTop = 0
  else row?.scrollIntoView({ block: 'nearest' })
}

/* ---------- Executing items ---------- */

function recordUsage(item: RemoteItem): void {
  const key =
    item.kind === 'bookmark'
      ? `bookmark:${item.url}`
      : item.kind === 'command'
        ? `command:${item.commandId}`
        : item.kind === 'folder'
          ? `folder:${item.id}`
          : item.kind === 'emoji'
            ? `emoji:${item.emoji}`
            : item.kind === 'snippet'
              ? `snippet:${item.label}`
              : null
  if (key) void chrome.runtime.sendMessage({ type: 'record-usage', key })
}

async function reorderItem(item: RemoteItem, delta: number): Promise<void> {
  if (!item.id || (item.kind !== 'bookmark' && item.kind !== 'folder')) return
  await chrome.runtime.sendMessage({ type: 'bookmark-reorder', id: item.id, delta })
  await updateList()
  const index = flatItems.findIndex((i) => i.id === item.id)
  if (index >= 0) {
    selectedIndex = index
    highlightSelection()
  }
}

function enterFolder(item: RemoteItem): void {
  if (!item.id || !paletteInput) return
  recordUsage(item)
  browseStack.push({ id: item.id, label: item.label })
  paletteInput.value = ''
  paletteInput.focus()
  void updateList()
}

function popFolder(): void {
  // The library section keeps its own folder stack.
  if (currentMode() === 'library') {
    libraryUp()
    return
  }
  browseStack.pop()
  if (paletteInput) paletteInput.value = ''
  void updateList()
}

async function executeItem(item: RemoteItem, altAction: boolean): Promise<void> {
  if (uiState === 'move') {
    await commitMove(item)
    return
  }
  if (uiState === 'group') {
    await commitGroup(item)
    return
  }
  if (item.kind === 'download') {
    void chrome.runtime.sendMessage({ type: 'download-open', downloadId: item.downloadId })
    closePalette()
    return
  }
  if (item.kind === 'folder') {
    // Library rows drill with the section's own stack (search hits jump).
    if (currentMode() === 'library' && uiState === 'list') {
      libraryEnterFolder(item)
      return
    }
    enterFolder(item)
    return
  }
  if (item.kind === 'calc') {
    copyText(item.text ?? item.label)
    closePalette()
    return
  }
  if (item.kind === 'emoji') {
    recordUsage(item)
    insertOrCopy(item.emoji ?? '')
    return
  }
  if (item.kind === 'snippet') {
    recordUsage(item)
    insertOrCopy(item.text ?? '')
    return
  }
  recordUsage(item)
  // Any command execution ticks the Getting Started box, whichever branch
  // handles it (special-cased commands never reached the generic runner).
  if (item.kind === 'command' && item.commandId && !item.commandId.startsWith('onboard:')) {
    void markOnboard('command')
  }
  if (item.kind === 'bookmark' || item.kind === 'history' || item.kind === 'search') {
    void chrome.runtime.sendMessage({ type: 'open-url', url: item.url, newTab: altAction })
  } else if (item.kind === 'tab') {
    void markOnboard('tab')
    void chrome.runtime.sendMessage({ type: 'activate-tab', tabId: item.tabId })
  } else if (item.kind === 'closed') {
    void chrome.runtime.sendMessage({ type: 'restore-session', sessionId: item.sessionId })
  } else if (item.commandId === 'pick-color') {
    closePalette()
    void pickColor()
    return
  } else if (item.commandId === 'copy-page-url') {
    copyText(location.href)
    closePalette()
    return
  } else if (item.commandId === 'copy-page-md') {
    copyText(`[${document.title || location.href}](${location.href})`)
    closePalette()
    return
  } else if (item.commandId === 'switch-to-tab') {
    setInput('@')
    return
  } else if (item.commandId === 'show-onboarding') {
    void reviveOnboarding().then(() => setInput(''))
    return
  } else if (item.commandId === 'page-links') {
    enterLinks()
    return
  } else if (item.commandId === 'confetti') {
    closePalette()
    launchConfetti()
    return
  } else if (item.commandId === 'dvd') {
    closePalette()
    launchDvd()
    return
  } else if (item.commandId === 'new-folder') {
    enterNewFolder()
    return
  } else if (item.commandId?.startsWith('onboard:')) {
    const key = item.commandId.slice('onboard:'.length)
    void markOnboard(key)
    if (key === 'hotkey') {
      void chrome.runtime.sendMessage({ type: 'run-command', id: 'open-shortcuts' })
      closePalette()
    } else if (key === 'command') setInput('>')
    else if (key === 'tab') setInput('@')
    else if (key === 'library') setInput('*')
    else if (key === 'save') openLibrarySave()
    else if (key === 'actions') {
      showToast('Select any row and press ⌘K')
      void updateList()
    } else if (key === 'favorite') {
      showToast('⌘K on any row → Add to Favorites')
      void updateList()
    }
    return
  } else if (item.commandId?.startsWith('mode-') || item.commandId === 'open-downloads') {
    const prefixes: Record<string, string> = {
      'mode-commands': '>',
      'mode-history': '#',
      'mode-emoji': ':',
      'mode-snippets': '%',
      'mode-library': '*',
      'open-downloads': '~',
    }
    setInput(prefixes[item.commandId] ?? '')
    return
  } else if (item.commandId === 'open-options') {
    enterSettings()
    return
  } else if (item.commandId === 'bookmark-tab') {
    // Save flow instead of a blind create: open the library section's panel.
    modePrefix = '*'
    if (paletteInput) paletteInput.value = ''
    updateModeStyling()
    renderFooter()
    openLibrarySave()
    return
  } else if (item.commandId === 'print-page') {
    closePalette()
    window.print()
    return
  } else {
    void chrome.runtime.sendMessage({ type: 'run-command', id: item.commandId })
  }
  closePalette()
}

/* ---------- Favorites bar ---------- */

/** Favorites currently rendered in the bar; empty when the bar is hidden. */
let favBarItems: FavoriteEntry[] = []
/** Index of the keyboard-selected favorite tile, or -1 when the list has focus. */
let favIndex = -1

/** The visual tile for a favorite — shared by the bar and the customize preview. */
function buildFavTile(f: FavoriteEntry): HTMLElement {
  const tile = document.createElement('div')
  tile.className = 'fav-tile'
  if (f.tileColor) {
    if (f.tileStyle === 'gradient') {
      const bg =
        TILE_GRADIENTS[f.tileColor] ??
        (TILE_COLORS[f.tileColor] ? tileGradient(TILE_COLORS[f.tileColor][0]) : undefined)
      if (bg) tile.style.background = bg
    } else if (TILE_COLORS[f.tileColor]) {
      tile.style.background = TILE_COLORS[f.tileColor][0]
    }
  }
  if (f.emojiIcon) {
    const glyph = document.createElement('span')
    glyph.className = 'fav-emoji'
    glyph.textContent = f.emojiIcon
    tile.appendChild(glyph)
    return tile
  }
  if (f.iconName && ALL_ICONS[f.iconName]) {
    tile.innerHTML = ALL_ICONS[f.iconName]
    return tile
  }
  if (f.textIcon) {
    const glyph = document.createElement('span')
    glyph.className = 'fav-text'
    glyph.textContent = f.textIcon
    tile.appendChild(glyph)
    return tile
  }
  if (f.kind === 'command') {
    // Mirror iconFor's special cases so command tiles always show something.
    if (f.icon === 'logo') {
      const img = document.createElement('img')
      img.className = 'logo-img'
      img.src = chrome.runtime.getURL('/icons/footer.png')
      img.draggable = false
      tile.appendChild(img)
    } else if (f.icon === 'ribbon' || f.icon === 'floppy') {
      tile.innerHTML = f.icon === 'ribbon' ? RIBBON_SVG : FLOPPY_SVG
    } else {
      if (!f.tileColor && f.color) tile.style.background = f.color
      tile.innerHTML = (f.icon && CMD_ICONS[f.icon]) || COMMAND_SVG
    }
  } else if (f.kind === 'folder') {
    tile.classList.add('kind-folder')
    tile.innerHTML = folderSvg(folderColorOf(f.id))
  } else if (f.url) {
    const img = document.createElement('img')
    img.src =
      chrome.runtime.getURL('/_favicon/') + `?pageUrl=${encodeURIComponent(f.url)}&size=32`
    img.onerror = () => {
      tile.innerHTML = BOOKMARK_SVG
    }
    tile.appendChild(img)
  }
  return tile
}

function favTileEl(f: FavoriteEntry, index: number): HTMLElement {
  const el = document.createElement('div')
  el.className = 'fav-item'
  el.title = f.label
  el.addEventListener('mousemove', () => {
    if (favIndex !== index) setFavIndex(index)
  })
  const tile = buildFavTile(f)
  const cap = document.createElement('span')
  cap.className = 'fav-cap'
  cap.textContent = f.label
  el.append(tile, cap)
  el.addEventListener('mousedown', (e) => {
    if (e.button === 2) return
    e.preventDefault()
    void executeItem(favToItem(f), e.metaKey || e.ctrlKey)
  })
  el.addEventListener('contextmenu', (e) => {
    e.preventDefault()
    setFavIndex(index)
    if (uiState === 'actions') closeActions()
    openActions({ x: e.clientX, y: e.clientY })
  })
  return el
}

/** Move keyboard focus into (index ≥ 0) or out of (-1) the favorites bar. */
function setFavIndex(index: number): void {
  favIndex = index
  const tiles = paletteList?.querySelectorAll<HTMLElement>('.fav-item')
  tiles?.forEach((el, i) => el.classList.toggle('selected', i === favIndex))
  if (favIndex >= 0) {
    if (selectorEl) selectorEl.style.opacity = '0'
    paletteList
      ?.querySelectorAll<HTMLElement>('.item')
      .forEach((row) => row.classList.remove('selected'))
    tiles?.[favIndex]?.scrollIntoView({ block: 'nearest' })
  } else {
    highlightSelection()
  }
}

/* ---------- Actions panel (⌘K) ---------- */

function actionsFor(item: RemoteItem): PaletteAction[] {
  switch (item.kind) {
    case 'bookmark':
      return [
        { id: 'open', label: 'Open' },
        { id: 'open-new-tab', label: 'Open in New Tab' },
        { id: 'copy-url', label: 'Copy URL' },
        { id: 'copy-md', label: 'Copy Markdown Link' },
        ...favoriteActionFor(item),
        { id: 'rename', label: 'Rename…' },
        { id: 'move', label: 'Move to Folder…' },
        ...(inFolderContext()
          ? [
              { id: 'move-up', label: 'Move Up' },
              { id: 'move-down', label: 'Move Down' },
            ]
          : []),
        { id: 'delete', label: 'Delete Bookmark', danger: true },
      ]
    case 'search':
      return [
        { id: 'open', label: 'Search' },
        { id: 'open-new-tab', label: 'Search in New Tab' },
      ]
    case 'history':
      return [
        { id: 'open', label: 'Open' },
        { id: 'open-new-tab', label: 'Open in New Tab' },
        { id: 'copy-url', label: 'Copy URL' },
        { id: 'copy-md', label: 'Copy Markdown Link' },
        ...favoriteActionFor(item),
        { id: 'delete-history', label: 'Remove from History', danger: true },
      ]
    case 'tab': {
      const actions: PaletteAction[] = [
        { id: 'switch', label: 'Switch to Tab' },
        { id: 'tile-beside', label: 'Split With Current Tab' },
        { id: 'add-to-group', label: 'Add to Group…' },
        { id: 'new-group', label: 'New Group from Tab' },
      ]
      if (item.grouped) {
        actions.push(
          { id: 'ungroup', label: 'Remove from Group' },
          { id: 'group-rename', label: 'Rename Group…' },
          { id: 'group-color', label: 'Group Color…' },
          { id: 'group-dissolve', label: 'Ungroup All' },
        )
      }
      actions.push(
        { id: 'copy-url', label: 'Copy URL' },
        { id: 'copy-md', label: 'Copy Markdown Link' },
        ...favoriteActionFor(item),
        { id: 'close-tab', label: 'Close Tab', danger: true },
      )
      return actions
    }
    case 'closed':
      return [
        { id: 'reopen', label: 'Reopen Tab' },
        { id: 'copy-url', label: 'Copy URL' },
        { id: 'copy-md', label: 'Copy Markdown Link' },
      ]
    case 'folder':
      return [
        { id: 'browse', label: 'Browse Folder' },
        { id: 'open-all', label: 'Open All in New Tabs' },
        ...favoriteActionFor(item),
        { id: 'folder-color', label: 'Set Color…' },
        { id: 'rename', label: 'Rename…' },
        ...(inFolderContext()
          ? [
              { id: 'move-up', label: 'Move Up' },
              { id: 'move-down', label: 'Move Down' },
            ]
          : []),
        { id: 'folder-delete', label: 'Delete Folder', danger: true },
      ]
    case 'download':
      return [
        { id: 'download-open', label: 'Open File' },
        { id: 'download-show', label: 'Show in Finder' },
        { id: 'copy-text', label: 'Copy Path' },
      ]
    case 'calc':
      return [{ id: 'copy-text', label: 'Copy Result' }]
    case 'emoji':
      return [
        { id: 'insert', label: 'Insert' },
        { id: 'copy-text', label: 'Copy Emoji' },
      ]
    case 'snippet':
      return [
        { id: 'insert', label: 'Insert' },
        { id: 'copy-text', label: 'Copy Snippet' },
      ]
    default:
      if (item.commandId?.startsWith('onboard:')) {
        return [
          { id: 'run', label: 'Do It' },
          { id: 'onboard-hide', label: 'Hide Getting Started' },
        ]
      }
      return [{ id: 'run', label: 'Run Command' }, ...favoriteActionFor(item)]
  }
}

const STAR_SLASH_SVG =
  '<svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M8 2l1.8 3.7 4 .6-2.9 2.8.7 4L8 11.2 4.4 13l.7-4-2.9-2.7 4-.6z" stroke="currentColor" stroke-linejoin="round"/><path d="M2.5 14L13.5 2" stroke="currentColor" stroke-linecap="round"/></svg>'
const STAR_SVG =
  '<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1.8l1.9 3.9 4.3.6-3.1 3 .7 4.2L8 11.5l-3.8 2 .7-4.2-3.1-3 4.3-.6z"/></svg>'
const PENCIL_SVG =
  '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 13l.8-3L11 2.8l2.2 2.2L6 12.2 3 13z" stroke="currentColor" stroke-linejoin="round"/></svg>'
const FOLDER_OUTLINE_SVG =
  '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M1.5 3.5h4.5l1.5 2h7v7h-13v-9z" stroke="currentColor" stroke-linejoin="round"/></svg>'
const ARROW_UP_SVG =
  '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 13V3M3.5 7L8 2.5 12.5 7" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/></svg>'
const ARROW_DOWN_SVG =
  '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3.5 9L8 13.5 12.5 9" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/></svg>'

/** Per-action icons for the ⌘K menu, mirroring the brand menu's style. */
const ACTION_ICONS: Record<string, string> = {
  open: CMD_ICONS.external,
  'open-new-tab': CMD_ICONS.tab,
  switch: CMD_ICONS.switch,
  reopen: CMD_ICONS.reset,
  browse: FOLDER_OUTLINE_SVG,
  'open-all': CMD_ICONS.tab,
  'copy-url': CMD_ICONS.link,
  'copy-md': CMD_ICONS.link,
  'copy-text': CMD_ICONS.doc,
  'favorite-add': STAR_SVG,
  'favorite-remove': STAR_SLASH_SVG,
  rename: PENCIL_SVG,
  move: FOLDER_OUTLINE_SVG,
  'move-up': ARROW_UP_SVG,
  'move-down': ARROW_DOWN_SVG,
  'folder-color': CMD_ICONS.paint,
  'onboard-hide': CMD_ICONS.reset,
  'fav-custom': CMD_ICONS.paint,
  'group-rename': PENCIL_SVG,
  'group-color': CMD_ICONS.paint,
  'group-dissolve': CMD_ICONS.group,
  'tile-beside': CMD_ICONS.split,
  'add-to-group': CMD_ICONS.group,
  'new-group': CMD_ICONS.group,
  ungroup: CMD_ICONS.group,
  insert: CMD_ICONS.form,
  run: COMMAND_SVG,
  delete: CMD_ICONS.trash,
  'folder-delete': CMD_ICONS.trash,
  'delete-history': CMD_ICONS.trash,
  'close-tab': CMD_ICONS.tab,
  'download-open': CMD_ICONS.download,
  'download-show': FOLDER_OUTLINE_SVG,
}

let favMenuContext = false

function openActions(at?: { x: number; y: number }): void {
  // ⌘K acts on the focused favorite tile when the bar has keyboard focus.
  const item =
    favIndex >= 0 && favBarItems[favIndex]
      ? favToItem(favBarItems[favIndex])
      : flatItems[selectedIndex]
  if (!item || !panelEl) return
  closeBrandMenu()
  void markOnboard('actions')
  pendingMenuAt = at ?? null
  favMenuContext = favIndex >= 0
  actionTarget = item
  currentActions = favMenuContext
    ? [...actionsFor(item), { id: 'fav-custom', label: 'Customize Favorite…' }]
    : actionsFor(item)
  // Destructive actions always sit at the bottom, whatever the source list.
  currentActions = [
    ...currentActions.filter((a) => !a.danger),
    ...currentActions.filter((a) => a.danger),
  ]
  actionIndex = 0
  uiState = 'actions'

  actionsEl = document.createElement('div')
  actionsEl.className = 'actions'
  currentActions.forEach((action, index) => {
    const row = document.createElement('div')
    row.className = 'action-row' + (action.danger ? ' danger' : '')
    const glyph = document.createElement('span')
    glyph.className = 'menu-icon'
    glyph.innerHTML = ACTION_ICONS[action.id] ?? COMMAND_SVG
    const label = document.createElement('span')
    label.textContent = action.label
    const spacer = document.createElement('span')
    spacer.className = 'spacer'
    row.append(glyph, label, spacer)
    if (index < 9) row.appendChild(kbd(String(index + 1)))
    row.addEventListener('mousedown', (e) => {
      e.preventDefault()
      void runAction(action, item)
    })
    row.addEventListener('mousemove', () => {
      if (actionIndex !== index) {
        actionIndex = index
        highlightActions()
      }
    })
    actionsEl!.appendChild(row)
  })
  panelEl.appendChild(actionsEl)
  placeActionsAtCursor()
  highlightActions()
  renderFooter()
}

/** Right-click anchor: position the menu at the pointer, clamped to the panel. */
let pendingMenuAt: { x: number; y: number } | null = null
function placeActionsAtCursor(): void {
  if (!pendingMenuAt || !actionsEl || !panelEl) {
    pendingMenuAt = null
    return
  }
  const rect = panelEl.getBoundingClientRect()
  const menuW = actionsEl.offsetWidth
  const menuH = actionsEl.offsetHeight
  const left = Math.max(8, Math.min(pendingMenuAt.x - rect.left, rect.width - menuW - 8))
  const top = Math.max(8, Math.min(pendingMenuAt.y - rect.top, rect.height - menuH - 8))
  actionsEl.style.left = `${left}px`
  actionsEl.style.top = `${top}px`
  actionsEl.style.right = 'auto'
  actionsEl.style.bottom = 'auto'
  pendingMenuAt = null
}

function closeActions(): void {
  actionsEl?.remove()
  actionsEl = null
  actionTarget = null
  uiState = 'list'
  renderFooter()
}

function highlightActions(): void {
  if (!actionsEl) return
  actionsEl
    .querySelectorAll<HTMLElement>('.action-row')
    .forEach((row, i) => row.classList.toggle('selected', i === actionIndex))
}

/** Swatch submenu for a folder's color, reusing the actions-panel machinery. */
function openColorPicker(item: RemoteItem): void {
  if (!panelEl) return
  actionTarget = item
  const current = folderColorOf(item.id)
  currentActions = [
    { id: 'folder-color:none', label: 'Blue (default)' },
    ...Object.keys(FOLDER_COLORS)
      .filter((name) => name !== 'blue')
      .map((name) => ({ id: `folder-color:${name}`, label: name[0].toUpperCase() + name.slice(1) })),
  ]
  actionIndex = Math.max(0, currentActions.findIndex((a) => a.id === `folder-color:${current}`))
  uiState = 'actions'
  actionsEl?.remove()
  actionsEl = document.createElement('div')
  actionsEl.className = 'actions'
  currentActions.forEach((action, index) => {
    const row = document.createElement('div')
    row.className = 'action-row'
    const name = action.id.slice('folder-color:'.length)
    const pair = FOLDER_COLORS[name] ?? FOLDER_COLORS.blue
    const dot = document.createElement('span')
    dot.className = 'menu-icon'
    dot.innerHTML = `<svg width="12" height="12" viewBox="0 0 12 12"><circle cx="6" cy="6" r="5" fill="${pair[0]}"/></svg>`
    const label = document.createElement('span')
    label.textContent = action.label
    const spacer = document.createElement('span')
    spacer.className = 'spacer'
    row.append(dot, label, spacer)
    if (index < 9) row.appendChild(kbd(String(index + 1)))
    row.addEventListener('mousedown', (e) => {
      e.preventDefault()
      void runAction(action, item)
    })
    row.addEventListener('mousemove', () => {
      if (actionIndex !== index) {
        actionIndex = index
        highlightActions()
      }
    })
    actionsEl!.appendChild(row)
  })
  panelEl.appendChild(actionsEl)
  highlightActions()
  renderFooter()
}

/** Swatch submenu for a tab group's color (Chrome's nine group colors). */
function openTabGroupColorPicker(item: RemoteItem): void {
  if (!panelEl) return
  actionTarget = item
  currentActions = Object.keys(GROUP_COLORS).map((name) => ({
    id: `tab-group-color:${name}`,
    label: name[0].toUpperCase() + name.slice(1),
  }))
  actionIndex = 0
  uiState = 'actions'
  actionsEl?.remove()
  actionsEl = document.createElement('div')
  actionsEl.className = 'actions'
  currentActions.forEach((action, index) => {
    const row = document.createElement('div')
    row.className = 'action-row'
    const name = action.id.slice('tab-group-color:'.length)
    const dot = document.createElement('span')
    dot.className = 'menu-icon'
    dot.innerHTML = `<svg width="12" height="12" viewBox="0 0 12 12"><circle cx="6" cy="6" r="5" fill="${GROUP_COLORS[name]}"/></svg>`
    const label = document.createElement('span')
    label.textContent = action.label
    const spacer = document.createElement('span')
    spacer.className = 'spacer'
    row.append(dot, label, spacer)
    if (index < 9) row.appendChild(kbd(String(index + 1)))
    row.addEventListener('mousedown', (e) => {
      e.preventDefault()
      void runAction(action, item)
    })
    row.addEventListener('mousemove', () => {
      if (actionIndex !== index) {
        actionIndex = index
        highlightActions()
      }
    })
    actionsEl!.appendChild(row)
  })
  panelEl.appendChild(actionsEl)
  highlightActions()
  renderFooter()
}

async function runAction(action: PaletteAction, item: RemoteItem): Promise<void> {
  if (action.id.startsWith('tab-group-color:')) {
    const color = action.id.slice('tab-group-color:'.length)
    if (item.groupId !== undefined) {
      await chrome.runtime.sendMessage({ type: 'tab-group-update', groupId: item.groupId, color })
    }
    closeActions()
    void updateList()
    return
  }
  if (action.id.startsWith('folder-color:')) {
    const name = action.id.slice('folder-color:'.length)
    if (item.id) await setFolderColor(item.id, name === 'none' ? null : name)
    closeActions()
    void updateList()
    return
  }
  switch (action.id) {
    case 'open':
    case 'open-new-tab':
      recordUsage(item)
      await chrome.runtime.sendMessage({
        type: 'open-url',
        url: item.url,
        newTab: action.id === 'open-new-tab',
      })
      closePalette()
      return
    case 'copy-url':
      copyText(item.url ?? '')
      closePalette()
      return
    case 'copy-md':
      copyText(`[${item.label}](${item.url ?? ''})`)
      closePalette()
      return
    case 'switch':
      await chrome.runtime.sendMessage({ type: 'activate-tab', tabId: item.tabId })
      closePalette()
      return
    case 'tile-beside': {
      const resp = (await chrome.runtime.sendMessage({ type: 'tile-tab', tabId: item.tabId })) as
        | { native?: boolean }
        | undefined
      closePalette()
      if (!resp?.native) showToast('Split view needs the SuperChrome companion (macOS)')
      return
    }
    case 'reopen':
      await chrome.runtime.sendMessage({ type: 'restore-session', sessionId: item.sessionId })
      closePalette()
      return
    case 'browse':
      closeActions()
      enterFolder(item)
      return
    case 'open-all':
      await chrome.runtime.sendMessage({ type: 'open-folder-tabs', id: item.id })
      closePalette()
      return
    case 'folder-delete':
      await chrome.runtime.sendMessage({ type: 'folder-delete', id: item.id })
      break
    case 'download-open':
      await chrome.runtime.sendMessage({ type: 'download-open', downloadId: item.downloadId })
      closePalette()
      return
    case 'download-show':
      await chrome.runtime.sendMessage({ type: 'download-show', downloadId: item.downloadId })
      closePalette()
      return
    case 'add-to-group':
      closeActions()
      await enterGroup(item)
      return
    case 'new-group':
      await chrome.runtime.sendMessage({ type: 'tab-group-add', tabId: item.tabId })
      break
    case 'ungroup':
      await chrome.runtime.sendMessage({ type: 'tab-ungroup', tabId: item.tabId })
      break
    case 'move-up':
    case 'move-down':
      closeActions()
      await reorderItem(item, action.id === 'move-up' ? -1 : 1)
      return
    case 'insert':
      closeActions()
      if (item.kind === 'emoji') recordUsage(item)
      insertOrCopy(item.kind === 'emoji' ? (item.emoji ?? '') : (item.text ?? ''))
      return
    case 'copy-text':
      copyText(item.kind === 'emoji' ? (item.emoji ?? '') : (item.text ?? item.label))
      closePalette()
      return
    case 'run':
      closeActions()
      await executeItem(item, false)
      return
    case 'rename':
      closeActions()
      enterRename(item)
      return
    case 'move':
      closeActions()
      await enterMove(item)
      return
    case 'delete':
      await chrome.runtime.sendMessage({ type: 'bookmark-delete', id: item.id })
      break
    case 'delete-history':
      await chrome.runtime.sendMessage({ type: 'history-delete', url: item.url })
      break
    case 'close-tab':
      await chrome.runtime.sendMessage({ type: 'close-tab-id', tabId: item.tabId })
      break
    case 'folder-color':
      closeActions()
      openColorPicker(item)
      return
    case 'onboard-hide':
      await dismissOnboarding()
      break
    case 'fav-custom':
      closeActions()
      enterFavCustomize(item)
      return
    case 'group-rename':
      closeActions()
      enterGroupRename(item)
      return
    case 'group-color':
      closeActions()
      openTabGroupColorPicker(item)
      return
    case 'group-dissolve':
      if (item.groupId !== undefined) {
        await chrome.runtime.sendMessage({ type: 'tab-group-dissolve', groupId: item.groupId })
      }
      break
    case 'favorite-add':
    case 'favorite-remove': {
      if (action.id === 'favorite-add') void markOnboard('favorite')
      const toast = await toggleFavorite(item)
      if (toast) showToast(toast)
      break
    }
  }
  closeActions()
  void updateList()
}

function copyText(text: string): void {
  void writeClipboard(text).then(() => showToast('Copied to clipboard'))
}

async function pickColor(): Promise<void> {
  const EyeDropperCtor = (
    window as unknown as { EyeDropper?: new () => { open(): Promise<{ sRGBHex: string }> } }
  ).EyeDropper
  if (!EyeDropperCtor) {
    showToast('Color picker not supported here')
    return
  }
  let hex: string
  try {
    const result = await new EyeDropperCtor().open()
    hex = result.sRGBHex.toUpperCase()
  } catch {
    // User pressed Esc — nothing to do.
    return
  }
  await writeClipboard(hex)
  showToast(`${hex} copied`, hex)
}

async function writeClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const area = document.createElement('textarea')
    area.value = text
    document.body.appendChild(area)
    area.select()
    document.execCommand('copy')
    area.remove()
  }
}

/** Transient confirmation pill, bottom-center, outliving the palette. */
function showToast(message: string, swatch?: string): void {
  const host = document.createElement('div')
  host.style.cssText =
    'position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:2147483647;'
  const shadow = host.attachShadow({ mode: 'closed' })
  const style = document.createElement('style')
  style.textContent = `
    .toast {
      display: flex; align-items: center; gap: 8px;
      background: rgba(30, 30, 32, 0.92);
      backdrop-filter: blur(20px) saturate(1.6);
      -webkit-backdrop-filter: blur(20px) saturate(1.6);
      border: 1px solid rgba(255, 255, 255, 0.16);
      border-radius: 10px;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 8px 24px #00000088;
      color: #e8e8e8;
      font: 13px -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      padding: 9px 16px;
      opacity: 0;
      transition: opacity 0.15s ease;
    }
    .toast.light {
      background: rgba(248, 248, 250, 0.95);
      border-color: rgba(0, 0, 0, 0.14);
      color: #26262b;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7), 0 8px 24px rgba(0, 0, 0, 0.25);
    }
    .toast.show { opacity: 1; }
    @media (prefers-reduced-motion: reduce) { .toast { transition: none; } }
  `
  const pill = document.createElement('div')
  pill.className = 'toast' + (lightMode ? ' light' : '')
  if (swatch) {
    const chip = document.createElement('span')
    chip.style.cssText = `width:14px;height:14px;border-radius:4px;border:1px solid #ffffff33;background:${swatch};`
    pill.appendChild(chip)
  } else {
    pill.innerHTML =
      '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 8.5l3.2 3.2L13 5" stroke="#7bc97b" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  }
  pill.appendChild(document.createTextNode(message))
  shadow.append(style, pill)
  document.documentElement.appendChild(host)
  requestAnimationFrame(() => pill.classList.add('show'))
  setTimeout(() => {
    pill.classList.remove('show')
    setTimeout(() => host.remove(), 200)
  }, 1800)
}

/* ---------- Rename / move sub-states ---------- */

function enterRename(item: RemoteItem): void {
  if (!paletteInput || !paletteList) return
  uiState = 'rename'
  subStateTarget = item
  savedQuery = paletteInput.value
  paletteInput.value = item.label
  paletteInput.placeholder = 'New name…'
  paletteInput.focus()
  paletteInput.select()
  paletteList.textContent = ''
  flatItems = []
  const hint = document.createElement('div')
  hint.className = 'empty'
  hint.textContent = `Renaming "${item.label}" — ↵ to save, esc to cancel`
  paletteList.appendChild(hint)
  renderFooter()
}

async function commitRename(): Promise<void> {
  const title = paletteInput?.value.trim()
  if (creatingFolder) {
    if (title) {
      await chrome.runtime.sendMessage({
        type: 'folder-create',
        title,
        parentId: newFolderParentId,
      })
      showToast(`Folder "${title}" created`)
    }
    exitSubState(true)
    return
  }
  if (subStateTarget && title) {
    if (subStateTarget.kind === 'tab' && subStateTarget.groupId !== undefined) {
      await chrome.runtime.sendMessage({
        type: 'tab-group-update',
        groupId: subStateTarget.groupId,
        title,
      })
    } else if (subStateTarget.id) {
      await chrome.runtime.sendMessage({ type: 'bookmark-rename', id: subStateTarget.id, title })
    }
  }
  exitSubState(true)
}

/** Rename the selected tab's group (same sub-state as bookmark rename). */
function enterGroupRename(item: RemoteItem): void {
  if (!paletteInput || !paletteList) return
  uiState = 'rename'
  subStateTarget = item
  savedQuery = paletteInput.value
  paletteInput.value = item.groupTitle ?? ''
  paletteInput.placeholder = 'New group name…'
  paletteInput.focus()
  paletteInput.select()
  paletteList.textContent = ''
  flatItems = []
  const hint = document.createElement('div')
  hint.className = 'empty'
  hint.textContent = `Renaming group "${item.groupTitle || 'Untitled'}" — ↵ to save, esc to cancel`
  paletteList.appendChild(hint)
  renderFooter()
}

async function enterMove(item: RemoteItem): Promise<void> {
  if (!paletteInput) return
  uiState = 'move'
  subStateTarget = item
  savedQuery = paletteInput.value
  paletteInput.value = ''
  paletteInput.placeholder = `Move "${item.label}" to folder…`
  paletteInput.focus()
  if (!foldersCache) {
    const response = (await chrome.runtime.sendMessage({ type: 'folders' })) as {
      folders?: FolderInfo[]
    }
    foldersCache = response?.folders ?? []
  }
  void updateList()
}

async function commitMove(folderItem: RemoteItem): Promise<void> {
  if (subStateTarget?.id && folderItem.id) {
    await chrome.runtime.sendMessage({
      type: 'bookmark-move',
      id: subStateTarget.id,
      parentId: folderItem.id,
    })
  }
  exitSubState(true)
}

let groupsCache: Array<{ id: number; title: string; color?: string }> | null = null

async function enterGroup(item: RemoteItem): Promise<void> {
  if (!paletteInput) return
  uiState = 'group'
  subStateTarget = item
  savedQuery = paletteInput.value
  paletteInput.value = ''
  paletteInput.placeholder = `Add "${item.label}" to group…`
  paletteInput.focus()
  const response = (await chrome.runtime.sendMessage({ type: 'tab-groups' })) as {
    groups?: Array<{ id: number; title: string; color?: string }>
  }
  groupsCache = response?.groups ?? []
  void updateList()
}

async function commitGroup(groupItem: RemoteItem): Promise<void> {
  if (subStateTarget?.tabId !== undefined) {
    await chrome.runtime.sendMessage({
      type: 'tab-group-add',
      tabId: subStateTarget.tabId,
      groupId: groupItem.downloadId,
    })
  }
  exitSubState(true)
}

function exitSubState(_commit: boolean): void {
  creatingFolder = false
  if (uiState === 'actions') closeActions()
  if (!paletteInput) return
  uiState = 'list'
  subStateTarget = null
  paletteInput.value = savedQuery
  paletteInput.placeholder = 'Search bookmarks and commands…'
  paletteInput.focus()
  void updateList()
}

/* ---------- Brand menu (bottom-left logo) ---------- */

function closeBrandMenu(): void {
  brandMenuEl?.remove()
  brandMenuEl = null
}

function toggleBrandMenu(): void {
  if (brandMenuEl) {
    closeBrandMenu()
    return
  }
  if (!panelEl) return
  brandMenuEl = document.createElement('div')
  brandMenuEl.className = 'brand-menu'

  const menuRow = (icon: string, label: string, run: () => void): void => {
    const row = document.createElement('div')
    row.className = 'action-row'
    const glyph = document.createElement('span')
    glyph.className = 'menu-icon'
    glyph.innerHTML = icon
    const text = document.createElement('span')
    text.textContent = label
    row.append(glyph, text)
    row.addEventListener('mousedown', (e) => {
      e.preventDefault()
      closeBrandMenu()
      run()
    })
    brandMenuEl!.appendChild(row)
  }

  const FEEDBACK_SVG =
    '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2 3.5h12v8H8l-3.5 3v-3H2v-8z" stroke="currentColor" stroke-linejoin="round"/></svg>'

  menuRow(CMD_ICONS.gear, 'Settings', () => enterSettings())
  menuRow(FEEDBACK_SVG, 'Send Feedback', () => {
    void chrome.runtime.sendMessage({
      type: 'open-url',
      url: 'https://github.com/dylan-chalkboard/SuperChrome/issues/new',
      newTab: true,
    })
    closePalette()
  })
  menuRow(CMD_ICONS.keyboard, 'Keyboard Shortcuts', () => {
    void chrome.runtime.sendMessage({ type: 'run-command', id: 'open-shortcuts' })
    closePalette()
  })

  const version = document.createElement('div')
  version.className = 'menu-version'
  version.textContent = `SuperChrome v${chrome.runtime.getManifest().version}`
  brandMenuEl.appendChild(version)

  panelEl.appendChild(brandMenuEl)
}

/* ---------- Confetti (>Confetti) — because Raycast knows joy matters ---------- */

function launchConfetti(): void {
  if (reducedMotion()) {
    showToast('🎉')
    return
  }
  const canvas = document.createElement('canvas')
  canvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647;'
  canvas.width = window.innerWidth * devicePixelRatio
  canvas.height = window.innerHeight * devicePixelRatio
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.scale(devicePixelRatio, devicePixelRatio)
  document.documentElement.appendChild(canvas)

  const colors = ['#4c9df3', '#e0619e', '#9a6ee8', '#4caf7d', '#e8964a', '#e8c341', '#3aa99f', '#e05d5d']
  interface Piece {
    x: number; y: number; vx: number; vy: number
    w: number; h: number; rot: number; rotV: number
    wobble: number; wobbleV: number
    color: string; life: number; ttl: number
  }
  const pieces: Piece[] = []
  const cannon = (originX: number, angleDeg: number): void => {
    for (let i = 0; i < 90; i++) {
      const angle = ((angleDeg + (Math.random() - 0.5) * 55) * Math.PI) / 180
      const velocity = 11 + Math.random() * 9
      pieces.push({
        x: originX,
        y: window.innerHeight * 0.92,
        vx: Math.cos(angle) * velocity,
        vy: -Math.sin(angle) * velocity,
        w: 7 + Math.random() * 4,
        h: 4 + Math.random() * 3,
        rot: Math.random() * Math.PI,
        rotV: (Math.random() - 0.5) * 0.3,
        wobble: Math.random() * Math.PI * 2,
        wobbleV: 0.15 + Math.random() * 0.2,
        color: colors[i % colors.length],
        life: 0,
        ttl: 140 + Math.random() * 60,
      })
    }
  }
  cannon(window.innerWidth * 0.15, 65)
  cannon(window.innerWidth * 0.85, 115)

  const tick = (): void => {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
    let alive = 0
    for (const p of pieces) {
      p.life++
      if (p.life > p.ttl) continue
      p.vy += 0.26
      p.vx *= 0.992
      p.vy *= 0.992
      p.x += p.vx + Math.cos(p.wobble) * 0.8
      p.y += p.vy
      p.rot += p.rotV
      p.wobble += p.wobbleV
      const fade = 1 - Math.max(0, (p.life / p.ttl - 0.7) / 0.3)
      if (p.y > window.innerHeight + 20 || fade <= 0) continue
      alive++
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rot)
      // scaleY oscillation reads as a 3D tumble.
      ctx.scale(1, 0.35 + Math.abs(Math.sin(p.wobble)) * 0.65)
      ctx.globalAlpha = fade
      ctx.fillStyle = p.color
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
      ctx.restore()
    }
    if (alive > 0) requestAnimationFrame(tick)
    else canvas.remove()
  }
  requestAnimationFrame(tick)
}

/* ---------- DVD screensaver (>DVD) ---------- */

function launchDvd(): void {
  if (reducedMotion()) {
    showToast('📀')
    return
  }
  const colors = ['#4c9df3', '#e0619e', '#9a6ee8', '#4caf7d', '#e8964a', '#e8c341', '#3aa99f', '#e05d5d']
  const host = document.createElement('div')
  host.style.cssText =
    'position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,0.78);cursor:default;'
  const logo = document.createElement('div')
  logo.style.cssText = 'position:absolute;width:110px;height:46px;will-change:transform;'
  logo.innerHTML =
    '<svg width="110" height="46" viewBox="0 0 110 46">' +
    '<text x="55" y="27" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="27" font-style="italic" font-weight="900" fill="currentColor">DVD</text>' +
    '<ellipse cx="55" cy="37" rx="34" ry="5.5" fill="currentColor"/>' +
    '<ellipse cx="55" cy="37" rx="10" ry="2" fill="rgba(0,0,0,0.85)"/>' +
    '</svg>'
  host.appendChild(logo)
  document.documentElement.appendChild(host)

  let colorIndex = Math.floor(Math.random() * colors.length)
  logo.style.color = colors[colorIndex]
  const W = 110
  const H = 46
  let x = Math.random() * (window.innerWidth - W)
  let y = Math.random() * (window.innerHeight - H)
  let vx = 2.4 * (Math.random() < 0.5 ? 1 : -1)
  let vy = 2.1 * (Math.random() < 0.5 ? 1 : -1)
  let raf = 0

  const nextColor = (): void => {
    colorIndex = (colorIndex + 1 + Math.floor(Math.random() * (colors.length - 1))) % colors.length
    logo.style.color = colors[colorIndex]
  }
  const stop = (): void => {
    cancelAnimationFrame(raf)
    window.removeEventListener('keydown', stop, true)
    host.remove()
  }
  const tick = (): void => {
    x += vx
    y += vy
    let hitX = false
    let hitY = false
    if (x <= 0 || x >= window.innerWidth - W) {
      vx = -vx
      x = Math.max(0, Math.min(x, window.innerWidth - W))
      hitX = true
    }
    if (y <= 0 || y >= window.innerHeight - H) {
      vy = -vy
      y = Math.max(0, Math.min(y, window.innerHeight - H))
      hitY = true
    }
    if (hitX || hitY) nextColor()
    if (hitX && hitY) launchConfetti() // The corner. It finally happened.
    logo.style.transform = `translate3d(${x}px, ${y}px, 0)`
    raf = requestAnimationFrame(tick)
  }
  window.addEventListener('keydown', stop, true)
  host.addEventListener('mousedown', stop)
  raf = requestAnimationFrame(tick)
}

/* ---------- Page links (>Grab Page Links) ---------- */

function enterLinks(): void {
  if (!paletteInput || !paletteList) return
  const seen = new Set<string>()
  pageLinks = []
  document.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((a) => {
    const href = a.href
    if (!/^https?:/i.test(href) || seen.has(href)) return
    seen.add(href)
    const label =
      (a.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80) || a.title || href
    pageLinks.push({
      kind: 'search',
      label,
      detail: '',
      url: href,
      icon: 'link',
      color: tileGradient('#4caf7d'),
    })
  })
  uiState = 'links'
  savedQuery = paletteInput.value
  paletteInput.value = ''
  paletteInput.placeholder = `Filter ${pageLinks.length} links…`
  paletteInput.focus()
  void updateList()
}

/** Create a bookmark folder — inside the current library folder, else Other Bookmarks. */
function enterNewFolder(): void {
  if (!paletteInput || !paletteList) return
  creatingFolder = true
  newFolderParentId = currentMode() === 'library' ? libraryCurrentFolderId() : undefined
  uiState = 'rename'
  subStateTarget = null
  savedQuery = paletteInput.value
  paletteInput.value = ''
  paletteInput.placeholder = 'New folder name…'
  paletteInput.focus()
  paletteList.textContent = ''
  flatItems = []
  const hint = document.createElement('div')
  hint.className = 'empty'
  hint.textContent = `New folder ${newFolderParentId ? 'in this folder' : 'in Other Bookmarks'} — ↵ to create, esc to cancel`
  paletteList.appendChild(hint)
  renderFooter()
}

/* ---------- Customize Favorite (right-click/⌘K on a tile) ---------- */

function enterFavCustomize(item: RemoteItem): void {
  const key = favoriteKeyOf(item)
  if (!key || !paletteInput || !paletteList) return
  favCustomKey = key
  favGlyphTab = null
  uiState = 'fav-custom'
  savedQuery = modePrefix + paletteInput.value
  if (inputRowEl) inputRowEl.style.display = 'none'
  void renderFavCustomize()
  renderFooter()
}

function exitFavCustomize(): void {
  if (!paletteInput) return
  favCustomKey = null
  uiState = 'list'
  if (inputRowEl) inputRowEl.style.display = ''
  modePrefix = savedQuery && PREFIX_CHARS.includes(savedQuery[0]) ? savedQuery[0] : ''
  paletteInput.value = modePrefix ? savedQuery.slice(1) : savedQuery
  paletteInput.focus()
  void updateList()
}

async function renderFavCustomize(): Promise<void> {
  if (!paletteList || !favCustomKey) return
  const favorites = await loadFavorites()
  const fav = favorites.find((x) => favKey(x) === favCustomKey)
  if (!fav) {
    exitFavCustomize()
    return
  }
  paletteList.textContent = ''
  selectorEl = null
  flatItems = []
  favBarItems = []
  favIndex = -1

  const form = document.createElement('div')
  form.className = 'settings'

  const preview = document.createElement('div')
  preview.className = 'fav-preview'
  const pv = document.createElement('div')
  pv.className = 'fav-item'
  pv.appendChild(buildFavTile(fav))
  const cap = document.createElement('span')
  cap.className = 'fav-cap'
  cap.textContent = fav.label
  pv.appendChild(cap)
  preview.appendChild(pv)
  form.appendChild(preview)

  const save = async (patch: Partial<FavoriteEntry>): Promise<void> => {
    await updateFavorite(favCustomKey!, patch)
    await loadFavorites()
    void renderFavCustomize()
  }

  const row = (label: string, control: HTMLElement, top = false): void => {
    const el = document.createElement('div')
    el.className = 'set-row' + (top ? ' top' : '')
    const lab = document.createElement('label')
    lab.textContent = label
    el.append(lab, control)
    form.appendChild(el)
  }

  const strip = (style: 'flat' | 'gradient', withDefault: boolean): HTMLElement => {
    const wrap = document.createElement('div')
    wrap.className = 'swatch-strip'
    if (withDefault) {
      const dot = document.createElement('span')
      dot.className = 'swatch-dot none' + (!fav.tileColor ? ' on' : '')
      dot.title = 'Default'
      dot.addEventListener('mousedown', (e) => {
        e.preventDefault()
        void save({ tileColor: undefined, tileStyle: undefined })
      })
      wrap.appendChild(dot)
    }
    const addDot = (name: string, background: string): void => {
      const dot = document.createElement('span')
      dot.className = 'swatch-dot'
      dot.style.background = background
      dot.title = name
      const on = fav.tileColor === name && (fav.tileStyle ?? 'flat') === style
      dot.classList.toggle('on', on)
      dot.addEventListener('mousedown', (e) => {
        e.preventDefault()
        void save({ tileColor: name, tileStyle: style })
      })
      wrap.appendChild(dot)
    }
    for (const [name, pair] of Object.entries(TILE_COLORS)) {
      addDot(name, style === 'gradient' ? tileGradient(pair[0]) : pair[0])
    }
    if (style === 'gradient') {
      for (const [name, css] of Object.entries(TILE_GRADIENTS)) addDot(name, css)
    }
    return wrap
  }
  row('Color', strip('flat', true), true)
  row('Gradient', strip('gradient', false), true)

  // Glyph: Default (favicon/command icon) / library icon / text monogram.
  const tab: 'default' | 'icon' | 'emoji' | 'text' =
    favGlyphTab ??
    (fav.iconName ? 'icon' : fav.emojiIcon ? 'emoji' : fav.textIcon ? 'text' : 'default')
  const seg = document.createElement('div')
  seg.className = 'seg'
  for (const value of ['default', 'icon', 'emoji', 'text'] as const) {
    const b = document.createElement('button')
    b.textContent =
      value === 'default' ? 'Default' : value === 'icon' ? 'Icon' : value === 'emoji' ? 'Emoji' : 'Text'
    b.classList.toggle('on', tab === value)
    b.addEventListener('mousedown', (e) => {
      e.preventDefault()
      favGlyphTab = value
      if (value === 'default') {
        void save({ iconName: undefined, textIcon: undefined, emojiIcon: undefined })
      } else {
        void renderFavCustomize()
      }
    })
    seg.appendChild(b)
  }
  row('Icon', seg)

  if (tab === 'icon') {
    const grid = document.createElement('div')
    grid.className = 'icon-grid'
    for (const [name, svg] of Object.entries(ALL_ICONS)) {
      const cell = document.createElement('span')
      cell.className = 'icon-cell' + (fav.iconName === name ? ' on' : '')
      cell.title = name
      cell.innerHTML = svg
      cell.addEventListener('mousedown', (e) => {
        e.preventDefault()
        void save({ iconName: name, textIcon: undefined, emojiIcon: undefined })
      })
      grid.appendChild(cell)
    }
    row('', grid, true)
  } else if (tab === 'emoji' || tab === 'text') {
    const input = document.createElement('input')
    input.className = 'lib-input'
    input.maxLength = tab === 'emoji' ? 4 : 3
    input.placeholder = tab === 'emoji' ? 'Type an emoji…' : 'Up to 3 characters…'
    input.value = (tab === 'emoji' ? fav.emojiIcon : fav.textIcon) ?? ''
    input.addEventListener('input', () => {
      // Immediate save + live preview (no re-render, keeps typing focus) —
      // Enter can then close the panel with nothing left pending.
      const value = input.value.trim()
      const patch: Partial<FavoriteEntry> =
        tab === 'emoji'
          ? { emojiIcon: value || undefined, iconName: undefined, textIcon: undefined }
          : { textIcon: value || undefined, iconName: undefined, emojiIcon: undefined }
      pv.replaceChild(buildFavTile({ ...fav, ...patch }), pv.firstChild!)
      void updateFavorite(favCustomKey!, patch).then(() => loadFavorites())
    })
    row('', input, true)
    setTimeout(() => input.focus(), 0)
  }

  paletteList.appendChild(form)
}

/* ---------- In-palette settings (gear or >SuperChrome: Settings) ---------- */

function enterSettings(): void {
  if (!paletteInput || !paletteList || uiState === 'settings') return
  if (uiState === 'actions') closeActions()
  uiState = 'settings'
  savedQuery = modePrefix + paletteInput.value
  if (inputRowEl) inputRowEl.style.display = 'none'
  void renderSettings()
  renderFooter()
}

function exitSettings(): void {
  if (!paletteInput) return
  uiState = 'list'
  if (inputRowEl) inputRowEl.style.display = ''
  modePrefix = savedQuery && PREFIX_CHARS.includes(savedQuery[0]) ? savedQuery[0] : ''
  paletteInput.value = modePrefix ? savedQuery.slice(1) : savedQuery
  paletteInput.focus()
  void updateList()
}

async function renderSettings(): Promise<void> {
  if (!paletteList) return
  const s = await getSettings()
  paletteList.textContent = ''
  selectorEl = null
  flatItems = []
  favBarItems = []
  favIndex = -1

  const form = document.createElement('div')
  form.className = 'settings'

  let saveTimer: ReturnType<typeof setTimeout> | undefined
  const save = (): void => {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      void chrome.storage.sync.set({ settings: collect() }).then(() => applyUserSettings())
    }, 250)
  }

  const row = (label: string, control: HTMLElement, top = false): HTMLElement => {
    const el = document.createElement('div')
    el.className = 'set-row' + (top ? ' top' : '')
    const lab = document.createElement('label')
    lab.textContent = label
    el.append(lab, control)
    form.appendChild(el)
    return el
  }
  const divider = (): void => {
    const el = document.createElement('div')
    el.className = 'set-div'
    form.appendChild(el)
  }
  const wire = <T extends HTMLElement>(el: T): T => {
    el.addEventListener('input', save)
    el.addEventListener('change', save)
    return el
  }

  // Appearance: Raycast-style segmented pills.
  let appearanceValue = s.appearance
  const seg = document.createElement('div')
  seg.className = 'seg'
  const segButtons = (['light', 'dark', 'system'] as const).map((value) => {
    const b = document.createElement('button')
    b.textContent = value[0].toUpperCase() + value.slice(1)
    b.classList.toggle('on', appearanceValue === value)
    b.addEventListener('mousedown', (e) => {
      e.preventDefault()
      appearanceValue = value
      segButtons.forEach((sb, i) => sb.classList.toggle('on', (['light', 'dark', 'system'] as const)[i] === value))
      save()
    })
    seg.appendChild(b)
    return b
  })
  row('Appearance', seg)

  const opacity = wire(document.createElement('input'))
  opacity.type = 'range'
  opacity.min = '0.4'
  opacity.max = '1'
  opacity.step = '0.05'
  opacity.value = String(s.glassOpacity)
  row('Glass opacity', opacity)

  const swatches = document.createElement('div')
  swatches.className = 'set-swatches'
  const colorInput = (value: string, label: string): HTMLInputElement => {
    const input = wire(document.createElement('input'))
    input.type = 'color'
    input.value = value
    const tag = document.createElement('span')
    tag.textContent = label
    swatches.append(input, tag)
    return input
  }
  const colorCommand = colorInput(s.iconColors.command, 'Command')
  const colorHistory = colorInput(s.iconColors.history, 'History')
  const colorFallback = colorInput(s.iconColors.fallback, 'Fallback')
  row('Icon colors', swatches)
  divider()

  const defaultModeSel = wire(document.createElement('select'))
  for (const [value, label] of [
    ['bookmarks', 'Bookmarks'],
    ['commands', 'Commands'],
    ['tabs', 'Tabs'],
    ['history', 'History'],
  ]) {
    const opt = document.createElement('option')
    opt.value = value
    opt.textContent = label
    defaultModeSel.appendChild(opt)
  }
  defaultModeSel.value = s.defaultMode
  row('Default mode', defaultModeSel)

  const check = (label: string, checked: boolean): HTMLInputElement => {
    const wrap = document.createElement('label')
    wrap.className = 'check'
    const box = wire(document.createElement('input'))
    box.type = 'checkbox'
    box.checked = checked
    const text = document.createElement('span')
    text.textContent = label
    wrap.append(box, text)
    row('', wrap)
    return box
  }
  const newTab = check('Open results in a new tab', s.openInNewTab)
  const reduceMotionBox = check('Reduce motion', s.reduceMotion)

  const decay = wire(document.createElement('input'))
  decay.type = 'number'
  decay.min = '1'
  decay.max = '90'
  decay.value = String(s.frecencyDecayDays)
  row('Frecency decay', decay)
  divider()

  const area = (value: string, placeholder: string): HTMLTextAreaElement => {
    const el = wire(document.createElement('textarea'))
    el.spellcheck = false
    el.value = value
    el.placeholder = placeholder
    return el
  }
  const quicklinksArea = area(
    serializeQuicklinks(s.quicklinks),
    'yt | YouTube | https://www.youtube.com/results?search_query={query}',
  )
  row('Quicklinks', quicklinksArea, true)
  const snippetsArea = area(serializeSnippets(s.snippets), 'sig\nBest,\nDylan\n---\n…')
  row('Snippets', snippetsArea, true)
  const sitesArea = area(s.disabledSites.join('\n'), 'figma.com\ndocs.google.com')
  row('Disabled sites', sitesArea, true)

  const collect = (): UserSettings => ({
    ...s,
    appearance: appearanceValue,
    glassOpacity: Math.min(1, Math.max(0.4, Number(opacity.value) || s.glassOpacity)),
    iconColors: {
      command: colorCommand.value,
      folder: s.iconColors.folder,
      history: colorHistory.value,
      fallback: colorFallback.value,
    },
    defaultMode: defaultModeSel.value as UserSettings['defaultMode'],
    openInNewTab: newTab.checked,
    reduceMotion: reduceMotionBox.checked,
    frecencyDecayDays: Math.min(90, Math.max(1, Number(decay.value) || s.frecencyDecayDays)),
    quicklinks: parseQuicklinks(quicklinksArea.value),
    snippets: parseSnippets(snippetsArea.value),
    disabledSites: sitesArea.value.split('\n').map(cleanHost).filter(Boolean),
  })

  paletteList.appendChild(form)
}

/* ---------- List rendering ---------- */

function localFuzzy(query: string, text: string): number | null {
  if (!query) return 0
  let qi = 0
  let score = 0
  let streak = 0
  for (let ti = 0; ti < text.length && qi < query.length; ti++) {
    if (text[ti] === query[qi]) {
      streak++
      score += 1 + streak * 2
      qi++
    } else {
      streak = 0
    }
  }
  return qi === query.length ? score : null
}

async function updateList(): Promise<void> {
  if (!paletteInput || !paletteList) return
  const token = ++queryToken
  closeBrandMenu()
  renderFooter()
  updateModeStyling()

  if (uiState === 'rename' || uiState === 'settings' || uiState === 'fav-custom') return

  if (uiState === 'group') {
    const query = paletteInput.value.trim().toLowerCase()
    const groups = (groupsCache ?? [])
      .filter((g) => !query || g.title.toLowerCase().includes(query))
      .map(
        (g): RemoteItem => ({
          kind: 'command',
          label: g.title,
          detail: '',
          groupColor: g.color,
          downloadId: g.id,
        }),
      )
    renderItems('Tab Groups', groups)
    return
  }

  if (uiState === 'move') {
    const query = paletteInput.value.trim().toLowerCase()
    const folders = (foldersCache ?? [])
      .map((f) => ({ f, s: localFuzzy(query, f.path.toLowerCase()) }))
      .filter((x) => x.s !== null)
      .sort((a, b) => b.s! - a.s!)
      .map((x): RemoteItem => ({ kind: 'folder', label: x.f.path, detail: '', id: x.f.id }))
    renderItems('Folders', folders)
    return
  }

  if (uiState === 'links') {
    const q = paletteInput.value.trim().toLowerCase()
    const rows = pageLinks
      .map((l) => ({ l, s: localFuzzy(q, `${l.label} ${l.url}`.toLowerCase()) }))
      .filter((x) => x.s !== null)
      .sort((a, b) => b.s! - a.s!)
      .map((x) => x.l)
    renderItems(`Page Links (${pageLinks.length})`, rows)
    return
  }

  const mode = currentMode()
  // Library section: the view module owns rendering (settings-view pattern).
  if (mode === 'library') {
    favBarItems = []
    favIndex = -1
    await renderLibrary()
    return
  }
  const query = paletteInput.value
  const browsing = mode === 'bookmarks' && browseStack.length > 0
  const folderId = browsing ? browseStack[browseStack.length - 1].id : undefined
  const response = (await chrome.runtime.sendMessage({
    type: 'palette-query',
    mode,
    query,
    folderId,
  })) as { items?: RemoteItem[] }
  if (token !== queryToken || uiState !== 'list' || !paletteList) return
  if (mode === 'emoji') {
    renderEmojiGrid(response?.items ?? [])
    return
  }
  const groupLabel = browsing
    ? browseStack[browseStack.length - 1].label
    : (GROUP_LABELS[mode] ?? 'Results')
  // Favorites bar + Getting Started ride above Suggested on the home view.
  const showFavorites = mode === 'bookmarks' && !browsing && !query.trim()
  const favorites = showFavorites ? await loadFavorites() : []
  let onboardRows: RemoteItem[] = []
  if (showFavorites) {
    const ob = await loadOnboarding()
    if (onboardVisible(ob)) {
      if (!ob.done.hotkey) {
        const info = (await chrome.runtime
          .sendMessage({ type: 'hotkey-info' })
          .catch(() => null)) as { shortcut?: string } | null
        if (info?.shortcut) await markOnboard('hotkey')
      }
      const state = onboardingState() ?? ob
      const header = `Getting Started · ${onboardProgress(state)}/${ONBOARD_STEPS.length}`
      onboardRows = ONBOARD_STEPS.map((step) => ({
        kind: 'command' as const,
        label: step.label,
        detail: '',
        commandId: `onboard:${step.key}`,
        icon: state.done[step.key] ? 'onboard-done' : 'onboard-todo',
        group: header,
        typeText: state.done[step.key] ? 'Done' : 'To Do',
      }))
    }
  }
  if (token !== queryToken || uiState !== 'list' || !paletteList) return
  renderItems(groupLabel, [...onboardRows, ...(response?.items ?? [])], favorites)
}

function renderEmojiGrid(items: RemoteItem[]): void {
  if (!paletteList) return
  paletteList.textContent = ''
  selectorEl = null
  flatItems = items
  selectedIndex = 0
  favBarItems = []
  favIndex = -1
  if (!items.length) {
    const empty = document.createElement('div')
    empty.className = 'empty'
    empty.textContent = 'No results'
    paletteList.appendChild(empty)
    return
  }
  const label = document.createElement('div')
  label.className = 'group-label'
  label.textContent = 'Emoji'
  const grid = document.createElement('div')
  grid.className = 'emoji-grid'
  items.forEach((item, index) => {
    const cell = document.createElement('div')
    cell.className = 'emoji-cell'
    cell.title = item.label
    const glyph = document.createElement('span')
    glyph.className = 'glyph'
    glyph.textContent = item.emoji ?? ''
    const name = document.createElement('span')
    name.className = 'emoji-name'
    name.textContent = item.label
    cell.append(glyph, name)
    cell.addEventListener('mousedown', (e) => {
      e.preventDefault()
      void executeItem(item, e.metaKey || e.ctrlKey)
    })
    cell.addEventListener('mousemove', () => {
      if (selectedIndex !== index) {
        selectedIndex = index
        highlightSelection()
      }
    })
    grid.appendChild(cell)
  })
  paletteList.append(label, grid)
  highlightSelection(true)
}

function renderItems(
  groupLabel: string,
  items: RemoteItem[],
  favorites?: FavoriteEntry[],
  header?: HTMLElement,
): void {
  if (!paletteList) return
  paletteList.textContent = ''
  selectorEl = document.createElement('div')
  selectorEl.className = 'selector'
  paletteList.appendChild(selectorEl)
  if (header) paletteList.appendChild(header)
  flatItems = items
  selectedIndex = 0
  favBarItems = favorites ?? []
  favIndex = -1

  if (favBarItems.length) {
    const bar = document.createElement('div')
    bar.className = 'fav-bar'
    favBarItems.forEach((f, i) => bar.appendChild(favTileEl(f, i)))
    paletteList.appendChild(bar)
  }

  if (!items.length) {
    const empty = document.createElement('div')
    empty.className = 'empty'
    empty.textContent = 'No results'
    paletteList.appendChild(empty)
    return
  }

  let lastGroup: string | null = null
  items.forEach((item, index) => {
    const group = item.group ?? groupLabel
    if (group && group !== lastGroup) {
      const label = document.createElement('div')
      label.className = 'group-label'
      label.textContent = group
      paletteList!.appendChild(label)
      lastGroup = group
    }
    const row = document.createElement('div')
    row.className = 'item'
    const title = labelEl(item)
    const detail = document.createElement('span')
    detail.className = 'detail'
    detail.textContent = item.detail || (item.url ? shortUrl(item.url) : '')
    const type = document.createElement('span')
    type.className = 'type'
    type.textContent = item.openTab ? 'Switch to Tab' : (item.typeText ?? TYPE_LABELS[item.kind] ?? '')
    row.append(iconFor(item), title, detail)
    if (item.groupColor) {
      const dot = document.createElement('span')
      dot.className = 'group-dot'
      dot.style.background = item.groupColor
      row.appendChild(dot)
    }
    if (isFavorite(item)) {
      const star = document.createElement('span')
      star.className = 'fav-star'
      star.title = 'Favorited'
      star.innerHTML = STAR_SVG
      row.appendChild(star)
    }
    row.appendChild(type)
    if (item.openTab) {
      const arrow = document.createElement('span')
      arrow.className = 'open-tab-arrow'
      arrow.innerHTML = CMD_ICONS['arrow-right']
      row.appendChild(arrow)
    }
    row.addEventListener('mousedown', (e) => {
      if (e.button === 2) return
      e.preventDefault()
      void executeItem(item, e.metaKey || e.ctrlKey)
    })
    row.addEventListener('contextmenu', (e) => {
      e.preventDefault()
      selectedIndex = index
      highlightSelection()
      if (uiState === 'actions') closeActions()
      openActions({ x: e.clientX, y: e.clientY })
    })
    row.addEventListener('mousemove', () => {
      if (selectedIndex !== index) {
        selectedIndex = index
        highlightSelection()
      }
    })
    paletteList!.appendChild(row)
  })
  highlightSelection(true)
}

/** Title span with query-matched characters bolded. */
function labelEl(item: RemoteItem): HTMLElement {
  const span = document.createElement('span')
  span.className = 'title'
  const label = item.label
  const matched = new Set((item.positions ?? []).filter((p) => p < label.length))
  if (!matched.size) {
    span.textContent = label
    return span
  }
  let i = 0
  while (i < label.length) {
    const bold = matched.has(i)
    let j = i
    while (j < label.length && matched.has(j) === bold) j++
    const chunk = label.slice(i, j)
    if (bold) {
      const b = document.createElement('b')
      b.textContent = chunk
      span.appendChild(b)
    } else {
      span.appendChild(document.createTextNode(chunk))
    }
    i = j
  }
  return span
}

function iconFor(item: RemoteItem): HTMLElement {
  const icon = document.createElement('span')
  const kind = item.kind
  if ((kind === 'bookmark' || kind === 'tab' || kind === 'closed' || kind === 'history') && item.url) {
    icon.className = 'icon plain'
    const img = document.createElement('img')
    img.src =
      chrome.runtime.getURL('/_favicon/') + `?pageUrl=${encodeURIComponent(item.url)}&size=32`
    img.onerror = () => {
      icon.className = `icon kind-${kind}`
      icon.innerHTML = kind === 'history' ? CLOCK_SVG : BOOKMARK_SVG
    }
    icon.appendChild(img)
    return icon
  }
  if (kind === 'command' || kind === 'search') {
    if (item.icon === 'logo') {
      icon.className = 'icon plain'
      const img = document.createElement('img')
      img.className = 'logo-img'
      img.src = chrome.runtime.getURL('/icons/footer.png')
      img.draggable = false
      icon.appendChild(img)
      return icon
    }
    if (item.icon === 'ribbon' || item.icon === 'floppy') {
      // Self-colored glyphs (like the folder): no tile behind them.
      icon.className = 'icon plain'
      icon.innerHTML = item.icon === 'ribbon' ? RIBBON_SVG : FLOPPY_SVG
      return icon
    }
    if (item.icon === 'onboard-done' || item.icon === 'onboard-todo') {
      icon.className = 'icon plain'
      icon.innerHTML = item.icon === 'onboard-done' ? ONBOARD_DONE_SVG : ONBOARD_TODO_SVG
      return icon
    }
    icon.className = 'icon kind-command'
    if (item.color) icon.style.background = item.color
    icon.innerHTML = (item.icon && CMD_ICONS[item.icon]) || COMMAND_SVG
    return icon
  }
  if (kind === 'emoji') {
    icon.className = 'icon plain emoji-glyph'
    icon.textContent = item.emoji ?? ''
    return icon
  }
  icon.className = `icon kind-${kind}`
  if (kind === 'calc') {
    icon.textContent = '='
    return icon
  }
  if (kind === 'download') {
    if (item.color) icon.style.background = item.color
    icon.innerHTML = (item.icon && CMD_ICONS[item.icon]) || DOC_SVG
    return icon
  }
  icon.innerHTML =
    kind === 'folder'
      ? folderSvg(folderColorOf(item.id))
      : kind === 'history'
        ? CLOCK_SVG
        : kind === 'snippet'
          ? CMD_ICONS.doc
          : COMMAND_SVG
  return icon
}

function shortUrl(url: string): string {
  try {
    const u = new URL(url)
    return u.host + (u.pathname === '/' ? '' : u.pathname)
  } catch {
    return url
  }
}

/* ---------- Library section wiring ---------- */

// The '*' section view lives in features/bookmarks/view.ts; it renders into
// the palette's list through these hooks so rows keep the shared selection,
// Enter, and ⌘K machinery.
initLibrary({
  list: () => paletteList,
  input: () => paletteInput,
  renderRows: (groupLabel, items, header) => renderItems(groupLabel, items, undefined, header),
  send: (message) => {
    if ((message as { type?: string }).type === 'bookmark-create') void markOnboard('save')
    return chrome.runtime.sendMessage(message).catch(() => undefined) as Promise<
      Record<string, unknown> | undefined
    >
  },
  toast: (message) => showToast(message),
  refresh: () => void updateList(),
  hideInputRow: (hidden) => {
    if (inputRowEl) inputRowEl.style.display = hidden ? 'none' : ''
  },
  enterRename: (item) => enterRename(item),
  kbd,
})
})()
