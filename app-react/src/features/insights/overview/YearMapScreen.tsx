import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMarkedPeriods } from '../../../api/markedPeriods'
import { UiLoading } from '../../../layouts/ByLayout'
import { useLayout } from '../../../layouts/useLayout'
import { SettingsSubpage } from '../../settings/SettingsSubpage'
import { fromDateStr, toDateStr } from '../../today/date'
import { formatDay } from '../insightsLogic'
import { listText, rowName, rowValueText } from './format'
import { stepStyle } from './stepStyle'
import { useInsightRows } from './useInsightRows'
import { useYearData } from './useYearData'
import { shift } from './usual'
import type { Word } from './usual'
import { weekStarts, yearMap } from './yearMap'
import type { MapCell } from './yearMap'
import type { InsightRow } from './series'

const wordOf = (step: number, row: InsightRow): Word =>
  step === 0 ? 'usual' : row.kind === 'Clock' ? (step > 0 ? 'earlier' : 'later') : step > 0 ? 'above' : 'below'

const SWATCH = 'h-3.5 w-3.5 shrink-0 rounded-[4px]'

/** /insights/year: every week's average against its row's usual (16m7, 16t3, 16d3). */
export function YearMap() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language || 'en'
  const n = useLayout() === 'mobile' ? 26 : 52
  const todayCob = toDateStr(new Date())
  const { periods } = useMarkedPeriods()
  const dataQ = useYearData(todayCob)
  const data = useInsightRows(dataQ, todayCob)
  const [active, setActive] = useState<{ key: string; week: string } | null>(null)
  const weeks = useMemo(() => weekStarts(n, todayCob), [n, todayCob])
  const map = useMemo(() => yearMap(data.rows, data.series, n, todayCob), [data.rows, data.series, n, todayCob])
  const units = { h: t('today.unitH'), min: t('today.unitMin') }
  const cols = { gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }
  const months = useMemo(() => weeks.map((w, i) => {
    const m = fromDateStr(w).getMonth()
    return i === 0 || m !== fromDateStr(weeks[i - 1]).getMonth()
      ? new Intl.DateTimeFormat(locale, { month: 'short' }).format(fromDateStr(w)) : ''
  }), [weeks, locale])
  const bars = useMemo(() => periods.flatMap((p) => {
    const hit = weeks.flatMap((w, i) => (p.start_date <= shift(w, 6) && (p.end_date === null || p.end_date >= w) ? [i] : []))
    return hit.length ? [{ p, from: hit[0] + 1, to: hit[hit.length - 1] + 2 }] : []
  }), [periods, weeks])
  const overlapping = (week: string) => periods.filter((p) => p.start_date <= shift(week, 6) && (p.end_date === null || p.end_date >= week))

  const detail = (row: InsightRow, median: number | null, c: MapCell) => {
    if (c.mean === null) return t('insights.yearMap.noDays')
    const avg = t('insights.yearMap.avg', { avg: rowValueText(row.kind, c.mean, units), usual: rowValueText(row.kind, median, units) })
    const word = t(`insights.overview.word_${wordOf(c.step, row)}`)
    return `${avg}. ${c.step === 0 ? word : t('insights.yearMap.steps', { word, k: Math.abs(c.step) })}`
  }

  let body
  if (dataQ.isLoading || data.isLoading) body = <UiLoading />
  else if (data.isError) body = <p role="alert" className="py-10 text-center text-sm text-ui-danger">{t('insights.loadFailed')}</p>
  else {
    const sel = active && map.find((m) => m.row.key === active.key)
    const cell = sel?.cells.find((c) => c.week === active!.week)
    const inPeriods = cell ? overlapping(cell.week).map((p) => p.name) : []
    body = (
      <>
        <p className="font-ui-mono text-xs font-medium text-ui-muted">{t('insights.yearMap.subtitle', { n })}</p>
        <div role="group" aria-label={t('insights.yearMap.grid')} className="flex flex-col gap-3">
          {bars.length > 0 && (
            <div className="grid gap-y-1" style={cols}>
              {/* A bar spans its weeks; its name sits above and runs past a short bar toward the middle. One row each, so names never collide. */}
              {bars.map(({ p, from, to }, i) => (
                <span key={p.id} title={p.name} style={{ gridColumn: `${from} / ${to}`, gridRow: i + 1 }}
                  className={`flex min-w-0 flex-col gap-0.5 ${from > n / 2 ? 'items-end' : 'items-start'}`}>
                  <span className="text-[11px] leading-[14px] font-bold whitespace-nowrap text-ui-ink2">{p.name}</span>
                  <span aria-hidden className="h-1.5 w-full rounded-full bg-ui-faint2" />
                </span>
              ))}
            </div>
          )}
          <div aria-hidden className="grid font-ui-mono text-[10px] text-ui-faint2" style={cols}>
            {months.map((m, i) => <span key={i} className="overflow-visible whitespace-nowrap">{m}</span>)}
          </div>
          {map.map(({ row, median, cells }) => (
            <div key={row.key} className="flex flex-col gap-1">
              <span className="text-[13px] font-extrabold text-ui-ink">{rowName(row, data.practices, t)}</span>
              <div className="grid gap-px" style={cols}>
                {cells.map((c) => {
                  const on = active?.key === row.key && active.week === c.week
                  const pick = () => setActive({ key: row.key, week: c.week })
                  return (
                    <button key={c.week} type="button" data-week={c.week} onClick={pick} onMouseEnter={pick} onFocus={pick}
                      aria-label={t('insights.yearMap.cell', { date: formatDay(c.week, locale), row: rowName(row, data.practices, t), detail: detail(row, median, c) })}
                      className={`h-7 min-w-0 rounded-[2px] ${on ? 'outline-2 outline-ui-ink' : ''}`}
                      style={c.mean === null ? { border: '1px dashed var(--ui-hairline)' } : stepStyle(c.step)} />
                  )
                })}
              </div>
            </div>
          ))}
        </div>
        <div role="status" className="min-h-[88px] rounded-[14px] border border-ui-hairline bg-ui-surface p-3 text-[13px]">
          {sel && cell && (
            <div className="flex flex-col gap-0.5">
              <span className="font-ui-mono text-xs text-ui-muted">
                {t('insights.yearMap.weekOf', { date: formatDay(cell.week, locale), n: cell.days })}
              </span>
              <span className="font-extrabold text-ui-ink">{rowName(sel.row, data.practices, t)}</span>
              {cell.mean === null ? <span className="text-ui-muted">{t('insights.yearMap.noDays')}</span> : (
                <>
                  <span className="font-ui-mono text-ui-ink">
                    {t('insights.yearMap.avg', { avg: rowValueText(sel.row.kind, cell.mean, units), usual: rowValueText(sel.row.kind, sel.median, units) })}
                  </span>
                  <span className="font-bold text-ui-ink2">
                    {cell.step === 0 ? t('insights.overview.word_usual')
                      : t('insights.yearMap.steps', { word: t(`insights.overview.word_${wordOf(cell.step, sel.row)}`), k: Math.abs(cell.step) })}
                  </span>
                </>
              )}
              {inPeriods.length > 0 && <span className="text-ui-muted">{t('insights.yearMap.inPeriods', { names: listText(inPeriods, locale) })}</span>}
            </div>
          )}
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs font-bold text-ui-ink2">
          <li className="inline-flex items-center gap-1.5"><span aria-hidden className={SWATCH} style={{ background: 'var(--ui-div-p3)' }} />{t('insights.yearMap.earlier')}</li>
          <li className="inline-flex items-center gap-1.5"><span aria-hidden className={SWATCH} style={{ background: 'var(--ui-div-m3)' }} />{t('insights.yearMap.later')}</li>
          <li className="inline-flex items-center gap-1.5"><span aria-hidden className={SWATCH} style={{ border: '1px dashed var(--ui-hairline)' }} />{t('insights.yearMap.noDays')}</li>
        </ul>
        <p className="text-xs leading-[1.4] text-ui-muted">{t('insights.yearMap.explain')}</p>
        {n === 26 && <p className="text-xs leading-[1.4] text-ui-muted">{t('insights.yearMap.phone')}</p>}
      </>
    )
  }
  return <SettingsSubpage wide title={t('insights.yearMap.title')} back={{ to: '/charts', label: t('insights.overview.overview') }}>{body}</SettingsSubpage>
}
