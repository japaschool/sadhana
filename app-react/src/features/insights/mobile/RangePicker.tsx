import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AnchoredMenu, MenuItem } from '../../../ui/primitives/AnchoredMenu'
import { SegmentedControl } from '../../../ui/primitives/SegmentedControl'
import { LONG_RANGES, RANGES, type Range } from '../useInsights'

const MORE = 'more'

/** 7d · 30d · 90d · 1y, then a last segment that opens 2y · 3y · 5y · All and, once one is picked, shows it. */
export function RangePicker({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  const { t } = useTranslation()
  const ref = useRef<HTMLDivElement>(null)
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const long = LONG_RANGES.includes(value)
  const options = [
    ...RANGES.map((r) => ({ value: r as string, label: t(`insights.range${r}`) })),
    { value: long ? value : MORE, label: long ? `${t(`insights.range${value}`)} ▾` : '…' },
  ]
  return (
    <div ref={ref}>
      <SegmentedControl label={t('insights.range')} value={value} options={options}
        onChange={(v) => {
          if (v !== MORE && !LONG_RANGES.includes(v as Range)) onChange(v as Range)
          else setAnchor(ref.current?.querySelector<HTMLElement>('[role="radio"]:last-child') ?? null)
        }} />
      {anchor && (
        <AnchoredMenu anchor={anchor} label={t('insights.moreRanges')} onClose={() => setAnchor(null)}>
          {LONG_RANGES.map((r) => (
            <MenuItem key={r} selected={r === value} onSelect={() => { setAnchor(null); onChange(r) }}>{t(`insights.rangeLong${r}`)}</MenuItem>
          ))}
        </AnchoredMenu>
      )}
    </div>
  )
}
