import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { DesktopShell } from '../../layouts/desktop/DesktopShell'
import { MobileShell } from '../../layouts/mobile/MobileShell'
import { TabletShell } from '../../layouts/tablet/TabletShell'
import { useLayout } from '../../layouts/useLayout'

export const ROWS = 'flex flex-col gap-px overflow-hidden rounded-[18px] border border-ui-hairline bg-ui-hairline'

/** "+ Add"-style pill for a subpage's header. */
export function AddPill({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-ui-accent-fill px-4 text-[15px] font-extrabold text-ui-ink">
      <span aria-hidden className="text-lg leading-none">+</span>{label}
    </button>
  )
}

/** A list one level under Settings (Insights, Yatras), with a back link to Settings, in the current layout's shell. */
export function SettingsSubpage({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  const { t } = useTranslation()
  const layout = useLayout()
  const back = (cls: string) => (
    <Link to="/settings" className={`flex items-center gap-1 font-semibold text-ui-accent ${cls}`}>
      <span aria-hidden>‹</span>{t('nav.settings')}
    </Link>
  )

  if (layout === 'mobile') return (
    <MobileShell>
      <header className="sticky top-0 z-30 bg-ui-bg pt-[env(safe-area-inset-top)]">
        <div className="flex min-h-14 items-center justify-between px-2 pr-4">
          {back('min-h-11 px-2 text-[17px]')}
          {action}
        </div>
      </header>
      <div className="flex flex-col gap-4 px-4 pb-8">
        <h1 className="px-1 text-[30px] leading-tight font-extrabold tracking-[-0.02em] text-ui-ink">{title}</h1>
        {children}
      </div>
    </MobileShell>
  )

  const page = (
    <div className={`flex flex-col gap-6 px-9 ${layout === 'tablet' ? 'pt-[calc(36px+env(safe-area-inset-top))]' : 'pt-8'} pb-9`}>
      <div className="flex max-w-[640px] flex-col gap-1">
        {back('-mb-1 min-h-9 self-start text-[15px]')}
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-[34px] leading-tight font-extrabold tracking-[-0.02em]">{title}</h1>
          {action}
        </div>
      </div>
      <div className="flex max-w-[640px] flex-col gap-4">{children}</div>
    </div>
  )
  return layout === 'tablet' ? <TabletShell>{page}</TabletShell> : <DesktopShell>{() => page}</DesktopShell>
}
