import { formatTime } from '../today/values'
import type { ReportDataEntry } from '../../api/charts'

/** A cell in the app's value format, the one the CSV import reads back. */
function cell(raw: unknown): string {
  if (raw === null || typeof raw !== 'object') return ''
  const v = raw as Partial<Record<string, unknown>>
  if ('Int' in v) return String(v.Int)
  if ('Bool' in v) return v.Bool ? '✓' : ''
  if ('Time' in v) return formatTime(v.Time as { h: number; m: number })
  // h:mm, not "2h": the import reads a lone "2h" as 2 minutes.
  if ('Duration' in v) { const m = v.Duration as number; return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}` }
  if ('Text' in v) return String(v.Text)
  return ''
}

const quote = (s: string) => (/[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)

/** One row per date, one column per practice (as main writes it, and as Settings → Import reads it). */
export function toCSV(entries: ReportDataEntry[]): string {
  const practices = [...new Set(entries.map((e) => e.practice))]
  const days = new Map<string, Map<string, string>>()
  for (const e of entries) {
    if (!days.has(e.cob_date)) days.set(e.cob_date, new Map())
    days.get(e.cob_date)!.set(e.practice, cell(e.value))
  }
  return [['date', ...practices], ...[...days].map(([date, row]) => [date, ...practices.map((p) => row.get(p) ?? '')])]
    .map((r) => r.map(quote).join(','))
    .join('\n')
}

/** Trigger a browser download of the given CSV string as `data.csv`. */
export function triggerCSVDownload(csv: string) {
  const bom = '﻿'
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'data.csv'
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
