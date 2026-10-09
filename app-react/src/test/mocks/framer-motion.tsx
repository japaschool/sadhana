/**
 * Minimal framer-motion stub for tests.
 * - motion.div (and other motion elements) render as plain HTML elements.
 * - AnimatePresence renders children immediately without animation delays.
 */
import React from 'react'

// One component per tag: a fresh one on every access would remount the element on every render.
const cache = new Map<string, unknown>()

export const motion = new Proxy(
  {},
  {
    get: (_target, tag: string) => {
      if (!cache.has(tag)) cache.set(tag, React.forwardRef(
        (
          {
            children,
            initial: _i,
            animate: _a,
            exit: _e,
            transition: _t,
            whileHover: _wh,
            whileTap: _wt,
            drag: _d,
            dragConstraints: _dc,
            dragElastic: _de,
            onDragEnd: _ode,
            onDragStart: _ods,
            dragControls: _dctl,
            dragListener: _dl,
            dragDirectionLock: _ddl,
            ...rest
          }: React.HTMLAttributes<HTMLElement> & {
            initial?: unknown
            animate?: unknown
            exit?: unknown
            transition?: unknown
            whileHover?: unknown
            whileTap?: unknown
            drag?: unknown
            dragConstraints?: unknown
            dragElastic?: unknown
            onDragEnd?: unknown
            onDragStart?: unknown
            dragControls?: unknown
            dragListener?: unknown
            dragDirectionLock?: unknown
          },
          ref: React.Ref<HTMLElement>,
        ) => React.createElement(tag, { ...rest, ref }, children),
      ))
      return cache.get(tag)
    },
  },
) as unknown as typeof import('framer-motion').motion

export function AnimatePresence({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

export const useAnimation = () => ({
  start: () => Promise.resolve(),
  stop: () => {},
  set: () => {},
})

export const useMotionValue = (initial: number) => ({
  get: () => initial,
  set: () => {},
  onChange: () => () => {},
})

export const useDragControls = () => ({ start: () => {} })

export const useTransform = () => ({ get: () => 0 })

export const useScroll = () => ({ scrollYProgress: useMotionValue(0) })

// Reduced-motion is toggled from tests via __setReducedMotion; default is off.
let __reducedMotion = false
export const __setReducedMotion = (v: boolean) => {
  __reducedMotion = v
}
export const useReducedMotion = () => __reducedMotion
