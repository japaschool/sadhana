import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { TabletShell } from '../../../layouts/tablet/TabletShell'
import { AnchoredMenu, MenuItem } from '../../../ui/primitives/AnchoredMenu'
import { initials } from '../../../ui/initials'
import { cellText, formatDay } from '../../insights/insightsLogic'
import { CalendarSheet } from '../../today/mobile/CalendarSheet'
import { toDateStr } from '../../today/date'
import { findZone, heatmapWindow, heatmapZone, ZONE_BG } from '../yatrasLogic'
import { useYatras } from '../useYatras'
import { CreateSheet, TREND } from '../mobile/YatrasMobile'

const CARD = 'rounded-[20px] border border-ui-hairline bg-ui-surface'
const TH = 'border-b border-ui-hairline px-2.5 py-3 text-left align-bottom text-[11px] leading-tight font-bold tracking-[.06em] text-ui-faint uppercase'
const TD = 'border-b border-ui-hairline px-2.5 py-3'
const NAME_COL = 'sticky left-0 z-10 bg-ui-surface pl-5'

/** Tablet and desktop: the yatra as one table, a row per member. Desktop passes `fixedDate`: the log panel picks the day. */
export function YatrasTablet({ fixedDate = false }: { fixedDate?: boolean }) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const y = useYatras()
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)
  const [moreAnchor, setMoreAnchor] = useState<HTMLElement | null>(null)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const units = { h: t('today.unitH'), min: t('today.unitMin') }
  const stability = y.yatra?.show_stability_metrics ?? false
  const data = y.data

  const actions = [
    ...(y.yatra ? [{ label: t('yatras.settings'), onSelect: () => navigate(`/yatra/${y.yatra!.id}/settings`) }] : []),
    { label: t('yatras.createNewYatra'), onSelect: () => setCreating(true) },
  ]

  return (
    <div className="flex flex-col gap-[22px] px-9 pt-[calc(36px+env(safe-area-inset-top))] pb-9">
      <header className="flex flex-col gap-0.5">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-[34px] leading-tight font-extrabold tracking-[-0.02em]">{t('nav.yatras')}</h1>
          <button type="button" aria-label={t('today.more')} aria-haspopup="menu" onClick={(e) => setMoreAnchor(e.currentTarget)}
            className="flex h-11 w-11 shrink-0 items-center justify-center gap-[3px] rounded-full border border-ui-hairline bg-ui-surface">
            {[0, 1, 2].map((i) => <span key={i} className="h-1 w-1 rounded-full bg-ui-ink" />)}
          </button>
        </div>
        {y.yatra && (
          // Full width, so the day picker ends in line with the table below.
          <div className="flex items-center justify-between gap-4">
            <button type="button" aria-haspopup="menu" onClick={(e) => setMenuAnchor(e.currentTarget)}
              className="flex min-h-9 min-w-0 items-center gap-1.5 text-[15px] font-bold text-ui-accent">
              <span className="truncate">{y.yatra.name}</span>
              <span aria-hidden className="shrink-0">▾</span>
            </button>
            {!fixedDate && (
              <button type="button" onClick={() => setCalendarOpen(true)}
                className="flex min-h-9 shrink-0 items-center gap-1 text-[13px] font-bold text-ui-muted">
                {y.isToday ? t('today.goToday') : formatDay(toDateStr(y.date), i18n.language || 'en')} <span aria-hidden>⌄</span>
              </button>
            )}
          </div>
        )}
      </header>

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
          <div className={`${CARD} overflow-x-auto`}>
            <table className="min-w-full border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className={`${TH} ${NAME_COL}`}>{t('yatras.devotee')}</th>
                  {stability && <th className={TH}>{t('yatras.trend7d')}</th>}
                  {data.practices.map((p) => <th key={p.id} className={`${TH} min-w-[76px] last:pr-5`}>{p.practice}</th>)}
                </tr>
              </thead>
              <tbody className="[&_tr:last-child_td]:border-b-0">
                {data.data.map((row) => (
                  <tr key={row.user_id}>
                    <td className={`${TD} ${NAME_COL}`}>
                      <span className="flex items-center gap-2.5 text-sm font-bold whitespace-nowrap text-ui-ink">
                        <span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ui-chip text-[10px] font-extrabold">{initials(row.user_name)}</span>
                        {row.user_name}
                      </span>
                    </td>
                    {stability && <td className={`${TD} font-ui-mono text-sm text-ui-muted`}>{row.trend_arrow ? TREND[row.trend_arrow] : '·'}</td>}
                    {data.practices.map((p, j) => {
                      const bg = p.colour_zones ? ZONE_BG[findZone(row.row[j], p.colour_zones)] : ''
                      return (
                        <td key={p.id} className={`${TD} last:pr-5`}>
                          <span className={`inline-block rounded-lg font-ui-mono text-sm font-medium whitespace-nowrap text-ui-ink ${bg ? `${bg} -mx-1.5 px-1.5 py-0.5` : ''}`}>
                            {cellText(row.row[j], p.data_type, units) || '—'}
                          </span>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {stability && (
            <section className={`${CARD} flex flex-col gap-2.5 px-5 py-4`}>
              <h2 className="text-base font-extrabold text-ui-ink">{t('yatras.stability14')}</h2>
              {data.data.map((row) => {
                const days = heatmapWindow(data.stability_heatmap_days, y.isToday)
                return (
                  <div key={row.user_id} className="flex items-center gap-3">
                    <span className="w-[150px] shrink-0 truncate text-[13px] font-semibold text-ui-ink">{row.user_name}</span>
                    <div className="grid flex-1 grid-cols-[repeat(14,1fr)] gap-[3px]">
                      {heatmapWindow(row.stability_heatmap, y.isToday).map((score, i) => (
                        <span key={i} title={`${days[i]}: ${score > 0 ? `${score}%` : '—'}`}
                          className={`h-4 rounded-[3px] ${ZONE_BG[heatmapZone(score)] || 'bg-ui-chip'}`} />
                      ))}
                    </div>
                  </div>
                )
              })}
            </section>
          )}
        </>
      )}

      {menuAnchor && (
        <AnchoredMenu anchor={menuAnchor} label={t('nav.yatras')} onClose={() => setMenuAnchor(null)}>
          {y.yatras.map((it) => (
            <MenuItem key={it.id} selected={it.id === y.yatra?.id} onSelect={() => { y.select(it.id); setMenuAnchor(null) }}>{it.name}</MenuItem>
          ))}
        </AnchoredMenu>
      )}
      {moreAnchor && (
        <AnchoredMenu anchor={moreAnchor} label={t('today.more')} onClose={() => setMoreAnchor(null)}>
          {actions.map((a) => (
            <MenuItem key={a.label} onSelect={() => { setMoreAnchor(null); a.onSelect() }}>{a.label}</MenuItem>
          ))}
        </AnchoredMenu>
      )}
      {calendarOpen && <CalendarSheet date={y.date} onSelect={y.setDate} onClose={() => setCalendarOpen(false)} />}
      {creating && <CreateSheet onClose={() => setCreating(false)} create={(name) => y.create.mutate(name, { onSuccess: () => setCreating(false) })} pending={y.create.isPending} />}
    </div>
  )
}

export function YatrasTabletScreen() {
  return (
    <TabletShell>
      <YatrasTablet />
    </TabletShell>
  )
}
