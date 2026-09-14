export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-white/55">
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#c8724a' }} />
      {children}
    </span>
  )
}
