import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { openInBrowser } from '../../ui/openInBrowser'
import { apiClient } from '../../api/client'
import { useAuth } from '../../hooks/useAuth'
import { UiLoading } from '../../layouts/ByLayout'
import { useLayout } from '../../layouts/useLayout'
import { ListGroup } from '../../ui/primitives/ListGroup'
import { SettingsDetail } from './SettingsDetail'

const ROW = 'flex min-h-[60px] items-center gap-3 bg-ui-surface px-4 py-2.5'
const text = (title: string, sub: string) => (
  <span className="flex min-w-0 flex-1 flex-col">
    <span className="text-[15px] font-bold text-ui-ink">{title}</span>
    <span className="text-xs text-ui-muted">{sub}</span>
  </span>
)

/** The guides live on the site (static-react, /help/), in the app's language. */
function Guides() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage?.slice(0, 2)
  const href = `https://sadhana.pro/${lang === 'ru' || lang === 'uk' ? `${lang}/` : ''}help/`
  return (
    <ListGroup label={t('help.guides')}>
      <a href={href} target="_blank" rel="noopener noreferrer" onClick={openInBrowser} className={ROW}>
        {text(t('help.guidesLink'), t('help.opensSite'))}
        <span aria-hidden className="text-ui-faint2">↗</span>
      </a>
    </ListGroup>
  )
}

function Contact() {
  const { t } = useTranslation()
  return (
    <ListGroup label={t('help.contact')}>
      <Link to="/help/support-form" className={ROW}>
        {text(t('support.title'), t('help.replyByEmail'))}
        <span aria-hidden className="text-lg text-ui-faint2">›</span>
      </Link>
      <a href="https://t.me/sadhanapro" target="_blank" rel="noopener noreferrer" onClick={openInBrowser} className={ROW}>
        {text(t('help.telegram'), t('help.opensTelegram'))}
        <span aria-hidden className="text-ui-faint2">↗</span>
      </a>
    </ListGroup>
  )
}

function Build() {
  const { t } = useTranslation()
  const v = useQuery({
    queryKey: ['version'],
    queryFn: async () => (await apiClient.get<{ git_sha: string; release_channel: string }>('/version')).data,
    staleTime: Infinity,
  }).data
  if (!v) return null
  return (
    <p className="text-center font-ui-mono text-xs text-ui-muted">
      {t('help.build', { sha: v.git_sha })} · <span className={v.release_channel === 'preview' ? 'rounded bg-ui-accent-pill px-1.5 py-0.5 font-semibold text-ui-ink' : ''}>{v.release_channel}</span>
    </p>
  )
}

/** Signed out (from Sign in): no shell, just the page and a way back. */
function GuestHelp() {
  const { t } = useTranslation()
  return (
    <div className="ui-root min-h-dvh bg-ui-bg text-ui-ink">
      <div className="mx-auto flex max-w-[640px] flex-col gap-4 px-4 pt-[env(safe-area-inset-top)] pb-[calc(32px+env(safe-area-inset-bottom))]">
        <Link to="/login" className="flex min-h-11 items-center gap-1 self-start pt-2 text-[17px] font-semibold text-ui-accent">
          <span aria-hidden>‹</span>{t('auth.signIn')}
        </Link>
        <h1 className="px-1 text-[28px] leading-[1.15] font-extrabold tracking-[-0.02em] text-ui-ink">{t('settings.helpSupport')}</h1>
        <Guides /><Contact /><Build />
      </div>
    </div>
  )
}

export function Help() {
  const { t } = useTranslation()
  const { isAuthenticated, isLoading } = useAuth()
  const layout = useLayout()
  if (isLoading) return <UiLoading />
  if (!isAuthenticated) return <GuestHelp />
  // Desktop: contact sits beside the guides. Mobile and tablet: after it.
  if (layout === 'desktop') return (
    <SettingsDetail title={t('settings.helpSupport')} wide>
      <div className="grid grid-cols-[minmax(0,1fr)_260px] items-start gap-5">
        <div className="flex flex-col gap-[18px]"><Guides /><Build /></div>
        <Contact />
      </div>
    </SettingsDetail>
  )
  return (
    <SettingsDetail title={t('settings.helpSupport')}>
      <div className="flex flex-col gap-[18px]"><Guides /><Contact /><Build /></div>
    </SettingsDetail>
  )
}
