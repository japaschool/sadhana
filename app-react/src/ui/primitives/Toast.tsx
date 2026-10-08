import { AnimatePresence, motion } from 'framer-motion'
import { useToastStore } from '../../hooks/useToast'

/** Toasts above the tab bar, in the new design's colours; an action (Undo) dismisses the toast. */
export function UiToastContainer() {
  const { toasts, dismiss } = useToastStore()
  return (
    <div aria-live="polite"
      className="pointer-events-none fixed inset-x-4 bottom-[calc(84px+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div key={toast.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className={`pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-[14px] px-4 py-3 shadow-lg ${toast.variant === 'error' ? 'bg-ui-danger text-white' : 'bg-ui-primary text-ui-on-primary'}`}>
            <span className="min-w-0 flex-1 text-sm font-semibold">{toast.message}</span>
            {toast.action && (
              <button type="button" onClick={() => { dismiss(toast.id); toast.action!.onClick() }}
                className="shrink-0 text-sm font-extrabold text-ui-accent-fill">
                {toast.action.label}
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
