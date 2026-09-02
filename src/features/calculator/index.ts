/** Inline calculator and unit conversions for the palette. */

/* ---------- Inline calculator: safe recursive-descent parser, no eval ---------- */

export function tryCalculate(raw: string): string | null {
  let expr = raw.trim().toLowerCase()
  if (expr.length < 2 || expr.length > 64) return null
  expr = expr
    .replace(/,/g, '')
    .replace(/\bof\b/g, '*')
    .replace(/(^|[\s\d)])x([\s\d(])/g, '$1*$2')
    .replace(/\bpi\b/g, String(Math.PI))
  if (!/^[\d\s+\-*/^().%e]+$/.test(expr)) return null
  if (!/[+\-*/^%]/.test(expr) || !/\d/.test(expr)) return null

  let pos = 0
  const peek = (): string => expr[pos] ?? ''
  const skip = (): void => {
    while (peek() === ' ') pos++
  }
  const primary = (): number => {
    skip()
    if (peek() === '(') {
      pos++
      const value = additive()
      skip()
      if (peek() !== ')') throw new Error('paren')
      pos++
      return value
    }
    const match = /^\d*\.?\d+(e[+-]?\d+)?/.exec(expr.slice(pos))
    if (!match) throw new Error('number')
    pos += match[0].length
    return Number(match[0])
  }
  const postfix = (): number => {
    let value = primary()
    skip()
    while (peek() === '%') {
      pos++
      value /= 100
      skip()
    }
    return value
  }
  const unary = (): number => {
    skip()
    if (peek() === '-') {
      pos++
      return -unary()
    }
    return postfix()
  }
  const power = (): number => {
    const base = unary()
    skip()
    if (peek() === '^') {
      pos++
      return base ** power()
    }
    return base
  }
  const multiplicative = (): number => {
    let value = power()
    skip()
    while (peek() === '*' || peek() === '/') {
      const op = expr[pos++]
      const rhs = power()
      value = op === '*' ? value * rhs : value / rhs
      skip()
    }
    return value
  }
  const additive = (): number => {
    let value = multiplicative()
    skip()
    while (peek() === '+' || peek() === '-') {
      const op = expr[pos++]
      const rhs = multiplicative()
      value = op === '+' ? value + rhs : value - rhs
      skip()
    }
    return value
  }

  try {
    const result = additive()
    skip()
    if (pos !== expr.length || !Number.isFinite(result)) return null
    return String(Number(result.toPrecision(12)))
  } catch {
    return null
  }
}

/* ---------- Unit conversions: "5km in miles", "72f in c", "3h in min" ---------- */

interface UnitDef {
  group: string
  factor: number
  label: string
}

function unitTable(): Record<string, UnitDef> {
  const table: Record<string, UnitDef> = {}
  const add = (group: string, factor: number, label: string, aliases: string[]): void => {
    for (const alias of aliases) table[alias] = { group, factor, label }
  }
  add('length', 0.001, 'mm', ['mm', 'millimeter', 'millimeters'])
  add('length', 0.01, 'cm', ['cm', 'centimeter', 'centimeters'])
  add('length', 1, 'm', ['m', 'meter', 'meters', 'metre', 'metres'])
  add('length', 1000, 'km', ['km', 'kilometer', 'kilometers', 'kilometre', 'kilometres'])
  add('length', 0.0254, 'in', ['in', 'inch', 'inches'])
  add('length', 0.3048, 'ft', ['ft', 'foot', 'feet'])
  add('length', 0.9144, 'yd', ['yd', 'yard', 'yards'])
  add('length', 1609.344, 'mi', ['mi', 'mile', 'miles'])
  add('mass', 0.001, 'g', ['g', 'gram', 'grams'])
  add('mass', 0.000001, 'mg', ['mg'])
  add('mass', 1, 'kg', ['kg', 'kilogram', 'kilograms', 'kilo', 'kilos'])
  add('mass', 0.028349523125, 'oz', ['oz', 'ounce', 'ounces'])
  add('mass', 0.45359237, 'lb', ['lb', 'lbs', 'pound', 'pounds'])
  add('mass', 6.35029318, 'st', ['st', 'stone'])
  add('time', 1, 's', ['s', 'sec', 'secs', 'second', 'seconds'])
  add('time', 60, 'min', ['min', 'mins', 'minute', 'minutes'])
  add('time', 3600, 'h', ['h', 'hr', 'hrs', 'hour', 'hours'])
  add('time', 86400, 'd', ['d', 'day', 'days'])
  add('time', 604800, 'wk', ['wk', 'week', 'weeks'])
  add('data', 1, 'B', ['b', 'byte', 'bytes'])
  add('data', 1e3, 'KB', ['kb'])
  add('data', 1e6, 'MB', ['mb'])
  add('data', 1e9, 'GB', ['gb'])
  add('data', 1e12, 'TB', ['tb'])
  add('temp', 0, '°C', ['c', 'celsius', '°c'])
  add('temp', 0, '°F', ['f', 'fahrenheit', '°f'])
  add('temp', 0, 'K', ['k', 'kelvin'])
  return table
}

const UNITS = unitTable()

function toCelsius(value: number, label: string): number {
  if (label === '°F') return ((value - 32) * 5) / 9
  if (label === 'K') return value - 273.15
  return value
}

function fromCelsius(value: number, label: string): number {
  if (label === '°F') return (value * 9) / 5 + 32
  if (label === 'K') return value + 273.15
  return value
}

/** Convert "5km in miles" style queries; null when it isn't one. */
export function tryConvert(raw: string): string | null {
  const q = raw.trim().toLowerCase().replace(/,/g, '')
  const match = /^(-?\d+(?:\.\d+)?)\s*([a-z°]+)\s+(?:in|to|as)\s+([a-z°]+)$/i.exec(q)
  if (!match) return null
  const from = UNITS[match[2]]
  const to = UNITS[match[3]]
  if (!from || !to || from.group !== to.group) return null
  const value = Number(match[1])
  const result =
    from.group === 'temp'
      ? fromCelsius(toCelsius(value, from.label), to.label)
      : (value * from.factor) / to.factor
  if (!Number.isFinite(result)) return null
  return `${Number(result.toPrecision(6))} ${to.label}`
}

