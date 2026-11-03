/** The chart card's daily average and its change vs the previous window: mobile stacks them, wide puts the change on the right. */
export function Headline({ label, value, delta, up, wide, className = '' }: {
  label: string; value: string; delta: string | null; up: boolean; wide: boolean; className?: string
}) {
  const tone = up ? 'text-ui-good' : 'text-ui-muted'
  if (!wide) {
    return (
      <div className={className}>
        <p className="text-xs font-semibold text-ui-muted">{label}</p>
        <p className="font-ui-mono text-[30px] leading-tight text-ui-ink">{value}</p>
        {delta !== null && <p className={`text-xs font-semibold ${tone}`}>{delta}</p>}
      </div>
    )
  }
  return (
    <div className={`flex items-end justify-between gap-4 ${className}`}>
      <div className="flex flex-col gap-0.5">
        <p className="text-[13px] font-semibold text-ui-muted">{label}</p>
        <p className="font-ui-mono text-[40px] leading-tight tracking-[-0.03em] text-ui-ink">{value}</p>
      </div>
      {delta !== null && <p className={`pb-2 text-[13px] font-bold ${tone}`}>{delta}</p>}
    </div>
  )
}
