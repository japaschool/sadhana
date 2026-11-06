import { useEffect, useState } from 'react'

/** Chart tooltips open on tap where there is no hover: Recharts turns any touch-move (a scroll) into a hover. */
// ponytail: read once; a device that gains/loses a mouse mid-session keeps its first answer until reload.
const TAP = !!window.matchMedia?.('(hover: none)').matches

/**
 * Spread `chart` on the Recharts chart and `tooltip` on its `<Tooltip>`. On touch devices a tap opens the
 * tooltip and the next touch anywhere (another tap, a scroll) hides it; Recharts itself never clears a click.
 */
export function useChartTooltip() {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!TAP) return
    // Fires before the chart's click, so a tap on the chart closes then reopens it at the new point.
    const close = () => setOpen(false)
    document.addEventListener('pointerdown', close, true)
    return () => document.removeEventListener('pointerdown', close, true)
  }, [])
  if (!TAP) return { chart: {}, tooltip: { trigger: 'hover' as const } }
  return { chart: { onClick: () => setOpen(true) }, tooltip: { trigger: 'click' as const, active: open ? undefined : false } }
}
