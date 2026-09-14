/**
 * Minimal framer-motion stub for tests.
 * - motion.div (and other motion elements) render as plain HTML elements.
 * - AnimatePresence renders children immediately without animation delays.
 */
import React from 'react'

export const motion = new Proxy(
  {},
  {
    get: (_target, tag: string) => {
      return React.forwardRef(
        (
          {
            children,
            initial: _i,
            animate: _a,
            exit: _e,
            transition: _t,
            whileHover: _wh,
            whileTap: _wt,
            ...rest
          }: React.HTMLAttributes<HTMLElement> & {
            initial?: unknown
            animate?: unknown
            exit?: unknown
            transition?: unknown
            whileHover?: unknown
            whileTap?: unknown
          },
          ref: React.Ref<HTMLElement>,
        ) => React.createElement(tag, { ...rest, ref }, children),
      )
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

export const useTransform = () => ({ get: () => 0 })

export const useScroll = () => ({ scrollYProgress: useMotionValue(0) })

// Reduced-motion is toggled from tests via __setReducedMotion; default is off.
let __reducedMotion = false
export const __setReducedMotion = (v: boolean) => {
  __reducedMotion = v
}
export const useReducedMotion = () => __reducedMotion
