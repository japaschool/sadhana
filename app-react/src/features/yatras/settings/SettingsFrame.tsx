import { useState } from 'react'
import type { ReactNode } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { DesktopShell } from '../../../layouts/desktop/DesktopShell'
import { MobileShell } from '../../../layouts/mobile/MobileShell'
import { TabletShell } from '../../../layouts/tablet/TabletShell'
import { useLayout } from '../../../layouts/useLayout'
import type { Yatra } from '../../../types/api'
import { AnchoredMenu, MenuItem } from '../../../ui/primitives/AnchoredMenu'
import { SettingsRow } from '../../settings/mobile/SettingsRow'
import { LeaveSheets } from './mobile/LeaveSheets'
import { useLinkPractices } from './useLinkPractices'
import { useYatraAdmin } from './useYatraAdmin'

type Back = { to: string; label: string }
type Links = ReturnType<typeof useLinkPractices>

const LIST = 'flex flex-col gap-px overflow-hidden rounded-[18px] border border-ui-hairline bg-ui-hairline'

/** Your links and the admin sections of one yatra, with their counts: the mobile hub's rows and the tablet/desktop column. */
function useSections(id: string) {
  const { t } = useTranslation()
  const a = useYatraAdmin(id)
  const l = useLinkPractices(id)
  const linked = l.items.filter((i) => i.user_practice).length
  const count = (n: number) => (n ? String(n) : undefined)
  const manage = [
    { key: 'general', label: t('yatraSettings.general') },
    { key: 'practices', label: t('yatraSettings.practices'), count: count(a.practices.length) },
    { key: 'members', label: t('yatraSettings.membersTitle'), count: count(a.users.length) },
    { key: 'statistics', label: t('yatraSettings.statistics'), count: count(a.yatra?.statistics?.statistics.length ?? 0) },
    { key: 'invite', label: t('yatraSettings.invite') },
    { key: 'danger', label: t('yatraSettings.danger'), danger: true },
  ].map((s) => ({ ...s, to: `/yatra/${id}/admin/${s.key}` }))
  return {
    a, l, manage,
    links: { to: `/yatra/${id}/links`, label: t('yatraSettings.yourLinks'), count: l.items.length ? `${linked} / ${l.items.length}` : undefined },
    loading: a.isLoading || l.isLoading,
    error: a.isError || l.isError,
  }
}

/** The yatra's name; picks another yatra, staying on the same section. */
function YatraSwitcher({ id, yatras, className }: { id: string; yatras: Yatra[]; className: string }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const name = yatras.find((y) => y.id === id)?.name
  if (!name) return null
  // A practice belongs to one yatra, so its editor goes back to the hub.
  const rest = /^\/yatra\/[^/]+\/(links|admin\/[a-z]+)$/.exec(pathname)?.[1] ?? 'settings'
  return (
    <>
      <button type="button" aria-haspopup="menu" onClick={(e) => setAnchor(e.currentTarget)}
        className={`flex min-h-8 min-w-0 items-center gap-1 self-start font-bold text-ui-accent ${className}`}>
        <span className="truncate">{name}</span><span aria-hidden className="shrink-0">▾</span>
      </button>
      {anchor && (
        <AnchoredMenu anchor={anchor} label={t('nav.yatras')} onClose={() => setAnchor(null)}>
          {yatras.map((y) => (
            <MenuItem key={y.id} selected={y.id === id} onSelect={() => { setAnchor(null); navigate(`/yatra/${y.id}/${rest}`) }}>{y.name}</MenuItem>
          ))}
        </AnchoredMenu>
      )}
    </>
  )
}

function LeaveYatra({ id, l, className }: { id: string; l: Links; className: string }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>{t('yatraSettings.leave')}</button>
      {open && l.yatra && (
        <LeaveSheets yatraId={id} yatraName={l.yatra.name}
          lastAdmin={!!l.me?.is_admin && l.users.filter((u) => u.is_admin).length === 1}
          leaving={l.leave.isPending} onClose={() => setOpen(false)}
          onLeave={() => l.leave.mutate(undefined, { onSuccess: () => navigate('/yatras', { replace: true }) })} />
      )}
    </>
  )
}

function AdminPill() {
  const { t } = useTranslation()
  return <span className="rounded-full bg-ui-accent-pill px-2 py-0.5 text-[11px] font-bold tracking-normal text-ui-accent normal-case">{t('yatraSettings.admin')}</span>
}

const GROUP_LABEL = 'flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.1em] text-ui-muted'

/** Tablet and desktop: the yatra's sections in a column beside the page. */
function SectionColumn({ id }: { id: string }) {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const s = useSections(id)
  const current = pathname.includes('/practice/') ? 'practices' : pathname.split('/').pop()
  const item = (key: string, to: string, label: string, count?: string, danger?: boolean) => {
    const active = key === current
    return (
      <Link key={key} to={to} aria-current={active ? 'page' : undefined}
        className={`flex min-h-11 items-center gap-2 rounded-xl px-3 text-[15px] ${active ? 'bg-ui-accent-pill font-bold text-ui-ink' : danger ? 'font-semibold text-ui-danger' : 'font-semibold text-ui-ink2'}`}>
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {count && <span className="shrink-0 font-ui-mono text-xs font-semibold text-ui-muted">{count}</span>}
      </Link>
    )
  }
  return (
    <nav aria-label={t('yatraSettings.hubTitle')}
      className="sticky top-0 flex h-dvh w-[248px] shrink-0 flex-col gap-1 overflow-y-auto border-r border-ui-control px-3 pt-[calc(32px+env(safe-area-inset-top))] pb-[calc(24px+env(safe-area-inset-bottom))]">
      <div className="flex flex-col gap-0.5 px-3 pb-4">
        <YatraSwitcher id={id} yatras={s.l.yatras} className="text-[13px]" />
        <p className="text-[22px] leading-tight font-extrabold tracking-[-0.01em] text-ui-ink">{t('yatraSettings.hubTitle')}</p>
      </div>
      <p className={`${GROUP_LABEL} px-3 pb-1`}>{t('yatraSettings.sectionYou')}</p>
      {item('links', s.links.to, s.links.label, s.links.count)}
      {s.a.isAdmin && (
        <>
          <p className={`${GROUP_LABEL} px-3 pt-5 pb-1`}>{t('yatraSettings.sectionManage')}<AdminPill /></p>
          {s.manage.map((m) => item(m.key, m.to, m.label, m.count, m.danger))}
        </>
      )}
      <div className="mt-auto pt-4">
        <LeaveYatra id={id} l={s.l} className="flex min-h-11 w-full items-center rounded-xl px-3 text-left text-[15px] font-bold text-ui-danger" />
      </div>
    </nav>
  )
}

function Status({ loading, error }: { loading: boolean; error: boolean }) {
  const { t } = useTranslation()
  if (loading) return (
    <div className="flex h-40 items-center justify-center">
      <span role="status" aria-label={t('common.loading')} className="h-6 w-6 animate-spin rounded-full border-2 border-ui-control border-t-ui-accent" />
    </div>
  )
  return error ? <p role="alert" className="py-10 text-center text-sm text-ui-danger">{t('common.error')}</p> : null
}

export interface FrameProps {
  title: ReactNode
  /** Mobile: the back link (default: the hub). Tablet: shown above the title only when given. */
  back?: Back
  /** Mobile only: under the title; the yatra's name by default. */
  subtitle?: ReactNode
  intro?: ReactNode
  /** Tablet and desktop: beside the title (e.g. "+ Add practice"). */
  action?: ReactNode
  /** Desktop only: a panel on the right (an editor). */
  aside?: ReactNode
  /** Desktop: let the content use the full width. */
  wide?: boolean
  loading: boolean
  error: boolean
  children: () => ReactNode
}

/** A yatra settings page in the current layout: mobile is a page with a back link; tablet and desktop put the section column beside it. */
export function SettingsFrame({ title, back, subtitle, intro, action, aside, wide, loading, error, children }: FrameProps) {
  const { t } = useTranslation()
  const { id = '' } = useParams()
  const layout = useLayout()
  const l = useLinkPractices(id)
  const ready = !loading && !error

  if (layout === 'mobile') {
    const up = back ?? { to: `/yatra/${id}/settings`, label: t('yatraSettings.hubTitle') }
    return (
      <MobileShell>
        <header className="sticky top-0 z-30 bg-ui-bg pt-[env(safe-area-inset-top)]">
          <div className="flex min-h-11 items-center px-2">
            <Link to={up.to} className="flex min-h-11 items-center gap-1 px-2 text-[17px] font-semibold text-ui-accent">
              <span aria-hidden>‹</span>{up.label}
            </Link>
          </div>
        </header>
        <div className="flex flex-col gap-0.5 px-5 pb-4">
          <h1 className="text-[28px] leading-[1.15] font-extrabold tracking-[-0.02em] break-words text-ui-ink">{title}</h1>
          {subtitle === undefined ? l.yatra && <p className="text-sm text-ui-muted">{l.yatra.name}</p> : subtitle}
          {intro && <p className="pt-1 text-sm leading-normal text-ui-ink2">{intro}</p>}
        </div>
        {ready ? <div className="flex flex-col gap-4 px-4 pb-8">{children()}</div> : <Status loading={loading} error={error} />}
      </MobileShell>
    )
  }

  const page = (
    <div className="flex min-h-dvh">
      <SectionColumn id={id} />
      <main className="flex min-w-0 flex-1 flex-col gap-4 px-8 pt-[calc(32px+env(safe-area-inset-top))] pb-10">
        {back && (
          <Link to={back.to} className="-mb-2 flex min-h-9 items-center gap-1 self-start text-[15px] font-semibold text-ui-accent">
            <span aria-hidden>‹</span>{back.label}
          </Link>
        )}
        <div className="flex items-start justify-between gap-4">
          <h1 className="min-w-0 text-[30px] leading-tight font-extrabold tracking-[-0.02em] break-words text-ui-ink">{title}</h1>
          {ready && action}
        </div>
        {intro && <p className="-mt-2 max-w-[640px] text-sm leading-normal text-ui-muted">{intro}</p>}
        {ready
          ? <div className={`flex flex-col gap-4 ${layout === 'desktop' && !wide ? 'max-w-[640px]' : ''}`}>{children()}</div>
          : <Status loading={loading} error={error} />}
      </main>
      {layout === 'desktop' && ready && aside && (
        <aside className="sticky top-0 flex h-dvh w-[400px] shrink-0 flex-col overflow-y-auto border-l border-ui-control bg-ui-sheet">{aside}</aside>
      )}
    </div>
  )
  return layout === 'tablet' ? <TabletShell>{page}</TabletShell> : <DesktopShell log={false}>{() => page}</DesktopShell>
}

/** A desktop side panel: eyebrow, title and ×, then the editor. */
export function SidePanel({ eyebrow, title, onClose, children }: { eyebrow: string; title: string; onClose: () => void; children: ReactNode }) {
  const { t } = useTranslation()
  return (
    <section aria-label={title} className="flex flex-col">
      <header className="sticky top-0 z-10 flex items-start gap-3 border-b border-ui-hairline bg-ui-sheet px-5 pt-6 pb-4">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[11px] font-bold uppercase tracking-[.1em] text-ui-accent">{eyebrow}</span>
          <h2 className="text-xl font-extrabold break-words text-ui-ink">{title}</h2>
        </div>
        <button type="button" aria-label={t('yatraSettings.close')} onClick={onClose}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ui-chip text-lg text-ui-muted">×</button>
      </header>
      <div className="flex flex-col gap-4 p-5">{children}</div>
    </section>
  )
}

/** /yatra/:id/settings: the hub on mobile; tablet and desktop have the column, so they open Your links. */
export function YatraSettingsHome() {
  const { id = '' } = useParams()
  const { search } = useLocation()
  return useLayout() === 'mobile' ? <HubMobile id={id} /> : <Navigate to={`/yatra/${id}/links${search}`} replace />
}

function HubMobile({ id }: { id: string }) {
  const { t } = useTranslation()
  const s = useSections(id)
  return (
    <SettingsFrame title={t('yatraSettings.hubTitle')} back={{ to: '/settings', label: t('nav.settings') }}
      subtitle={<YatraSwitcher id={id} yatras={s.l.yatras} className="text-[15px]" />} loading={s.loading} error={s.error}>
      {() => (
        <>
          <section aria-label={t('yatraSettings.sectionYou')} className="flex flex-col gap-2">
            <h2 className={`${GROUP_LABEL} px-1.5`}>{t('yatraSettings.sectionYou')}</h2>
            <div className={LIST}><SettingsRow label={s.links.label} value={s.links.count} to={s.links.to} /></div>
          </section>
          {s.a.isAdmin && (
            <section aria-label={t('yatraSettings.sectionManage')} className="flex flex-col gap-2">
              <h2 className={`${GROUP_LABEL} px-1.5`}>{t('yatraSettings.sectionManage')}<AdminPill /></h2>
              <div className={LIST}>
                {s.manage.map((m) => <SettingsRow key={m.key} label={m.label} value={m.count} to={m.to} danger={m.danger} />)}
              </div>
            </section>
          )}
          <div className={LIST}>
            <LeaveYatra id={id} l={s.l} className="flex min-h-[52px] items-center bg-ui-surface px-4 text-left text-[15px] font-bold text-ui-danger" />
          </div>
        </>
      )}
    </SettingsFrame>
  )
}
