import { AnimatePresence, motion } from 'framer-motion'
import { LuX } from 'react-icons/lu'
import { useToastStore, type ToastVariant } from '../../hooks/useToast'
import { TEXT, TEXT_MUTED, BORDER } from '../../theme/tokens'

const BORDER_COLOR: Record<ToastVariant, string> = {
  success: '#3fb98f',
  error:   '#e11d48',
  warning: '#d97706',
  info:    '#3b82f6',
}

export function ToastContainer() {
  const { toasts, dismiss } = useToastStore()
  return (
    <div
      className="fixed bottom-24 left-1/2 -translate-x-1/2 sm:top-4 sm:right-4 sm:bottom-auto sm:translate-x-0 sm:left-auto z-[200] flex flex-col gap-2 pointer-events-none"
      aria-live="polite"
    >
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl min-w-[220px] max-w-xs"
            style={{
              background: 'rgba(39,54,86,0.95)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: `1px solid ${BORDER}`,
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
              borderLeft: `4px solid ${BORDER_COLOR[toast.variant]}`,
            }}
          >
            <span className="flex-1 text-sm font-medium" style={{ color: TEXT }}>{toast.message}</span>
            <button
              onClick={() => dismiss(toast.id)}
              className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full"
              style={{ background: 'rgba(255,255,255,0.08)', color: TEXT_MUTED, border: 'none', cursor: 'pointer' }}
              aria-label="Dismiss"
            >
              <LuX className="w-3 h-3" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
