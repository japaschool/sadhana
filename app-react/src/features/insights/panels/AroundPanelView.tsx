import { useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AroundRow } from '../../../api/charts'
import { AnchoredMenu, MenuItem } from '../../../ui/primitives/AnchoredMenu'
import { SegmentedControl } from '../../../ui/primitives/SegmentedControl'
import { Chevron } from '../../today/mobile/rowParts'
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

/** A segmented switch while it fits beside the title; a menu button once it doesn't. */
type Choice = { value: string; label: string }

function OptionPicker({ options, value, onChange, label }: { options: Choice[]; value: string; onChange: (v: string) => void; label: string }) {
  const box = useRef<HTMLDivElement>(null)
  const probe = useRef<HTMLDivElement>(null)
  const [fits, setFits] = useState(true)
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const labels = options.map((o) => o.label).join('\n') // a new array each render; re-measure only when the labels change
  useLayoutEffect(() => {
    // ponytail: window resize only; add a ResizeObserver if the panel ever resizes without the window.
    const check = () => setFits(probe.current!.scrollWidth <= box.current!.clientWidth)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [labels])
  const shown = options.find((o) => o.value === value)?.label ?? ''
  const segmented = <SegmentedControl label={label} value={value} onChange={onChange} options={options} />

  return (
    <div ref={box} className="relative flex min-w-0 flex-1 justify-end">
      {/* An unseen copy, measured to decide which one shows. */}
      <div ref={probe} aria-hidden inert style={{ visibility: 'hidden' }} className="absolute top-0 right-0 w-max">{segmented}</div>
      {fits ? segmented : (
        <button type="button" aria-haspopup="menu" aria-expanded={!!anchor} aria-label={`${label}: ${shown}`}
          onClick={(e) => setAnchor(e.currentTarget)}
          className="flex min-h-9 max-w-full min-w-0 items-center gap-2 rounded-xl bg-ui-chip px-3 py-2 text-[13px] font-bold">
          <span className="truncate">{shown}</span>
          <Chevron />
        </button>
      )}
      {anchor && (
        <AnchoredMenu anchor={anchor} label={label} onClose={() => setAnchor(null)}>
          {options.map((o) => (
            <MenuItem key={o.value} selected={o.value === value} onSelect={() => { setAnchor(null); onChange(o.value) }}>{o.label}</MenuItem>
          ))}
        </AnchoredMenu>
      )}
    </div>
  )
}

/** Each row on the days around the selected option's events (all of them by default), against its usual over the range. */
export function AroundPanelView({ event, rows, days, prevDays, lookup, todayCob }: AroundPanelProps) {
  const { t } = useTranslation()
  const units = { h: t('today.unitH'), min: t('today.unitMin') }
  const events = gapEvents(event, days, prevDays, lookup)
  const options = eventOptions(event, events, lookup)
  // '' is All: an option is never empty text.
  const [picked, setPicked] = useState('')
  const option = options.includes(picked) ? picked : ''
  const chosen = option ? events.filter((x) => x.option === option) : events
  const fmt = (kind: RowKind, v: number | null) => (v === null ? '—'
    : kind === 'Count' ? v.toFixed(1) : kind === 'Duration' ? formatDuration(Math.round(v), units) : clockText(Math.round(v)))

  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-[20px] border border-ui-hairline bg-ui-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="shrink-0 text-base leading-[1.3] font-extrabold text-ui-ink">{t('reportPanels.around')}</h2>
        {options.length >= 2 && (
          <OptionPicker label={t('reportPanels.option')} value={option} onChange={setPicked}
            options={[{ value: '', label: t('reportPanels.allOptions') }, ...options.map((o) => ({ value: o, label: o }))]} />
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
