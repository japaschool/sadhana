import { useState } from 'react'
import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { openInBrowser } from '../../ui/openInBrowser'
import { apiClient } from '../../api/client'
import { useLayout } from '../../layouts/useLayout'
import { ListGroup } from '../../ui/primitives/ListGroup'
import { SettingsDetail } from './SettingsDetail'

/** How-to videos on YouTube, in the order they're listed. */
const VIDEOS = [
  ['registration', 'Hw1DQ3sRNAk'],
  ['iosWebApp', 'KBViu8I4cJI'],
  ['addPractice', 'cbQ5aVXvXiU'],
  ['renamePractice', 'jVfngYlbA68'],
  ['addGraph', 'gJ9jqB-nGtg'],
  ['graphAverage', 'qqLOm_HZYWk'],
  ['graphSeveral', 'WY8LUyf_NaM'],
  ['barLayouts', 'QbW1nANFX-w'],
  ['addTable', 'Bg8eAmoT-_I'],
] as const

const ROW = 'flex min-h-[60px] w-full items-center gap-3 bg-ui-surface px-3.5 py-2.5 text-left'

function Chevron({ open }: { open: boolean }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={`h-[18px] w-[18px] shrink-0 transition-transform ${open ? 'rotate-180 text-ui-accent' : 'text-ui-muted'}`}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

/** One item of the accordion: a header button and, when open, its body. */
function Item({ id, icon, title, open, onToggle, children }: {
  id: string; icon: ReactNode; title: string; open: boolean; onToggle: () => void; children: ReactNode
}) {
  return (
    <div className="bg-ui-surface">
      <button type="button" aria-expanded={open} aria-controls={`${id}-body`} onClick={onToggle} className={ROW}>
        {icon}
        <span className="min-w-0 flex-1 text-[15px] font-bold text-ui-ink">{title}</span>
        <Chevron open={open} />
      </button>
      {open && <div id={`${id}-body`} className="px-3.5 pb-3.5">{children}</div>}
    </div>
  )
}

const PLAY = <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ui-accent-pill pl-0.5 text-xs text-ui-ink">▶</span>
const PAGE = <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ui-chip text-sm text-ui-ink2">▤</span>

function Faq() {
  const { t } = useTranslation()
  // One accordion across videos and guides: opening one closes the other.
  const [open, setOpen] = useState<string | null>(null)
  const toggle = (id: string) => () => setOpen((o) => (o === id ? null : id))
  return (
    <>
      <ListGroup label={t('help.videos')}>
        {VIDEOS.map(([key, video]) => (
          <Item key={key} id={`video-${key}`} icon={PLAY} title={t(`help.video.${key}`)} open={open === key} onToggle={toggle(key)}>
            <iframe className="aspect-video w-full rounded-xl" src={`https://www.youtube.com/embed/${video}`} title={t(`help.video.${key}`)}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin" allowFullScreen />
          </Item>
        ))}
      </ListGroup>
      <ListGroup label={t('help.guides')}>
        <Item id="guide-yatra" icon={PAGE} title={t('help.yatraMatching.title')} open={open === 'yatra'} onToggle={toggle('yatra')}>
          <div className="flex flex-col gap-3 text-sm leading-normal text-ui-ink2">
            <p>{t('help.yatraMatching.intro')}</p>
            <div className="grid grid-cols-2 gap-2.5">
              {(['unmatched', 'matched'] as const).map((k) => (
                <figure key={k} className="flex flex-col gap-1.5">
                  <img src={`/images/faq/yatra-mapping-${k}.png`} alt={t(`help.yatraMatching.${k}Alt`)}
                    className="w-full rounded-xl border border-ui-hairline" />
                  <figcaption className="text-xs font-bold text-ui-ink2">{t(`help.yatraMatching.${k}`)}</figcaption>
                </figure>
              ))}
            </div>
            <ul className="flex flex-col gap-2">
              {(['empty', 'missing'] as const).map((k) => (
                <li key={k} className="flex gap-2.5">
                  <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-ui-accent-fill" />
                  <span><b className="text-ui-ink">{t(`help.yatraMatching.${k}`)}</b> {t(`help.yatraMatching.${k}Fix`)}</span>
                </li>
              ))}
            </ul>
          </div>
        </Item>
      </ListGroup>
    </>
  )
}

function Contact() {
  const { t } = useTranslation()
  const row = 'flex min-h-[60px] items-center gap-3 bg-ui-surface px-4 py-2.5'
  const text = (title: string, sub: string) => (
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="text-[15px] font-bold text-ui-ink">{title}</span>
      <span className="text-xs text-ui-muted">{sub}</span>
    </span>
  )
  return (
    <ListGroup label={t('help.contact')}>
      <Link to="/help/support-form" className={row}>
        {text(t('support.title'), t('help.replyByEmail'))}
        <span aria-hidden className="text-lg text-ui-faint2">›</span>
      </Link>
      <a href="https://t.me/sadhanapro" target="_blank" rel="noopener noreferrer" onClick={openInBrowser} className={row}>
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

export function Help() {
  const { t } = useTranslation()
  // Desktop: contact sits beside the FAQ. Mobile and tablet: after it.
  if (useLayout() === 'desktop') return (
    <SettingsDetail title={t('settings.helpSupport')} wide>
      <div className="grid grid-cols-[minmax(0,1fr)_260px] items-start gap-5">
        <div className="flex flex-col gap-[18px]"><Faq /><Build /></div>
        <Contact />
      </div>
    </SettingsDetail>
  )
  return (
    <SettingsDetail title={t('settings.helpSupport')}>
      <div className="flex flex-col gap-[18px]"><Faq /><Contact /><Build /></div>
    </SettingsDetail>
  )
}
