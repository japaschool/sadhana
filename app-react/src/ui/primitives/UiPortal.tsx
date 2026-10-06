import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

/** Portals to <body> inside a .ui-root wrapper so theme tokens resolve. */
export function UiPortal({ children }: { children: ReactNode }) {
  return createPortal(<div className="ui-root">{children}</div>, document.body)
}
