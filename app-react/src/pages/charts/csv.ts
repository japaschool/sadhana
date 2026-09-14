import type { ReportDataEntry } from '../../api/charts'

/** Type-agnostic value extractor used only by toCSV (no data_type context). */
function csvValueToNumber(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null
  if (typeof raw === 'number') return raw
  if (typeof raw === 'boolean') return raw ? 1 : 0
  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>
    if ('Int' in obj) return obj.Int as number
    if ('Bool' in obj) return (obj.Bool as boolean) ? 1 : 0
    if ('Duration' in obj) return obj.Duration as number
    if ('Time' in obj) {
      const t = obj.Time as { h: number; m: number }
      return t.h * 60 + t.m
    }
  }
  return null
}

/** Build a `date,practice,value` CSV from report entries. */
export function toCSV(entries: ReportDataEntry[], practiceMap: Record<string, string>): string {
  const header = ['date', 'practice', 'value'].join(',')
  const rows = entries.map((e) => {
    const name = (practiceMap[e.practice] ?? e.practice).replace(/,/g, ' ')
    const val = csvValueToNumber(e.value)
    return [e.cob_date, name, val === null ? '' : String(val)].join(',')
  })
  return [header, ...rows].join('\n')
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
