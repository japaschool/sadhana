import type { MouseEvent, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { openInBrowser } from '../../../ui/openInBrowser'

interface SettingsRowProps {
  label: string
  hint?: string
  value?: string
  to?: string
  href?: string
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void
  control?: ReactNode
  accent?: boolean
  danger?: boolean
}

/** One row inside a ListGroup: a link (`to`), an external link (`href`), a button (`onClick`) or a control holder. */
export function SettingsRow({ label, hint, value, to, href, onClick, control, accent, danger }: SettingsRowProps) {
  const body = (
    <>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={`text-[15px] ${danger ? 'font-bold text-ui-danger' : accent ? 'font-bold text-ui-accent' : 'font-semibold text-ui-ink'}`}>{label}</span>
        {hint && <span className="text-xs font-medium leading-[1.4] text-ui-muted">{hint}</span>}
      </span>
      {control ?? (
        <span className="flex shrink-0 items-center gap-1.5">
          {value && <span className="text-[15px] font-medium text-ui-muted">{value}</span>}
          {/* ↗: opens outside the app, in the browser. */}
          <span aria-hidden className={href ? 'text-[15px] leading-none text-ui-faint2' : 'text-lg leading-none text-ui-faint2'}>{href ? '↗' : '›'}</span>
        </span>
      )}
    </>
  )
  const cls = `flex min-h-[52px] w-full items-center gap-3 bg-ui-surface px-4 text-left ${hint ? 'py-3' : 'py-2'}`
  if (to) return <Link to={to} className={cls}>{body}</Link>
  if (href) return <a href={href} target="_blank" rel="noopener noreferrer" onClick={openInBrowser} className={cls}>{body}</a>
  if (onClick) return <button type="button" onClick={onClick} className={cls}>{body}</button>
  return <div className={cls}>{body}</div>
}
