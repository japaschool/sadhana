import type { PracticeDataType, PracticeValue, UserPractice } from '../../types/api'

/** RFC 4180-ish: commas, optional double quotes ("" inside quotes is a quote), CRLF or LF. Blank lines are dropped. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  const s = text.replace(/^\uFEFF/, '') // Excel's BOM
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') { cell += '"'; i++ }
      else if (c === '"') quoted = false
      else cell += c
    } else if (c === '"') quoted = true
    else if (c === ',') { row.push(cell); cell = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++
      row.push(cell); rows.push(row); row = []; cell = ''
    } else cell += c
  }
  row.push(cell); rows.push(row)
  return rows.filter((r) => r.some((c) => c.trim()))
}

export interface Column { name: string; type: PracticeDataType | null }

export interface CsvFile {
  /** The first column's name: it holds the dates. */
  date: string
  /** Every column after the date, with its practice's type (null: no practice has that name). */
  columns: Column[]
  /** Data rows; [0] is the date. */
  rows: string[][]
}

export function readCsv(text: string, practices: UserPractice[]): CsvFile {
  const [header = [], ...rows] = parseCsv(text)
  const types = new Map(practices.map((p) => [p.practice, p.data_type]))
  return { date: header[0]?.trim() ?? '', columns: header.slice(1).map((h) => ({ name: h.trim(), type: types.get(h.trim()) ?? null })), rows }
}

/** Why a cell couldn't be read; the page words it. */
export type CellError =
  | { kind: 'date'; value: string }
  | { kind: PracticeDataType; value: string; column: string }

export function parseValue(type: PracticeDataType, raw: string): PracticeValue | undefined {
  const v = raw.trim()
  switch (type) {
    case 'Int': return /^-?\d+$/.test(v) ? { Int: Number(v) } : undefined
    case 'Bool': {
      const b = v === '✓' ? 'true' : v.toLowerCase()
      return b === 'true' || b === 'false' ? { Bool: b === 'true' } : undefined
    }
    case 'Time': {
      const m = /^(\d{1,2}):(\d{2})$/.exec(v)
      return m && +m[1] < 24 && +m[2] < 60 ? { Time: { h: +m[1], m: +m[2] } } : undefined
    }
    // Minutes ("45"), or hours and minutes with anything between and after ("1h 30m", "1:30").
    case 'Duration': {
      const m = /^(?:(\d+)\D+)?(\d+)\D*$/.exec(v)
      return m ? { Duration: Number(m[1] ?? 0) * 60 + Number(m[2]) } : undefined
    }
    case 'Text': return { Text: raw }
  }
}

const isDate = (v: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false
  const [y, m, d] = v.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
}

export interface Day { date: string; entries: { practice: string; value: PracticeValue | null }[] }

/** Every row as a day of matched entries (an empty cell clears the value), or every failing row's first error.
 *  `line` is the line in the file, counting the header as 1. */
export function toDays(file: CsvFile): { days: Day[]; errors: { line: number; error: CellError }[] } {
  const days: Day[] = []
  const errors: { line: number; error: CellError }[] = []
  file.rows.forEach((row, i) => {
    const date = row[0].trim()
    if (!isDate(date)) return void errors.push({ line: i + 2, error: { kind: 'date', value: date } })
    const entries: Day['entries'] = []
    for (const [c, col] of file.columns.entries()) {
      const raw = row[c + 1]
      // ponytail: a short row leaves its missing columns alone, as the Rust UI did.
      if (!col.type || raw === undefined) continue
      if (!raw.trim()) { entries.push({ practice: col.name, value: null }); continue }
      const value = parseValue(col.type, raw)
      if (!value) return void errors.push({ line: i + 2, error: { kind: col.type, value: raw.trim(), column: col.name } })
      entries.push({ practice: col.name, value })
    }
    days.push({ date, entries })
  })
  return { days, errors }
}
