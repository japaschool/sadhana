interface ToggleProps { checked: boolean; onChange: (v: boolean) => void; label: string }

export function Toggle({ checked, onChange, label }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`w-11 h-[26px] shrink-0 rounded-full p-[3px] flex transition-colors ${checked ? 'bg-ui-accent-fill justify-end' : 'bg-ui-toggle-off justify-start'}`}
    >
      <span className={`w-5 h-5 rounded-full ${checked ? 'bg-ui-toggle-on-knob' : 'bg-ui-toggle-off-knob'}`} />
    </button>
  )
}
