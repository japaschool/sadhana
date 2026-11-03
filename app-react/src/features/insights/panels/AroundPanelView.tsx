import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AroundRow } from '../../../api/charts'
import { SegmentedControl } from '../../../ui/primitives/SegmentedControl'
import { formatDuration } from '../../today/values'
import { AROUND_MIN, aroundTable, eventOptions, gapEvents, type AroundCell, type RowKind } from './gapLogic'
import { clockText, labelText, type Lookup } from './panelLogic'

interface AroundPanelProps {
  event: string
  rows: AroundRow[]
  days: string[]
  prevDays: string[]
  lookup: Lookup
  todayCob: string
}

const COLUMNS = ['dayBefore', 'sameDay', 'nextDay', 'twoDaysAfter'] as const

/** Teal above usual (or earlier), amber below; the strongest steps take light text. */
function cellStyle(step: AroundCell['step']) {
  if (step === 0) return { background: 'var(--ui-div-0)' }
  const key = `${step > 0 ? 'p' : 'm'}${Math.abs(step)}`
  return { background: `var(--ui-div-${key})`, ...(Math.abs(step) === 3 && { color: `var(--ui-on-div-${key})` }) }
}

/** Each row on the days around the selected option's events, against its usual over the range. */
export function AroundPanelView({ event, rows, days, prevDays, lookup, todayCob }: AroundPanelProps) {
  const { t } = useTranslation()
  const units = { h: t('today.unitH'), min: t('today.unitMin') }
  const events = gapEvents(event, days, prevDays, lookup)
  const options = eventOptions(event, events, lookup)
  const [picked, setPicked] = useState<string | null>(null)
  const option = picked !== null && options.includes(picked) ? picked : options[0] ?? null
  const chosen = options.length ? events.filter((x) => x.option === option) : events
  const fmt = (kind: RowKind, v: number | null) => (v === null ? '—'
    : kind === 'Count' ? v.toFixed(1) : kind === 'Duration' ? formatDuration(Math.round(v), units) : clockText(Math.round(v)))

  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-[20px] border border-ui-hairline bg-ui-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base leading-[1.3] font-extrabold text-ui-ink">{t('reportPanels.around')}</h2>
        {options.length >= 2 && option !== null && (
          <SegmentedControl label={t('reportPanels.option')} value={option} onChange={setPicked}
            options={options.map((o) => ({ value: o, label: o }))} />
        )}
      </div>
      {chosen.length < AROUND_MIN ? (
        <p className="text-sm leading-normal text-ui-ink2">{t('reportPanels.moreEvents', { count: AROUND_MIN - chosen.length })}</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-1 text-sm">
              <thead>
                <tr>
                  <th scope="col"><span className="sr-only">{t('reportPanels.event')}</span></th>
                  {[...COLUMNS, 'usual' as const].map((c) => (
                    <th key={c} scope="col" className="px-1 text-xs leading-[1.3] font-bold text-ui-muted">{t(`reportPanels.${c}`)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {aroundTable(rows, chosen, days, lookup, todayCob).map((line, r) => {
                  const usual = fmt(line.kind, line.usual)
                  return (
                    <tr key={r}>
                      <th scope="row" className="pr-2 text-left text-xs leading-[1.3] font-bold text-ui-ink2">
                        {labelText(line.row.label, t, 'Practice' in line.row.source ? lookup.name(line.row.source.Practice.practice) : '')}
                      </th>
                      {line.cells.map((c, i) => {
                        const label = t('reportPanels.aroundCell', { value: fmt(line.kind, c.value), usual })
                        return (
                          <td key={i} title={label} aria-label={label} style={cellStyle(c.step)}
                            className="rounded-lg px-2 py-2 text-center font-ui-mono text-[13px] font-semibold whitespace-nowrap text-ui-ink">
                            {fmt(line.kind, c.value)}
                          </td>
                        )
                      })}
                      <td className="px-2 py-2 text-center font-ui-mono text-[13px] whitespace-nowrap text-ui-muted">{usual}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs leading-[1.45] text-ui-muted">{t('reportPanels.aroundNote')}</p>
        </>
      )}
    </section>
  )
}
