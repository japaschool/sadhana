type PillProps = { href: string; children: React.ReactNode; variant?: 'solid' | 'ghost'; className?: string }
export function Pill({ href, children, variant = 'solid', className = '' }: PillProps) {
  const base = 'inline-flex items-center justify-center rounded-full px-5 h-10 text-sm font-medium transition-colors no-underline'
  const styles = variant === 'solid'
    ? 'bg-white text-black hover:bg-white/90'
    : 'border border-white/25 text-white hover:bg-white/10'
  return <a href={href} className={`${base} ${styles} ${className}`}>{children}</a>
}
