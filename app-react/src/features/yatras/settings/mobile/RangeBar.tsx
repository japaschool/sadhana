import { ZONE_BG } from '../../yatrasLogic'
import type { Bar, ScoredType } from '../zones'
import { formatValue, fromNumber } from '../zones'

function Marker({ at, label, stem }: { at: number; label: string; stem: string }) {
  return (
    <span className="absolute bottom-0 flex -translate-x-1/2 flex-col items-center gap-0.5" style={{ left: `${at}%` }}>
      <span className="rounded-md bg-ui-primary px-1.5 py-0.5 font-ui-mono text-[11px] font-semibold whitespace-nowrap text-ui-on-primary">{label}</span>
      <span className={`w-[1.5px] bg-ui-primary ${stem}`} />
    </span>
  )
}

/** Colour zones, bound handles and the ✓ done / ★ bonus thresholds on one scale. Decorative: the text around it says the same. */
export function RangeBar({ bar, dt }: { bar: Bar | null; dt: ScoredType }) {
  // Nothing set yet: an empty track of the same height, so the fields below don't jump when the first value lands.
  if (!bar) {
    return (
      <div aria-hidden data-range-bar="empty" className="flex flex-col gap-0.5 px-3">
        <div className="h-[50px]" />
        <div className="flex h-7 items-center"><div className="h-3.5 w-full rounded-[7px] bg-ui-chip" /></div>
        <div className="h-[18px]" />
      </div>
    )
  }
  const end = (n: number) => formatValue(fromNumber(n, dt), dt)
  return (
    <div aria-hidden data-range-bar className="flex flex-col gap-0.5 px-3">
      <div className="relative h-[50px]">
        {bar.done && <Marker at={bar.done.at} label={`✓ ${formatValue(bar.done.value, dt)}`} stem="h-2" />}
        {bar.bonus && <Marker at={bar.bonus.at} label={`★ ${formatValue(bar.bonus.value, dt)}`} stem="h-7" />}
      </div>
      <div className="relative flex h-7 items-center">
        <div className="relative h-3.5 w-full overflow-hidden rounded-[7px] bg-ui-chip">
          {bar.segments.map((s, i) => (
            <span key={i} className={`absolute inset-y-0 ${ZONE_BG[s.colour] || 'bg-ui-chip'}`} style={{ left: `${s.left}%`, width: `${s.width}%` }} />
          ))}
        </div>
        {bar.ticks.map((tk, i) => (
          <span key={i} className="absolute top-1/2 -mt-[13px] -ml-[13px] h-[26px] w-[26px] rounded-full border-2 border-ui-ink bg-ui-surface shadow-[0_2px_6px_rgba(0,0,0,.25)]"
            style={{ left: `${tk.at}%` }} />
        ))}
      </div>
      <div className="relative h-[18px] font-ui-mono text-[11px]">
        <span className="absolute -left-3 text-ui-faint2">{end(bar.min)}</span>
        <span className="absolute -right-3 text-ui-faint2">{end(bar.max)}</span>
        {bar.ticks.map((tk, i) => (
          <span key={i} className="absolute -translate-x-1/2 text-xs font-semibold text-ui-ink" style={{ left: `${tk.at}%` }}>{formatValue(tk.value, dt)}</span>
        ))}
      </div>
    </div>
  )
}
