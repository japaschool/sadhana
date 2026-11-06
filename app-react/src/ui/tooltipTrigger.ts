/** Chart tooltips open on tap where there is no hover: Recharts turns any touch-move (a scroll) into a hover. */
// ponytail: read once; a device that gains/loses a mouse mid-session keeps its first answer until reload.
export const TOOLTIP_TRIGGER: 'hover' | 'click' = window.matchMedia?.('(hover: none)').matches ? 'click' : 'hover'
