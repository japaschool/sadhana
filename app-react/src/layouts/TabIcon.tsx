export function TabIcon({ d, className }: { d: string; className: string }) {
  return (
    <svg aria-hidden viewBox="0 0 1024 1024" className={`fill-current ${className}`}>
      <path transform="matrix(1 0 0 -1 0 960)" d={d} />
    </svg>
  )
}
