import { useEffect, useRef } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { motion, useDragControls } from 'framer-motion'
import { useLayout } from '../../layouts/useLayout'
import { UiPortal } from './UiPortal'

const FOCUSABLE = 'button:not([disabled]), input, textarea, [tabindex]:not([tabindex="-1"])'
const CLOSE_DRAG_PX = 100

interface BottomSheetProps {
  label: string; onClose: () => void; children: ReactNode
  /** Mobile: a lower ceiling than 92dvh, e.g. to stop under something kept in view. */
  maxHeight?: string
  /** Pinned under the content (e.g. Save): the sheet is full height, its content scrolls, and only the handle drags it. */
  footer?: ReactNode
}

// ponytail: no exit animation (needs AnimatePresence at every call site); add if the snap-close feels abrupt.
/** A sheet from the bottom; on desktop, a dialog in the middle of the screen. */
export function BottomSheet({ label, onClose, children, maxHeight, footer }: BottomSheetProps) {
  const ref = useRef<HTMLDivElement>(null)
  const drag = useDragControls()
  const dialog = useLayout() === 'desktop'

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

  const body = footer ? (
    <>
      <div className="-mx-5 flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto px-5 pb-4">{children}</div>
      <div className="-mx-5 -mt-[18px] border-t border-ui-hairline px-5 pt-3">{footer}</div>
    </>
  ) : children

  return (
    <UiPortal>
      <motion.div
        data-testid="sheet-backdrop"
        className="fixed inset-0 z-50 bg-ui-backdrop"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      />
      {dialog ? (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-6">
          <motion.div ref={ref} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} onKeyDown={onKeyDown}
            className="pointer-events-auto flex max-h-[85dvh] w-full max-w-[440px] flex-col gap-[18px] overflow-y-auto rounded-[24px] bg-ui-sheet p-6 shadow-[0_30px_60px_-16px_rgba(0,0,0,.35)] outline-none"
            initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.16 }}>
            {children}{footer}
          </motion.div>
        </div>
      ) : (
      <motion.div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        style={{ maxHeight }}
        // Tablet (useLayout's query): one practice column wide — (content − 2·36px padding − 16px gap) / 2 —
        // centred in the area right of the 88px rail; floored at a phone's width for the 640–767px single-column range.
        className={`fixed inset-x-0 bottom-0 z-50 [@media(min-width:640px)_and_(min-height:500px)]:left-[88px] [@media(min-width:640px)_and_(min-height:500px)]:mx-auto [@media(min-width:640px)_and_(min-height:500px)]:w-[max(375px,calc(50vw-88px))] flex max-h-[92dvh] flex-col gap-[18px] rounded-t-[28px] bg-ui-sheet px-5 pt-2.5 outline-none ${footer ? 'h-[92dvh] pb-[calc(12px+env(safe-area-inset-bottom))]' : 'overflow-y-auto pb-[calc(30px+env(safe-area-inset-bottom))]'}`}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        transition={{ type: 'tween', duration: 0.22, ease: 'easeOut' }}
        drag="y"
        dragControls={drag}
        dragListener={!footer}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.6 }}
        onDragEnd={(_, info) => { if (info.offset.y > CLOSE_DRAG_PX || info.velocity.y > 500) onClose() }}
      >
        <span aria-hidden onPointerDown={(e) => drag.start(e)}
          className="-my-2.5 flex h-6 w-20 shrink-0 touch-none items-center justify-center self-center">
          <span className="h-[5px] w-10 rounded-full bg-ui-control" />
        </span>
        {body}
      </motion.div>
      )}
    </UiPortal>
  )
}
