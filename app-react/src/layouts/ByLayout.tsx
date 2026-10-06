import type { ReactNode } from 'react'
import { useLayout } from './useLayout'

interface ByLayoutProps {
  mobile?: ReactNode
  tablet?: ReactNode
  desktop?: ReactNode
  legacy: ReactNode
}

/** Renders the current layout's element, or `legacy` until that layout is redesigned. */
export function ByLayout({ legacy, ...layouts }: ByLayoutProps) {
  return <>{layouts[useLayout()] ?? legacy}</>
}
