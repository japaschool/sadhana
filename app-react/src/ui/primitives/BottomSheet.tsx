import { useEffect, useRef } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { motion } from 'framer-motion'
import { UiPortal } from './UiPortal'

const FOCUSABLE = 'button:not([disabled]), input, textarea, [tabindex]:not([tabindex="-1"])'
const CLOSE_DRAG_PX = 100

interface BottomSheetProps { label: string; onClose: () => void; children: ReactNode }

// ponytail: no exit animation (needs AnimatePresence at every call site); add if the snap-close feels abrupt.
export function BottomSheet({ label, onClose, children }: BottomSheetProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    ref.current?.focus()
    return () => prev?.focus?.()
  }, [])

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') { e.stopPropagation(); onClose(); return }
    if (e.key !== 'Tab' || !ref.current) return
    const items = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
    if (!items.length) return
    const first = items[0]
    const last = items[items.length - 1]
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
  }

  return (
    <UiPortal>
      <motion.div
        data-testid="sheet-backdrop"
        className="fixed inset-0 z-50 bg-ui-backdrop"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      />
      <motion.div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        // Tablet (useLayout's query; desktop has no sheets): one practice column wide — (content − 2·36px padding − 16px gap) / 2 —
        // centred in the area right of the 88px rail; floored at a phone's width for the 640–767px single-column range.
        className="fixed inset-x-0 bottom-0 z-50 [@media(min-width:640px)_and_(min-height:500px)]:left-[88px] [@media(min-width:640px)_and_(min-height:500px)]:mx-auto [@media(min-width:640px)_and_(min-height:500px)]:w-[max(375px,calc(50vw-88px))] flex max-h-[92dvh] flex-col gap-[18px] overflow-y-auto rounded-t-[28px] bg-ui-sheet px-5 pt-2.5 pb-[calc(30px+env(safe-area-inset-bottom))] outline-none"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        transition={{ type: 'tween', duration: 0.22, ease: 'easeOut' }}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.6 }}
        onDragEnd={(_, info) => { if (info.offset.y > CLOSE_DRAG_PX || info.velocity.y > 500) onClose() }}
      >
        <span aria-hidden className="h-[5px] w-10 self-center rounded-full bg-ui-control" />
        {children}
      </motion.div>
    </UiPortal>
  )
}
