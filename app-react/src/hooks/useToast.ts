import { create } from 'zustand'

export type ToastVariant = 'success' | 'error' | 'info' | 'warning'

export interface Toast {
  id: string
  message: string
  variant: ToastVariant
}

interface ToastStore {
  toasts: Toast[]
  showToast: (opts: { message: string; variant: ToastVariant }) => void
  dismiss: (id: string) => void
}

// Store timeout IDs to cancel them on manual dismiss
const timers = new Map<string, ReturnType<typeof setTimeout>>()

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  showToast: ({ message, variant }) => {
    const id = Math.random().toString(36).slice(2)
    set((s) => ({
      toasts: [...s.toasts.slice(-2), { id, message, variant }],
    }))
    const timer = setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
      timers.delete(id)
    }, 3000)
    timers.set(id, timer)
  },
  dismiss: (id) => {
    const timer = timers.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.delete(id)
    }
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
  },
}))

export function useToast() {
  return { showToast: useToastStore((s) => s.showToast) }
}
