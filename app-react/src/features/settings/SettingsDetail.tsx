import { useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { practicesApi } from '../../api/practices'
import { DesktopShell } from '../../layouts/desktop/DesktopShell'
import { MobileShell } from '../../layouts/mobile/MobileShell'
import { TabletShell } from '../../layouts/tablet/TabletShell'
import { useLayout } from '../../layouts/useLayout'
import { useAuthStore } from '../../store/authStore'
import { initials } from '../../ui/initials'
import { openInBrowser } from '../../ui/openInBrowser'
import { useTheme } from '../../ui/useTheme'
import { LogoutSheet } from './mobile/LogoutSheet'
import { isPreview } from './releaseChannel'
import { LANGS, useMyCharts, useMyYatras } from './sections'

const GROUP = 'px-3 pt-5 pb-1 text-[11px] font-bold uppercase tracking-[.1em] text-ui-muted'

/** Tablet and desktop: every Settings row in a column beside the page, the open one highlighted. */
function SettingsColumn() {
  const { t, i18n } = useTranslation()
  const { pathname } = useLocation()
  const user = useAuthStore((s) => s.user)
  const [theme] = useTheme()
  const [logoutOpen, setLogoutOpen] = useState(false)
  const practices = useQuery({ queryKey: ['practices'], queryFn: practicesApi.getUserPractices }).data
  const charts = useMyCharts().length
  const yatras = useMyYatras().length
  const lang = LANGS.find((l) => l.code === i18n.resolvedLanguage?.slice(0, 2)) ?? LANGS[0]
  const count = (n?: number) => (n ? String(n) : undefined)

  const item = (to: string, label: string, value?: string, active = pathname.startsWith(to)) => (
    <Link key={label} to={to} aria-current={active ? 'page' : undefined}
      className={`flex min-h-11 items-center gap-2 rounded-xl px-3 text-[15px] ${active ? 'bg-ui-accent-pill font-bold text-ui-ink' : 'font-semibold text-ui-ink2'}`}>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {value && <span className="shrink-0 text-[13px] font-medium text-ui-muted">{value}</span>}
    </Link>
  )
  const profileActive = pathname.startsWith('/settings/edit-user')

  return (
    <nav aria-label={t('nav.settings')}
      className="sticky top-0 flex h-dvh w-[272px] shrink-0 flex-col overflow-y-auto border-r border-ui-control px-3 pt-[calc(32px+env(safe-area-inset-top))] pb-[calc(24px+env(safe-area-inset-bottom))]">
      <Link to="/settings" className="px-3 pb-4 text-[26px] leading-tight font-extrabold tracking-[-0.02em] text-ui-ink">{t('nav.settings')}</Link>
      <Link to="/settings/edit-user" aria-current={profileActive ? 'page' : undefined}
        className={`flex items-center gap-2.5 rounded-[14px] border p-2.5 ${profileActive ? 'border-transparent bg-ui-accent-pill' : 'border-ui-hairline bg-ui-surface'}`}>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ui-selected text-xs font-extrabold text-ui-on-selected">
          {initials(user?.name ?? '')}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-[15px] font-extrabold text-ui-ink">{user?.name}</span>
          <span className="text-xs text-ui-muted">{t('settings.userDetails')}</span>
        </span>
      </Link>
      {/* Preferences are changed on the Settings page itself; here they show where they stand. */}
      <p className={GROUP}>{t('settings.preferences')}</p>
      {item('/settings', t('settings.language'), lang.name, false)}
      {item('/settings', t('settings.theme'), t(`settings.theme${theme[0].toUpperCase()}${theme.slice(1)}`), false)}
      {item('/settings', t('settings.previewChannel'), t(isPreview() ? 'settings.on' : 'settings.off'), false)}
      <p className={GROUP}>{t('settings.yourSadhana')}</p>
      {item('/settings/charts', t('insights.title'), count(charts))}
      {item('/settings/yatras', t('settings.yatras'), count(yatras))}
      {item('/settings/practices', t('practices.title'), count(practices?.length))}
      <p className={GROUP}>{t('settings.accountData')}</p>
      {item('/settings/edit-password', t('settings.changePassword'))}
      {item('/settings/import', t('settings.importCsv'))}
      <p className={GROUP}>{t('settings.support')}</p>
      {item('/help', t('settings.helpSupport'))}
      <a href="https://sadhana.pro" target="_blank" rel="noopener noreferrer" onClick={openInBrowser}
        className="flex min-h-11 items-center gap-2 rounded-xl px-3 text-[15px] font-semibold text-ui-ink2">
        <span className="min-w-0 flex-1 truncate">{t('settings.aboutShort')}</span>
        <span aria-hidden className="shrink-0 text-[13px] text-ui-muted">↗</span>
      </a>
      <div className="mt-auto pt-4">
        <button type="button" onClick={() => setLogoutOpen(true)}
          className="flex min-h-11 w-full items-center rounded-xl px-3 text-left text-[15px] font-bold text-ui-danger">{t('settings.logout')}</button>
      </div>
      {logoutOpen && <LogoutSheet onClose={() => setLogoutOpen(false)} />}
    </nav>
  )
}

/** Primary action: full width at the bottom on mobile, its own size at the right on wider layouts. */
export const PRIMARY = 'flex min-h-[50px] items-center justify-center gap-2 rounded-full bg-ui-accent-fill px-6 text-[15px] font-extrabold text-ui-ink disabled:opacity-45'
export const SECONDARY = 'flex min-h-[50px] items-center justify-center rounded-full border border-ui-control bg-ui-surface px-6 text-[15px] font-bold text-ui-ink'
export const SPINNER = 'h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent'
export const LABEL = 'text-[13px] font-bold text-ui-ink2'
export const FIELD_ERROR = 'flex items-center gap-1.5 text-xs font-semibold text-ui-danger before:h-1.5 before:w-1.5 before:shrink-0 before:rounded-full before:bg-current'

/** A failure that keeps what was typed: a title and what to do. */
export function ErrorBanner({ title, text }: { title: string; text: string }) {
  return (
    <div role="alert" className="flex gap-2.5 rounded-[14px] border border-ui-danger/25 bg-ui-danger/10 px-4 py-3">
      <span aria-hidden className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-ui-danger" />
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-extrabold text-ui-ink">{title}</span>
        <span className="text-[13px] leading-normal text-ui-ink2">{text}</span>
      </span>
    </div>
  )
}

export interface DetailProps {
  title: string
  /** Default: Settings. On tablet and desktop it's shown only when given (the column already leads to Settings). */
  back?: { label: string } & ({ to: string } | { onClick: () => void })
  subtitle?: ReactNode
  /** The page's buttons: a bar at the bottom on mobile, under the content on the right elsewhere. */
  footer?: ReactNode
  /** Desktop: let the content use the full width (e.g. Help's two columns). */
  wide?: boolean
  children: ReactNode
}

/** A page under Settings: mobile is a page with a back link; tablet and desktop keep the settings column beside it. */
export function SettingsDetail({ title, back, subtitle, footer, wide, children }: DetailProps) {
  const { t } = useTranslation()
  const layout = useLayout()
  const up = back ?? { to: '/settings', label: t('nav.settings') }
  const backLink = (cls: string) => 'to' in up
    ? <Link to={up.to} className={cls}><span aria-hidden>‹</span>{up.label}</Link>
    : <button type="button" onClick={up.onClick} className={cls}><span aria-hidden>‹</span>{up.label}</button>
  const heading = (
    <div className="flex flex-col gap-0.5">
      <h1 className="text-[28px] leading-[1.15] font-extrabold tracking-[-0.02em] break-words text-ui-ink lg:text-[30px]">{title}</h1>
      {subtitle && <p className="text-sm text-ui-muted">{subtitle}</p>}
    </div>
  )

  if (layout === 'mobile') return (
    <MobileShell tabBar={!footer}>
      <div className="flex min-h-dvh flex-col">
        <header className="sticky top-0 z-30 bg-ui-bg pt-[env(safe-area-inset-top)]">
          <div className="flex min-h-11 items-center px-2">
            {backLink('flex min-h-11 items-center gap-1 px-2 text-[17px] font-semibold text-ui-accent')}
          </div>
        </header>
        <div className="px-5 pb-4">{heading}</div>
        <div className="flex flex-1 flex-col gap-4 px-4 pb-8">{children}</div>
        {footer && (
          <div className="sticky bottom-0 z-30 flex flex-col gap-2.5 border-t border-ui-hairline bg-ui-bg px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] [&>*]:w-full">
            {footer}
          </div>
        )}
      </div>
    </MobileShell>
  )

  const page = (
    <div className="flex min-h-dvh">
      <SettingsColumn />
      <main className="flex min-w-0 flex-1 flex-col gap-4 px-8 pt-[calc(32px+env(safe-area-inset-top))] pb-10 xl:px-14">
        <div className={`flex flex-col gap-4 ${wide && layout === 'desktop' ? 'max-w-[900px]' : 'max-w-[560px]'}`}>
          {back && backLink('-mb-2 flex min-h-9 items-center gap-1 self-start text-[15px] font-semibold text-ui-accent')}
          {heading}
          {children}
          {footer && <div className="flex flex-wrap items-center justify-end gap-2.5">{footer}</div>}
        </div>
      </main>
    </div>
  )
  return layout === 'tablet' ? <TabletShell>{page}</TabletShell> : <DesktopShell log={false}>{() => page}</DesktopShell>
}
