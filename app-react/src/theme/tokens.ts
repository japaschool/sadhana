// Shared dark/amber palette for inline styles (mirrors the DaisyUI dark theme in
// index.css). Prefer DaisyUI classes (bg-base-100, text-primary, …) where a
// className is used; use these constants where a raw inline-style value is
// required.
export const ACCENT = '#f59e0b'            // primary interactive amber (fills, active)
export const ACCENT_LIGHT = '#fcd34d'      // luminous amber for lines / highlights / glow
export const ACCENT_GRADIENT = 'linear-gradient(135deg, #fcd34d 0%, #f59e0b 100%)'
export const ACCENT_SHADOW = 'rgba(245,158,11,0.40)'
export const ACCENT_SOFT = 'rgba(252,211,77,0.12)'
export const ACCENT_RING = 'rgba(252,211,77,0.30)'

export const SURFACE_1 = '#0e141b'
export const SURFACE_2 = '#151d27'
export const SURFACE_3 = '#1b2531'
export const SURFACE_GLASS = 'rgba(20,28,38,0.72)'
export const SURFACE_PANEL = 'rgba(20,28,38,0.45)'     // cards / chart panels (frosted glass over bg3)
export const SURFACE_ELEVATED = 'rgba(26,35,47,0.48)'  // practice rows (frosted glass over bg3)

export const TEXT = '#eef3f8'
export const TEXT_MUTED = 'rgba(238,243,248,0.58)'
export const TEXT_FAINT = 'rgba(238,243,248,0.42)'
export const BORDER = 'rgba(255,255,255,0.08)'

// Deep Ink + Glow backdrop for the authenticated shell.
export const APP_BACKDROP =
  'radial-gradient(70% 55% at 84% -5%, rgba(45,212,191,0.16), transparent 50%),' +
  'radial-gradient(60% 45% at 8% 108%, rgba(56,189,248,0.09), transparent 55%),' +
  'linear-gradient(160deg, #0b0f14 0%, #070a0e 100%)'

// Deep Ink scrim + teal glow laid over the bg3 (green hills) photo on the
// authenticated shell — hills stay faintly visible while text stays legible.
export const APP_SCRIM =
  'radial-gradient(70% 55% at 84% -5%, rgba(45,212,191,0.18), transparent 50%),' +
  'radial-gradient(60% 45% at 8% 108%, rgba(56,189,248,0.10), transparent 55%),' +
  'linear-gradient(160deg, rgba(7,10,14,0.28) 0%, rgba(7,10,14,0.52) 100%)'
