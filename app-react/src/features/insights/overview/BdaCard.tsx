import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import type { MarkedPeriod } from '../../../api/markedPeriods'
import type { UserPractice } from '../../../types/api'
import { beforeDuringAfter, cardPeriods, changeScore } from './bda'
import type { Bda, Chip } from './bda'
import { listText, periodDates, rowName, rowValueText } from './format'
import { OV_CARD } from './MeVsNormal'
import type { InsightRow, Series } from './series'

export function chipText(chip: Chip, t: TFunction): string {
  if (chip.kind === 'back') return t('insights.period.chipBack', { count: chip.days })
  return t(`insights.period.chip_${chip.kind}`)
}

export function StatusChip({ chip }: { chip: Chip }) {
  const { t } = useTranslation()
  return <span className="rounded-full bg-ui-chip px-2.5 py-0.5 text-xs font-bold whitespace-nowrap text-ui-ink2">{chipText(chip, t)}</span>
}

export function Overlaps({ periods }: { periods: MarkedPeriod[] }) {
  const { t, i18n } = useTranslation()
  if (!periods.length) return null
  return <span className="text-xs font-semibold text-ui-muted">{t('insights.period.overlaps', { names: listText(periods.map((p) => p.name), i18n.language || 'en') })}</span>
}

/** Before, during and after for the 3 rows that moved most (16m1). */
function BdaCard({ bda, practices }: { bda: Bda; practices: UserPractice[] }) {
  const { t, i18n } = useTranslation()
  const { period } = bda
  const units = { h: t('today.unitH'), min: t('today.unitMin') }
  const top = bda.rows
    .flatMap((r) => { const s = changeScore(r); return s === null ? [] : [{ r, s }] })
    .sort((a, b) => b.s - a.s)
    .slice(0, 3)
  const fmt = (r: Bda['rows'][number], v: number | null) => rowValueText(r.row.kind, v, units)
  return (
    <section aria-labelledby={`bda-${period.id}`} className={OV_CARD}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={`bda-${period.id}`} className="min-w-0 truncate text-lg font-extrabold tracking-[-0.01em] text-ui-ink">{period.name}</h2>
        <Link to={`/insights/period/${period.id}`} className="shrink-0 text-[15px] font-bold text-ui-accent">{t('insights.period.open')}</Link>
      </div>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <span className="font-ui-mono text-xs font-medium text-ui-muted">{periodDates(period, i18n.language || 'en', t)}</span>
        {bda.chip && <StatusChip chip={bda.chip} />}
        <Overlaps periods={bda.overlaps} />
      </div>
      {top.length > 0 && (
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="text-[11px] font-bold tracking-[.08em] text-ui-faint2 uppercase">
              <th scope="col"><span className="sr-only">{t('insights.period.row')}</span></th>
              {(['before', 'during', 'after'] as const).map((k) => <th key={k} scope="col" className="text-right font-bold">{t(`insights.period.${k}`)}</th>)}
            </tr>
          </thead>
          <tbody>
            {top.map(({ r }) => (
              <tr key={r.row.key} className="border-t border-ui-chip">
                <th scope="row" className="py-2 pr-2 text-left text-[15px] font-extrabold text-ui-ink">{rowName(r.row, practices, t)}</th>
                {[r.before, r.during, r.after].map((v, i) => (
                  <td key={i} className="py-2 pl-2 text-right font-ui-mono text-[13px] font-semibold text-ui-ink">{fmt(r, v)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

/** One card per marked period that is recent enough, newest first. */
export function BdaCards({ rows, series, periods, practices, todayCob }: {
  rows: InsightRow[]; series: Map<string, Series>; periods: MarkedPeriod[]; practices: UserPractice[]; todayCob: string
}) {
  return cardPeriods(periods, todayCob).map((p) => (
    <BdaCard key={p.id} bda={beforeDuringAfter(p, rows, series, periods, todayCob)} practices={practices} />
  ))
}
