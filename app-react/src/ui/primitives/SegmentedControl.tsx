import { onRadioKeys, radioTabIndex } from '../radioKeys'

interface SegmentedControlProps<T extends string> {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  label: string
  /** Full width, the options sharing it equally. */
  fill?: boolean
}

export function SegmentedControl<T extends string>({ options, value, onChange, label, fill }: SegmentedControlProps<T>) {
  const values = options.map((o) => o.value)
  return (
    <div role="radiogroup" aria-label={label} onKeyDown={(e) => onRadioKeys(e, values, value, onChange)} className={`flex rounded-xl bg-ui-chip p-[3px] font-bold ${fill ? 'w-full text-sm' : 'shrink-0 text-[13px]'}`}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          tabIndex={radioTabIndex(values, value, o.value)}
          onClick={() => onChange(o.value)}
          title={o.label}
          className={`truncate rounded-[9px] px-3 py-2 ${fill ? 'min-h-10 min-w-0 flex-1' : 'max-w-40'} ${o.value === value ? 'bg-ui-surface shadow-[0_1px_2px_rgba(0,0,0,.08)]' : 'text-ui-muted'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
