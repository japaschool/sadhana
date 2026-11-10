import type { ReactNode } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import type { Format, Stat, StatValue } from '../../../api/charts'
import { figureDuration, formatValue, labelText, statResult, type Lookup } from './panelLogic'

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
      text: r.value === null || (r.of !== undefined && r.value === 0 && noneLogged(s, r.of)) ? '—' : formatOf(s.value) === 'Duration' ? figureDuration(r.value, t) : formatValue(r.value, formatOf(s.value), units),
    }
  }
}

/** ru and uk spell units out: at four across, a long duration drops a size to stay inside its tile. */
const LONG = 8

export interface Figure {
  label: string
  /** The value; its length sizes the tile's type. */
  text: string
  /** Shown in place of `text`, as it reads. */
  content?: ReactNode
  note?: string
  /** The change vs the previous window, toned as a chart headline's. */
  trend?: { text: string; up: boolean }
}

/** Values stay on one line, because ru and uk spell units out; labels wrap. */
export function FigureGrid({ items, cols }: { items: Figure[]; cols: 2 | 4 }) {
  // One row on wide layouts, however many figures there are.
  const across = cols === 2 ? 2 : items.length
  const left = items.length % across
  return (
    <div className={`grid gap-px overflow-hidden rounded-[18px] border border-ui-hairline bg-ui-hairline ${cols === 2 ? 'grid-cols-2' : ''}`}
      style={cols === 2 ? undefined : { gridTemplateColumns: `repeat(${across}, minmax(0, 1fr))` }}>
      {items.map((f, i) => (
        <div key={i} className="flex min-w-0 flex-col gap-1 bg-ui-surface px-3.5 py-3"
          style={left && i === items.length - 1 ? { gridColumn: `span ${across - left + 1}` } : undefined}>
          <span className="text-xs leading-[1.3] font-bold text-ui-muted">{f.label}</span>
          <span className={`font-ui-mono leading-[1.15] font-semibold tracking-[-0.02em] whitespace-nowrap text-ui-ink ${cols === 2 ? 'text-[22px]' : f.text.length > LONG ? 'text-[20px]' : 'text-[26px]'}`}>
            {f.content ?? f.text}
          </span>
          {f.trend && <span className={`text-xs font-semibold ${f.trend.up ? 'text-ui-good' : 'text-ui-muted'}`}>{f.trend.text}</span>}
          {f.note && <span className="text-[11px] leading-[1.35] text-ui-faint2">{f.note}</span>}
        </div>
      ))}
    </div>
  )
}

export function StatsPanelView({ stats, days, lookup, todayCob, cols }: StatsPanelProps) {
  const { t } = useTranslation()
  const text = useStatText(days, lookup, todayCob)
  return (
    <FigureGrid cols={cols} items={stats.map((s): Figure => {
      const r = text(s)
      return {
        label: labelText(s.label, t),
        text: r.text,
        content: r.of === undefined || r.text === '—' ? undefined : (
          <Trans i18nKey="reportPanels.ofTotal" values={{ value: r.value, total: r.of }}
            components={{ muted: <span className="text-[.6em] font-medium text-ui-muted" /> }} />
        ),
        note: s.under ? `${labelText(s.under.label, t)}: ${text(s.under).text}` : undefined,
      }
    })} />
  )
}
