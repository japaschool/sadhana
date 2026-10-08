import { AnimatePresence, motion } from 'framer-motion'
import { useToastStore } from '../../hooks/useToast'

/** Toasts at the top of the screen, newest first, so they never cover sheets or the fields being edited. An action (Undo) dismisses the toast. */
export function UiToastContainer() {
  const { toasts, dismiss } = useToastStore()
  return (
    <div aria-live="polite"
      className="pointer-events-none fixed inset-x-4 top-[calc(8px+env(safe-area-inset-top))] z-[60] flex flex-col items-center gap-2">
      <AnimatePresence>
        {[...toasts].reverse().map((toast) => (
          <motion.div key={toast.id} initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
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
