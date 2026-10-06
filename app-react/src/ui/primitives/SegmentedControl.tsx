interface SegmentedControlProps<T extends string> {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  label: string
}

export function SegmentedControl<T extends string>({ options, value, onChange, label }: SegmentedControlProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className="flex shrink-0 rounded-xl bg-ui-chip p-[3px] text-[13px] font-bold">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={`rounded-[9px] px-3 py-2 ${o.value === value ? 'bg-ui-surface shadow-[0_1px_2px_rgba(0,0,0,.08)]' : 'text-ui-muted'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
