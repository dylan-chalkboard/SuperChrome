/**
 * Custom dropdown (Raycast-style) replacing native <select> in the palette.
 *
 * Keyboard routing: the palette's window-capture key handler stops
 * propagation, so this component never sees keydown directly — the palette
 * calls dropdownHandleKey(e) early and skips its own handling when it
 * returns true. Mouse events reach the component normally.
 */

export interface DropdownOption {
  label: string
  value: string
}

export interface Dropdown {
  el: HTMLElement
  readonly value: string
  focus(): void
  close(): void
}

interface Instance {
  el: HTMLElement
  labelEl: HTMLElement
  options: DropdownOption[]
  value: string
  onChange?: (value: string) => void
  container: HTMLElement
  menu: HTMLDivElement | null
  index: number
}

let focused: Instance | null = null

export const DROPDOWN_CSS = `
.sc-dd {
  display: inline-flex; align-items: center; gap: 7px; cursor: pointer;
  background: transparent; border: 1px solid #ffffff2e; border-radius: 8px;
  color: #e8e8e8; font-size: 13.5px; padding: 5px 10px; outline: none;
  min-width: 90px; max-width: 220px; user-select: none; white-space: nowrap;
}
.sc-dd:focus { border-color: #4c9df388; }
.sc-dd-label { overflow: hidden; text-overflow: ellipsis; flex: 1; }
.sc-dd-chevron { font-size: 10px; color: #ffffff59; flex-shrink: 0; }
.sc-dd-menu {
  position: absolute; z-index: 6; min-width: 150px; max-height: 260px; overflow-y: auto;
  background: #26262b; border: 1px solid #ffffff24; border-radius: 10px;
  padding: 5px; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
}
.sc-dd-row {
  display: flex; align-items: center; justify-content: space-between; gap: 14px;
  padding: 6px 10px; border-radius: 7px; font-size: 13px; color: #e8e8e8; cursor: pointer;
  white-space: nowrap;
}
.sc-dd-row.selected, .sc-dd-row:hover { background: #ffffff14; }
.sc-dd-check { color: #4c9df3; font-size: 12px; }
.light .sc-dd { border-color: #00000026; color: #26262b; }
.light .sc-dd-chevron { color: #00000059; }
.light .sc-dd-menu { background: #f4f4f6; border-color: #00000020; }
.light .sc-dd-row { color: #26262b; }
.light .sc-dd-row.selected, .light .sc-dd-row:hover { background: #00000010; }
`

function closeMenu(inst: Instance): void {
  inst.menu?.remove()
  inst.menu = null
}

function highlight(inst: Instance): void {
  inst.menu
    ?.querySelectorAll<HTMLElement>('.sc-dd-row')
    .forEach((row, i) => {
      row.classList.toggle('selected', i === inst.index)
      if (i === inst.index) row.scrollIntoView({ block: 'nearest' })
    })
}

function choose(inst: Instance, index: number): void {
  const option = inst.options[index]
  if (!option) return
  inst.value = option.value
  inst.labelEl.textContent = option.label
  closeMenu(inst)
  inst.el.focus()
  inst.onChange?.(option.value)
}

function openMenu(inst: Instance): void {
  if (inst.menu) return
  const menu = document.createElement('div')
  menu.className = 'sc-dd-menu'
  inst.index = Math.max(0, inst.options.findIndex((o) => o.value === inst.value))
  inst.options.forEach((option, i) => {
    const row = document.createElement('div')
    row.className = 'sc-dd-row' + (i === inst.index ? ' selected' : '')
    const label = document.createElement('span')
    label.textContent = option.label
    row.appendChild(label)
    if (option.value === inst.value) {
      const check = document.createElement('span')
      check.className = 'sc-dd-check'
      check.textContent = '✓'
      row.appendChild(check)
    }
    row.addEventListener('mousedown', (e) => {
      e.preventDefault()
      choose(inst, i)
    })
    menu.appendChild(row)
  })
  const rect = inst.el.getBoundingClientRect()
  const containerRect = inst.container.getBoundingClientRect()
  menu.style.left = `${rect.left - containerRect.left}px`
  menu.style.top = `${rect.bottom - containerRect.top + 4}px`
  inst.container.appendChild(menu)
  inst.menu = menu
  highlight(inst)
}

/**
 * Palette key handler hook: acts on the focused dropdown; true = consumed.
 * Closed: Space/arrows open. Open: arrows move, Enter/Space pick, Esc closes,
 * letters jump by prefix; Tab closes but still moves focus.
 */
export function dropdownHandleKey(e: KeyboardEvent): boolean {
  const inst = focused
  if (!inst) return false
  if (!inst.menu) {
    if (e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      openMenu(inst)
      return true
    }
    return false
  }
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault()
    const n = inst.options.length
    inst.index = (inst.index + (e.key === 'ArrowDown' ? 1 : -1) + n) % n
    highlight(inst)
    return true
  }
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    choose(inst, inst.index)
    return true
  }
  if (e.key === 'Escape') {
    e.preventDefault()
    closeMenu(inst)
    return true
  }
  if (e.key === 'Tab') {
    closeMenu(inst)
    return false
  }
  if (/^[a-z0-9]$/i.test(e.key)) {
    const hit = inst.options.findIndex((o) => o.label.toLowerCase().startsWith(e.key.toLowerCase()))
    if (hit >= 0) {
      inst.index = hit
      highlight(inst)
    }
    return true
  }
  return true
}

export function createDropdown(cfg: {
  options: DropdownOption[]
  value?: string
  /** Positioned ancestor the floating menu is appended to (the panel). */
  container: HTMLElement
  onChange?: (value: string) => void
}): Dropdown {
  const el = document.createElement('div')
  el.className = 'sc-dd'
  el.tabIndex = 0
  const labelEl = document.createElement('span')
  labelEl.className = 'sc-dd-label'
  const chevron = document.createElement('span')
  chevron.className = 'sc-dd-chevron'
  chevron.textContent = '▾'
  el.append(labelEl, chevron)

  const initial =
    cfg.options.find((o) => o.value === cfg.value) ?? cfg.options[0] ?? { label: '', value: '' }
  const inst: Instance = {
    el,
    labelEl,
    options: cfg.options,
    value: initial.value,
    onChange: cfg.onChange,
    container: cfg.container,
    menu: null,
    index: 0,
  }
  labelEl.textContent = initial.label

  el.addEventListener('mousedown', (e) => {
    e.preventDefault()
    el.focus()
    if (inst.menu) closeMenu(inst)
    else openMenu(inst)
  })
  el.addEventListener('focus', () => {
    focused = inst
  })
  el.addEventListener('blur', () => {
    if (focused === inst) focused = null
    closeMenu(inst)
  })

  return {
    el,
    get value() {
      return inst.value
    },
    focus() {
      el.focus()
    },
    close() {
      closeMenu(inst)
    },
  }
}
