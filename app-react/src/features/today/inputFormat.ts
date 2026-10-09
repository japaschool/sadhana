
/** Format raw keystrokes into a partial/full HH:MM string (adapts Rust format_time). */
export function formatTimeInput(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 4)
  if (d.length === 0) return ''
  if (d.length === 1) return Number(d) > 2 ? `0${d}:` : d
  let hh = d.slice(0, 2)
  if (Number(hh) > 23) hh = '23'
  const rest = d.slice(2)
  if (rest.length === 0) return `${hh}:`
  if (rest.length === 1) return Number(rest) > 5 ? `${hh}:0${rest}` : `${hh}:${rest}`
  let mm = rest.slice(0, 2)
  if (Number(mm) > 59) mm = '59'
  return `${hh}:${mm}`
}

/** Parse an HH:MM (or partial) display into clamped {h,m}, or null if empty. */
export function parseTime(display: string): { h: number; m: number } | null {
  const [hs, ms] = display.split(':')
  const h = parseInt(hs ?? '', 10)
  if (isNaN(h)) return null
  const m = parseInt(ms ?? '', 10)
  return {
    h: Math.max(0, Math.min(23, h)),
    m: isNaN(m) ? 0 : Math.max(0, Math.min(59, m)),
  }
}
