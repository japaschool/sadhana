interface SkeletonCardProps {
  lines?: number
  height?: string
}

export function SkeletonCard({ lines = 1, height = '60px' }: SkeletonCardProps) {
  return (
    <div
      className="rounded-2xl px-4 flex items-center gap-3 animate-pulse"
      style={{
        minHeight: height,
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
      }}
    >
      <div className="w-8 h-8 rounded-xl flex-shrink-0" style={{ background: 'rgba(255,255,255,0.08)' }} />
      <div className="flex-1 flex flex-col gap-1.5">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className="h-3 rounded-full"
            style={{ background: 'rgba(255,255,255,0.08)', width: i === 0 ? '55%' : '35%' }}
          />
        ))}
      </div>
      <div className="w-12 h-6 rounded-full flex-shrink-0" style={{ background: 'rgba(255,255,255,0.08)' }} />
    </div>
  )
}
