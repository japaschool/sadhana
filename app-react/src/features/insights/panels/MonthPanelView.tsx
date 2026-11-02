import { useTranslation } from 'react-i18next'
import { addDays, fromDateStr, toDateStr } from '../../today/date'
import { formatDay } from '../insightsLogic'
import { monthCells, monthCounts, monthName, type Lookup } from './panelLogic'

interface MonthPanelProps { practice: string; month: string; end: string; todayCob: string; lookup: Lookup; figures?: boolean }

const DAY = 'flex h-[34px] items-center justify-center rounded-lg font-ui-mono text-xs font-medium'

/** A practice's month: three counts (unless `figures` is off), then a Monday-first grid. A day is done or it isn't; empty and false look the same, and nothing is red. */
export function MonthPanelView({ practice, month, end, todayCob, lookup, figures = true }: MonthPanelProps) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language || 'en'
  const name = lookup.name(practice) ?? ''
  const { blanks, days } = monthCells(month, todayCob)
  const c = monthCounts(practice, month, end, lookup)
  const current = month === todayCob.slice(0, 7)
  const [y, m] = month.split('-').map(Number)
  const prev = toDateStr(new Date(y, m - 2, 1)).slice(0, 7)
  const from90 = toDateStr(addDays(fromDateStr(end), -89))
  const figs = [
    { label: current ? t('reportPanels.thisMonth') : monthName(month, locale, false), value: c.thisMonth, sub: `${formatDay(`${month}-01`, locale)} – ${formatDay(end, locale)}` },
    { label: current ? t('reportPanels.lastMonth') : monthName(prev, locale, false), value: c.lastMonth, sub: monthName(prev, locale, false) },
    { label: t('reportPanels.last90'), value: c.last90, sub: `${formatDay(from90, locale)} – ${formatDay(end, locale)}` },
  ]
  // Monday-first letters from a known week (5 Oct 2026 is a Monday).
  const weekdays = Array.from({ length: 7 }, (_, i) => new Date(2026, 9, 5 + i).toLocaleDateString(locale, { weekday: 'narrow' }))

  return (
    <section role="group" aria-label={name} className="flex flex-col gap-3.5 rounded-[20px] border border-ui-hairline bg-ui-surface p-4">
      <h2 className="text-[17px] leading-[1.3] font-extrabold text-ui-ink">{name}</h2>
      {figures && <div className="grid grid-cols-3 gap-px overflow-hidden rounded-[14px] border border-ui-hairline bg-ui-hairline">
        {figs.map((f, i) => (
          <div key={i} className="flex min-w-0 flex-col gap-1 bg-ui-surface px-3 py-2.5">
            <span className="text-xs leading-[1.3] font-bold text-ui-muted">{f.label}</span>
            <span className="font-ui-mono text-xl leading-[1.15] font-semibold text-ui-ink">{f.value}</span>
            <span className="text-[11px] leading-[1.35] text-ui-faint2">{f.sub}</span>
          </div>
        ))}
      </div>}
      <div role="img" aria-label={t('reportPanels.daysDone', { name, count: c.thisMonth, month: monthName(month, locale) })}
        className="flex flex-col gap-1">
        <div className="grid grid-cols-7 gap-1">
          {weekdays.map((w, i) => <span key={i} data-weekday className="text-center font-ui-mono text-[11px] font-semibold text-ui-faint">{w}</span>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: blanks }, (_, i) => <span key={`b${i}`} />)}
          {days.map(({ cob, future }) => {
            const done = !future && c.done.has(cob)
            const tone = future ? 'text-ui-faint opacity-60 shadow-[inset_0_0_0_1px_var(--ui-hairline)]'
              : done ? 'bg-ui-done text-ui-on-done' : 'bg-ui-heat-0 text-ui-muted'
            return (
              <span key={cob} data-cob={cob} data-done={done} data-future={future} aria-current={cob === todayCob ? 'date' : undefined}
                className={`${DAY} ${tone} ${cob === todayCob ? 'outline-2 outline-offset-1 outline-ui-ink' : ''}`}>
                {Number(cob.slice(8))}
              </span>
            )
          })}
        </div>
      </div>
    </section>
  )
}
