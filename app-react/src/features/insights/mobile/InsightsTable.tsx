import { useLayoutEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { ReportDataEntry } from '../../../api/charts'
import { practicesApi } from '../../../api/practices'
import type { TraceInput } from '../chartLogic'
import { fromDateStr } from '../../today/date'
import { parseOptions } from '../../today/values'
import { cellText, formatDay, traceAverageLabel } from '../insightsLogic'

interface InsightsTableProps {
  traces: TraceInput[]; entries: ReportDataEntry[]; todayCob: string; onOpenDay: (cob: string) => void
  /** Space kept below the table. Mobile: the 61px tab bar plus 12px. */
  bottomGap?: number
}

const DATE_COL = 'sticky left-0 z-10 w-[72px] min-w-[72px] border-r border-ui-hairline px-3'

// ponytail: every day is rendered; virtualise if the All range on years of data gets slow.
export function InsightsTable({ traces, entries, todayCob, onOpenDay, bottomGap = 73 }: InsightsTableProps) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language || 'en'
  const units = { h: t('today.unitH'), min: t('today.unitMin') }
  const ref = useRef<HTMLDivElement>(null)
  const [top, setTop] = useState(0)
  useLayoutEffect(() => setTop(ref.current!.getBoundingClientRect().top + window.scrollY), [])
  const { data: practices = [] } = useQuery({ queryKey: ['practices'], queryFn: practicesApi.getUserPractices })
  const byName = new Map(practices.map((p) => [p.practice, p]))
  const values = new Map(entries.map((e) => [`${e.cob_date}|${e.practice}`, e.value]))
  const days = [...new Set(entries.map((e) => e.cob_date))].sort().reverse()
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short' })
  const fullDate = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' })

  const cols = traces.map((tr) => {
    const p = byName.get(tr.name)
    const long = tr.dataType === 'Text' && !parseOptions(p?.dropdown_variants).length
    return {
      ...tr,
      required: !!p?.is_required,
      width: long ? 'w-[220px] min-w-[220px]' : tr.dataType === 'Bool' ? 'w-16 min-w-16' : 'w-[76px] min-w-[76px]',
      align: tr.dataType === 'Bool' ? 'text-center' : tr.dataType === 'Text' ? 'text-left' : 'text-right',
    }
  })

  return (
    <div ref={ref} style={{ maxHeight: `calc(100dvh - ${top + bottomGap}px - env(safe-area-inset-bottom))` }}
      className="overflow-auto rounded-[20px] border border-ui-hairline bg-ui-surface">
      <table className="min-w-full border-separate border-spacing-0">
        <thead className="sticky top-0 z-20 bg-ui-surface">
          <tr>
            <th className={`${DATE_COL} bg-ui-surface`} />
            <th colSpan={cols.length} className="px-2.5 pt-2.5 pb-0.5 text-left font-ui-mono text-[10px] font-semibold tracking-[.08em] text-ui-accent uppercase">
              {t('today.group')}
            </th>
          </tr>
          <tr>
            <th className={`${DATE_COL} border-b bg-ui-surface pt-1 pb-2.5 text-left align-bottom font-ui-mono text-[10px] font-semibold tracking-[.08em] text-ui-faint uppercase`}>
              {t('insights.date')}
            </th>
            {cols.map((c, i) => (
              <th key={i} className={`${c.width} ${c.align} border-b border-ui-hairline px-2.5 pt-1 pb-2.5 align-bottom text-[11px] leading-tight font-bold break-words hyphens-auto text-ui-ink`}>
                {c.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {days.map((cob) => {
            const cells = cols.map((c) => cellText(values.get(`${cob}|${c.name}`), c.dataType, units))
            const warn = cols.some((c, i) => c.required && !cells[i])
            const d = fromDateStr(cob)
            return (
              <tr key={cob} onClick={() => onOpenDay(cob)} className="cursor-pointer">
                <td className={`${DATE_COL} border-b bg-ui-surface py-2`}>
                  <button type="button" aria-label={fullDate.format(d)} onClick={(e) => { e.stopPropagation(); onOpenDay(cob) }}
                    className="flex flex-col gap-px text-left">
                    <span className="flex items-center gap-1.5 font-ui-mono text-[10px] font-medium tracking-[.04em] text-ui-faint uppercase">
                      {weekday.format(d)}
                      {warn && <span data-testid="required-missing" className="h-1.5 w-1.5 rounded-full bg-ui-danger" />}
                    </span>
                    <span className="text-[13px] font-bold whitespace-nowrap text-ui-ink">{formatDay(cob, locale)}</span>
                  </button>
                </td>
                {cols.map((c, i) => {
                  const v = cells[i]
                  const missing = c.required && !v
                  const tone = missing ? 'bg-ui-danger/10 text-ui-danger font-ui-mono'
                    : !v ? 'text-ui-faint font-ui-mono'
                    : c.dataType === 'Bool' ? 'font-extrabold text-ui-good'
                    : c.dataType === 'Text' ? 'font-semibold text-ui-ink2' : 'font-ui-mono font-medium text-ui-ink'
                  return (
                    <td key={i} className={`${c.align} ${tone} h-[52px] border-b border-ui-hairline px-2.5 py-2 text-[13px] leading-[1.35]`}>
                      <span className={c.dataType === 'Text' ? 'line-clamp-2' : 'whitespace-nowrap'}>{v || '—'}</span>
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
        <tfoot className="sticky bottom-0 z-20 bg-ui-bg">
          <tr>
            <td className={`${DATE_COL} border-t bg-ui-bg py-3 font-ui-mono text-[10px] font-semibold tracking-[.08em] text-ui-faint uppercase`}>
              {t('insights.days', { count: days.length })}
            </td>
            {cols.map((c, i) => (
              <td key={i} className={`${c.align} border-t border-ui-hairline px-2.5 py-3 font-ui-mono text-xs font-semibold text-ui-ink2`}>
                {traceAverageLabel(c, entries, todayCob, units)}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
