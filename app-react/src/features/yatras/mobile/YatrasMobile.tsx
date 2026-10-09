import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { yatrasApi } from '../../../api/yatras'
import { useAuthStore } from '../../../store/authStore'
import { AppBar } from '../../../layouts/mobile/AppBar'
import { MobileShell } from '../../../layouts/mobile/MobileShell'
import { BottomSheet } from '../../../ui/primitives/BottomSheet'
import { initials } from '../../../ui/initials'
import { cellText, formatDay } from '../../insights/insightsLogic'
import { CalendarSheet } from '../../today/mobile/CalendarSheet'
import { toDateStr } from '../../today/date'
import { StatTiles } from '../StatTiles'
import { findZone, heatmapWindow, heatmapZone, ZONE_BG } from '../yatrasLogic'
import { useYatras } from '../useYatras'
import { YatraSwitcherSheet } from './YatraSwitcherSheet'
import { dismissLater, laterDismissed, unlinked } from '../settings/linking'
import { joinNames } from '../settings/mobile/LinkPracticesMobile'
import type { UserYatraDataRow } from '../../../types/api'

const CARD = 'rounded-[18px] border border-ui-hairline bg-ui-surface'
export const TREND = { Up: '↗', Down: '↘', Flat: '→' } as const

export function YatrasMobile() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const y = useYatras()
  const [switching, setSwitching] = useState(false)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const units = { h: t('today.unitH'), min: t('today.unitMin') }
  const stability = y.yatra?.show_stability_metrics ?? false
  const data = y.data
  const userId = useAuthStore((s) => s.user?.id)
  const linksQ = useQuery({
    queryKey: ['yatra-user-practices', y.yatra?.id],
    queryFn: () => yatrasApi.getYatraUserPractices(y.yatra!.id),
    enabled: !!y.yatra,
  })
  const missing = unlinked(linksQ.data ?? [])
  const missingIds = missing.map((p) => p.id)
  const [, rerender] = useState(0) // Later writes localStorage; re-render to re-read it
  const showBanner = !!y.yatra && missing.length > 0 && !laterDismissed(y.yatra.id, missingIds)

  return (
    <>
      <AppBar title={<h1 className="text-[28px] font-extrabold tracking-[-0.02em] text-ui-ink">{t('nav.yatras')}</h1>}
        actions={y.yatra ? [{ label: t('yatras.settings'), onSelect: () => navigate(`/yatra/${y.yatra!.id}/settings`) }] : undefined} />
      <div className="flex flex-col gap-2 px-4 pb-6">
        {y.yatra && (
          <div className="flex items-center justify-between gap-2">
            <button type="button" aria-haspopup="dialog" onClick={() => setSwitching(true)}
              className="flex min-h-9 min-w-0 items-center gap-1 text-[17px] font-bold text-ui-accent">
              <span className="truncate">{y.yatra.name}</span>
              <span aria-hidden className="shrink-0">▾</span>
            </button>
            <button type="button" onClick={() => setCalendarOpen(true)}
              className="flex min-h-9 shrink-0 items-center gap-1 text-[13px] font-bold text-ui-muted">
              {y.isToday ? t('today.goToday') : formatDay(toDateStr(y.date), i18n.language || 'en')} <span aria-hidden>⌄</span>
            </button>
          </div>
        )}
        {showBanner && (
          <section className="flex flex-col gap-2.5 rounded-[18px] border border-ui-accent-pill bg-ui-accent-soft p-4">
            <h2 className="text-[15px] font-extrabold text-ui-ink">{t('yatraSettings.bannerTitle', { count: missing.length })}</h2>
            <p className="text-sm leading-normal text-ui-ink2">
              {t('yatraSettings.bannerText', { names: joinNames(missing.map((p) => p.practice), i18n.language || 'en') })}
            </p>
            <div className="flex gap-2.5">
              <Link to={`/yatra/${y.yatra!.id}/links`}
                className="flex h-11 items-center rounded-xl bg-ui-primary px-4 text-sm font-bold text-ui-on-primary">
                {t('yatraSettings.linkPractices')}
              </Link>
              <button type="button" onClick={() => { dismissLater(y.yatra!.id, missingIds); rerender((n) => n + 1) }}
                className="h-11 rounded-xl px-4 text-sm font-bold text-ui-ink">
                {t('yatraSettings.later')}
              </button>
            </div>
          </section>
        )}

        {y.isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <span role="status" aria-label={t('common.loading')}
              className="h-6 w-6 animate-spin rounded-full border-2 border-ui-control border-t-ui-accent" />
          </div>
        ) : y.isError ? (
          <p role="alert" className="py-10 text-center text-sm text-ui-danger">{t('common.error')}</p>
        ) : !y.yatra ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <p className="text-[15px] font-bold text-ui-ink">{t('yatras.noYet')}</p>
            <p className="text-sm text-ui-muted">{t('yatras.createCircle')}</p>
            <button type="button" onClick={() => setCreating(true)}
              className="mt-3 h-[50px] rounded-[14px] bg-ui-primary px-6 text-[15px] font-bold text-ui-on-primary">
              {t('yatras.createButton')}
            </button>
          </div>
        ) : data && data.data.length === 0 ? (
          <p className="py-10 text-center text-sm text-ui-muted">{t('yatras.noEntries')}</p>
        ) : data && (
          <>
            {y.yatra && <StatTiles yatra={y.yatra} data={data} />}
            <ul className="flex flex-col gap-2">
              {data.data.map((row) => (
                <MemberCard key={row.user_id} row={row} stability={stability}
                  cells={data.practices.map((p, j) => {
                    const notLinked = row.user_id === userId && missingIds.includes(p.id)
                    return {
                      name: p.practice,
                      text: notLinked ? t('yatraSettings.notLinkedCell') : cellText(row.row[j], p.data_type, units) || '—',
                      bg: !notLinked && p.colour_zones ? ZONE_BG[findZone(row.row[j], p.colour_zones)] : '',
                      muted: notLinked,
                    }
                  })} />
              ))}
            </ul>
            {stability && (
              <section className={`${CARD} mt-2 flex flex-col gap-2 px-3.5 py-3`}>
                <h2 className="text-xs font-bold text-ui-muted">{t('yatras.stability14')}</h2>
                {data.data.map((row) => {
                  const days = heatmapWindow(data.stability_heatmap_days, y.isToday)
                  return (
                    <div key={row.user_id} className="flex items-center gap-2">
                      <span title={row.user_name} className="w-7 shrink-0 text-[11px] font-extrabold text-ui-ink">{initials(row.user_name)}</span>
                      <div className="grid flex-1 grid-cols-[repeat(14,1fr)] gap-[3px]">
                        {heatmapWindow(row.stability_heatmap, y.isToday).map((score, i) => (
                          <span key={i} title={`${days[i]}: ${score > 0 ? `${score}%` : '—'}`}
                            className={`h-3.5 rounded-[3px] ${ZONE_BG[heatmapZone(score)] || 'bg-ui-chip'}`} />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </section>
            )}
          </>
        )}
      </div>

      {switching && (
        <YatraSwitcherSheet yatras={y.yatras} currentId={y.yatra?.id} onSelect={y.select} onClose={() => setSwitching(false)}
          pending={y.create.isPending}
          create={(name) => y.create.mutate(name, { onSuccess: (created) => { setSwitching(false); navigate(`/yatra/${created.id}/settings`) } })} />
      )}
      {calendarOpen && <CalendarSheet date={y.date} onSelect={y.setDate} onClose={() => setCalendarOpen(false)} />}
      {creating && <CreateSheet onClose={() => setCreating(false)} create={(name) => y.create.mutate(name, { onSuccess: () => setCreating(false) })} pending={y.create.isPending} />}
    </>
  )
}

interface Cell { name: string; text: string; bg: string; muted?: boolean }

function MemberCard({ row, stability, cells }: { row: UserYatraDataRow; stability: boolean; cells: Cell[] }) {
  const { t } = useTranslation()
  return (
    <li className={`${CARD} flex flex-col gap-2.5 px-3.5 py-3`}>
      <div className="flex items-center gap-2.5">
        <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ui-chip text-[11px] font-extrabold">{initials(row.user_name)}</span>
        <span className="min-w-0 flex-1 truncate text-[15px] font-bold text-ui-ink">{row.user_name}</span>
        {stability && (
          <span className="font-ui-mono text-[13px] text-ui-muted">{t('yatras.trend7d')} {row.trend_arrow ? TREND[row.trend_arrow] : '·'}</span>
        )}
      </div>
      <dl className="grid grid-cols-4 gap-1.5">
        {cells.map((c, i) => (
          <div key={i} className={`flex min-w-0 flex-col rounded-lg ${c.bg ? `${c.bg} px-1.5 py-0.5` : 'py-0.5'}`}>
            <dt className="truncate text-[10px] font-bold tracking-[.06em] text-ui-muted uppercase">{c.name}</dt>
            <dd className={`truncate font-ui-mono font-semibold ${c.muted ? 'text-[11px] text-ui-faint2' : 'text-[15px] text-ui-ink'}`}>{c.text}</dd>
          </div>
        ))}
      </dl>
    </li>
  )
}

export function CreateSheet({ onClose, create, pending }: { onClose: () => void; create: (name: string) => void; pending: boolean }) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const submit = () => { if (name.trim()) create(name.trim()) }
  return (
    <BottomSheet label={t('yatras.newTitle')} onClose={onClose}>
      <div className="flex flex-col gap-1.5">
        <h2 className="text-xl font-extrabold text-ui-ink">{t('yatras.newTitle')}</h2>
        <p className="text-sm text-ui-muted">{t('yatras.newSubtitle')}</p>
      </div>
      <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
        placeholder={t('yatras.namePlaceholder')} aria-label={t('yatras.namePlaceholder')}
        className="h-[50px] rounded-[14px] border border-ui-control bg-ui-field px-4 font-semibold text-ui-ink outline-none" />
      <div className="grid grid-cols-[1fr_2fr] gap-2.5">
        <button type="button" onClick={onClose}
          className="h-[50px] rounded-[14px] border border-ui-control text-[15px] font-bold text-ui-ink">
          {t('common.cancel')}
        </button>
        <button type="button" disabled={!name.trim() || pending} onClick={submit}
          className="h-[50px] rounded-[14px] bg-ui-primary text-[15px] font-bold text-ui-on-primary disabled:opacity-60">
          {t('yatras.createButton')}
        </button>
      </div>
    </BottomSheet>
  )
}

export function YatrasMobileScreen() {
  return (
    <MobileShell>
      <YatrasMobile />
    </MobileShell>
  )
}
