import { useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { AnchoredMenu, MenuItem } from '../../ui/primitives/AnchoredMenu'

export interface AppBarAction { label: string; onSelect: () => void }

/** Sits below the status bar (safe-area aware). ⋯ shows the screen's own actions. */
export function AppBar({ title, actions }: { title: ReactNode; actions?: AppBarAction[] }) {
  const { t } = useTranslation()
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  return (
    <header className="sticky top-0 z-30 bg-ui-bg pt-[env(safe-area-inset-top)]">
      <div className="flex min-h-14 items-center justify-between py-1.5 pr-2 pl-5">
        <div className="min-w-0">{title}</div>
        {actions?.length ? (
          <button type="button" aria-label={t('today.more')} aria-haspopup="menu" onClick={(e) => setAnchor(e.currentTarget)}
            className="flex h-11 w-11 items-center justify-center gap-[3px] rounded-full border border-ui-hairline bg-ui-surface">
            {[0, 1, 2].map((i) => <span key={i} className="h-1 w-1 rounded-full bg-ui-ink" />)}
          </button>
        ) : null}
      </div>
      {anchor && actions && (
        <AnchoredMenu anchor={anchor} label={t('today.more')} onClose={() => setAnchor(null)}>
          {actions.map((a) => (
            <MenuItem key={a.label} onSelect={() => { setAnchor(null); a.onSelect() }}>{a.label}</MenuItem>
          ))}
        </AnchoredMenu>
      )}
    </header>
  )
}
