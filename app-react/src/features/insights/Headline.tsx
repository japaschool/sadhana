/** A headline's change; tapping it cycles what it compares against when `onClick` is given. */
export function Delta({ text, onClick, className }: { text: string; onClick?: () => void; className: string }) {
  return onClick
    ? <button type="button" onClick={onClick} className={`${className} cursor-pointer`}>{text}</button>
    : <p className={className}>{text}</p>
}

/** The chart card's daily average and its change vs the previous window: mobile stacks them, wide puts the change on the right. */
export function Headline({ label, value, delta, up, wide, onDelta, className = '' }: {
  label: string; value: string; delta: string | null; up: boolean; wide: boolean; onDelta?: () => void; className?: string
}) {
  const tone = up ? 'text-ui-good' : 'text-ui-muted'
  if (!wide) {
    return (
      <div className={`flex flex-col items-start ${className}`}>
        <p className="text-xs font-semibold text-ui-muted">{label}</p>
        <p className="font-ui-mono text-[30px] leading-tight text-ui-ink">{value}</p>
        {delta !== null && <Delta text={delta} onClick={onDelta} className={`text-xs font-semibold ${tone}`} />}
      </div>
    )
  }
  return (
    <div className={`flex items-end justify-between gap-4 ${className}`}>
      <div className="flex flex-col gap-0.5">
        <p className="text-[13px] font-semibold text-ui-muted">{label}</p>
        <p className="font-ui-mono text-[40px] leading-tight tracking-[-0.03em] text-ui-ink">{value}</p>
      </div>
      {delta !== null && <Delta text={delta} onClick={onDelta} className={`pb-2 text-[13px] font-bold ${tone}`} />}
    </div>
  )
}
