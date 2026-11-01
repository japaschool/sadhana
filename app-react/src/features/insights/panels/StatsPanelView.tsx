import { Trans, useTranslation } from 'react-i18next'
import type { Format, Stat, StatValue } from '../../../api/charts'
import { formatValue, labelText, statResult, type Lookup } from './panelLogic'

interface StatsPanelProps { stats: Stat[]; days: string[]; lookup: Lookup; todayCob: string; cols: 2 | 4 }

const formatOf = (v: StatValue): Format => ('Average' in v ? v.Average.format : 'Count')

const noneLogged = (s: Stat, of: number) => 'Logged' in s.value || of === 0

function useStatText(days: string[], lookup: Lookup, todayCob: string) {
  const { t } = useTranslation()
  const units = { h: t('today.unitH'), min: t('today.unitMin') }
  return (s: Stat) => {
    const r = statResult(s.value, days, lookup, todayCob)
    return {
      ...r,
      // A count of nothing reads as no data (15m20), not as 0 of 7.
      text: r.value === null || (r.of !== undefined && r.value === 0 && noneLogged(s, r.of)) ? '—' : formatValue(r.value, formatOf(s.value), units),
    }
  }
}

/** Values stay on one line, because ru and uk spell units out; labels wrap. */
export function StatsPanelView({ stats, days, lookup, todayCob, cols }: StatsPanelProps) {
  const { t } = useTranslation()
  const text = useStatText(days, lookup, todayCob)
  const left = stats.length % cols
  return (
    <div className={`grid gap-px overflow-hidden rounded-[18px] border border-ui-hairline bg-ui-hairline ${cols === 2 ? 'grid-cols-2' : 'grid-cols-4'}`}>
      {stats.map((s, i) => {
        const r = text(s)
        const under = s.under && text(s.under)
        return (
          <div key={i} className="flex min-w-0 flex-col gap-1 bg-ui-surface px-3.5 py-3"
            style={left && i === stats.length - 1 ? { gridColumn: `span ${cols - left + 1}` } : undefined}>
            <span className="text-xs leading-[1.3] font-bold text-ui-muted">{labelText(s.label, t)}</span>
            <span className={`font-ui-mono leading-[1.15] font-semibold tracking-[-0.02em] whitespace-nowrap text-ui-ink ${cols === 2 ? 'text-[22px]' : 'text-[26px]'}`}>
              {r.of === undefined || r.text === '—' ? r.text : (
                <Trans i18nKey="reportPanels.ofTotal" values={{ value: r.value, total: r.of }}
                  components={{ muted: <span className="text-[.6em] font-medium text-ui-muted" /> }} />
              )}
            </span>
            {s.under && under && <span className="text-[11px] leading-[1.35] text-ui-faint2">{labelText(s.under.label, t)}: {under.text}</span>}
          </div>
        )
      })}
    </div>
  )
}
