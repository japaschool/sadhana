import { useState } from 'react'
import type { MouseEvent, ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { yatrasApi } from '../../../../api/yatras'
import { useLayout } from '../../../../layouts/useLayout'
import { useAuthStore } from '../../../../store/authStore'
import type { UserPractice, YatraUserPracticeItem } from '../../../../types/api'
import { cellText } from '../../../insights/insightsLogic'
import { toDateStr } from '../../../today/date'
import { findZone, ZONE_BG } from '../../yatrasLogic'
import { pickerGroups, suggestions, unlinked } from '../linking'
import { SettingsFrame } from '../SettingsFrame'
import { useLinkPractices } from '../useLinkPractices'
import { LinkPickerSheet } from './LinkPickerSheet'
import { TypeChip, TypeIcon, typeLabelKey } from './TypeChip'

const CARD = 'rounded-[18px] border border-ui-hairline bg-ui-surface'

/** "A, B and C" in the UI language; ru/uk quote each name. */
export function joinNames(names: string[], lang: string): string {
  const quoted = lang.startsWith('en') ? names : names.map((n) => `«${n}»`)
  return new Intl.ListFormat(lang, { type: 'conjunction' }).format(quoted)
}

export function LinkPracticesMobile() {
  const { t, i18n } = useTranslation()
  const { id = '' } = useParams()
  const [params] = useSearchParams()
  const layout = useLayout()
  const wide = layout !== 'mobile'
  const s = useLinkPractices(id)
  const [picker, setPicker] = useState<{ id: string; anchor: HTMLElement } | null>(null)

  const missing = unlinked(s.items)
  const suggested = suggestions(s.items, s.practices)
  const total = s.items.length
  const linked = total - missing.length
  const joined = params.get('joined') === '1' && s.yatra ? s.yatra.name : null

  const summary = (
    <section className={`${CARD} flex flex-col gap-3 p-4`}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <span className="text-[22px] font-extrabold tracking-[-0.01em] text-ui-ink">
          {!total ? t('yatraSettings.noPracticesYet') : missing.length ? t('yatraSettings.countLinked', { linked, total }) : t('yatraSettings.allLinked', { total })}
        </span>
        <span className="flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap text-ui-muted">
          <span className="h-[7px] w-[7px] rounded-full bg-ui-good" />{t('yatraSettings.savesAsYouGo')}
        </span>
      </div>
      <div className="flex gap-1" aria-hidden>
        {s.items.map((i) => (
          <span key={i.yatra_practice.id}
            className={`h-2 flex-1 rounded ${i.user_practice ? 'bg-ui-good' : 'border-[1.5px] border-dashed border-ui-faint'}`} />
        ))}
      </div>
      <p className="text-sm leading-normal text-ui-ink2">
        {!total ? t('yatraSettings.noPracticesText')
          : missing.length
            ? t('yatraSettings.wontAppear', { names: joinNames(missing.map((p) => p.practice), i18n.language || 'en') })
            : t('yatraSettings.allAppear')}
      </p>
      {suggested.size > 0 && (
        <button type="button" onClick={() => s.linkAll(suggested)}
          className="min-h-12 self-stretch rounded-[14px] bg-ui-accent-fill px-5 text-[15px] font-extrabold text-ui-ink sm:self-start">
          {t('yatraSettings.linkSuggested', { count: suggested.size })}
        </button>
      )}
    </section>
  )

  // Wide layouts read each row as one line: yatra practice ← yours.
  const grid = 'grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1.15fr)] gap-3'
  const rows = (
    <section className="flex flex-col gap-2">
      <div className={`${wide ? `${grid} items-center pr-3.5 pl-4` : 'flex flex-wrap items-center gap-2 px-1.5'} pt-1 text-[11px] font-bold uppercase tracking-[.1em] text-ui-muted`}>
        <span>{t('yatraSettings.colYatra')}</span><span aria-hidden className="text-sm text-ui-faint2">←</span><span>{t('yatraSettings.colMine')}</span>
      </div>
      <ul className="flex flex-col gap-px overflow-hidden rounded-[18px] border border-ui-hairline bg-ui-hairline">
        {s.items.map((item) => (
          <LinkRow key={item.yatra_practice.id} item={item} suggestion={suggested.get(item.yatra_practice.id)} wide={wide} grid={grid}
            hasCompatible={s.practices.some((p) => p.is_active && p.data_type === item.yatra_practice.data_type)}
            onLink={(name) => s.link(item.yatra_practice.id, name)} onPick={(anchor) => setPicker({ id: item.yatra_practice.id, anchor })} />
        ))}
      </ul>
    </section>
  )

  return (
    <SettingsFrame wide loading={s.isLoading} error={s.isError}
      title={joined && !wide ? t('yatraSettings.joinedTitle', { name: joined }) : t('yatraSettings.title')}
      subtitle={joined ? null : undefined}
      intro={wide ? (layout === 'desktop' ? t('yatraSettings.linksIntro') : undefined) : joined ? t('yatraSettings.joinedIntro') : undefined}>
      {() => (
        <>
          {joined && wide && (
            <section className="flex flex-col gap-1 rounded-[18px] border border-ui-accent-pill bg-ui-accent-soft p-4">
              <h2 className="text-[17px] font-extrabold text-ui-ink">{t('yatraSettings.joinedTitle', { name: joined })}</h2>
              <p className="text-sm leading-normal text-ui-ink2">{t('yatraSettings.joinedIntro')}</p>
            </section>
          )}
          {layout === 'desktop' ? (
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(240px,300px)] items-start gap-5">
              {rows}
              {/* The picker opens over this column. */}
              <div data-popover-bounds className="sticky top-8 flex flex-col gap-4">
                {summary}
                <YourRowToday id={id} items={s.items} />
              </div>
            </div>
          ) : (
            <>{summary}{rows}</>
          )}
          {picker && (() => {
            const item = s.items.find((i) => i.yatra_practice.id === picker.id)
            return item && (
              <LinkPickerSheet item={item} groups={pickerGroups(s.items, s.practices, picker.id)} anchor={layout === 'desktop' ? picker.anchor : undefined}
                onPick={(name) => s.link(picker.id, name)} onClose={() => setPicker(null)} />
            )
          })()}
        </>
      )}
    </SettingsFrame>
  )
}

/** Desktop: today's cells of my row in the yatra table, so a missing link shows where it matters. */
function YourRowToday({ id, items }: { id: string; items: YatraUserPracticeItem[] }) {
  const { t } = useTranslation()
  const userId = useAuthStore((st) => st.user?.id)
  const today = toDateStr(new Date())
  const { data } = useQuery({ queryKey: ['yatra-data', id, today], queryFn: () => yatrasApi.getYatraData(id, today) })
  if (!data?.practices.length) return null
  const units = { h: t('today.unitH'), min: t('today.unitMin') }
  const row = data.data.find((r) => r.user_id === userId)?.row
  return (
    <section className={`${CARD} flex flex-col gap-3 p-4`}>
      <h2 className="text-[15px] font-extrabold text-ui-ink">{t('yatraSettings.yourRowToday')}</h2>
      <div className="grid grid-cols-3 gap-x-1.5 gap-y-2.5">
        {data.practices.map((p, j) => {
          const linked = !!items.find((i) => i.yatra_practice.id === p.id)?.user_practice
          const v = row?.[j] ?? null
          return (
            <div key={p.id} className="flex min-w-0 flex-col gap-1">
              <span title={p.practice} className="truncate font-ui-mono text-[10px] font-semibold uppercase tracking-[.04em] text-ui-muted">{p.practice}</span>
              {linked ? (
                <span className={`flex h-8 items-center justify-center truncate rounded-lg px-1 font-ui-mono text-[13px] font-semibold text-ui-ink ${(p.colour_zones && ZONE_BG[findZone(v, p.colour_zones)]) || 'bg-ui-chip'}`}>
                  {cellText(v, p.data_type, units) || '—'}
                </span>
              ) : (
                <span className="flex h-8 items-center justify-center rounded-lg border border-dashed border-ui-danger text-[11px] font-semibold text-ui-danger">
                  {t('yatraSettings.notLinkedCell')}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

function LinkRow({ item, suggestion, hasCompatible, wide, grid, onLink, onPick }: {
  item: YatraUserPracticeItem; suggestion?: UserPractice; hasCompatible: boolean; wide: boolean; grid: string
  onLink: (name: string) => void; onPick: (anchor: HTMLElement) => void
}) {
  const { t } = useTranslation()
  const { yatra_practice: y, user_practice: mine } = item
  const slotCls = 'flex min-h-[54px] w-full items-center gap-2.5 rounded-xl border border-ui-hairline bg-ui-field px-3 py-[7px] text-left'
  const pick = (e: MouseEvent<HTMLElement>) => onPick(e.currentTarget)
  let slot: ReactNode
  let notLinked = true
  if (mine) {
    notLinked = false
    slot = (
      <button type="button" onClick={pick} className={slotCls}>
        <TypeIcon type={y.data_type} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[11px] font-bold text-ui-faint2">{t('yatraSettings.yourPractice')}</span>
          <span className="truncate text-[15px] font-bold text-ui-ink">{mine}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5 text-xs font-extrabold text-ui-good">
          <span aria-hidden className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-ui-good text-[11px] text-white">✓</span>
          {t('yatraSettings.statusLinked')}
        </span>
      </button>
    )
  } else if (suggestion) {
    slot = (
      <div className={slotCls}>
        <button type="button" onClick={pick} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
          <TypeIcon type={y.data_type} />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-[11px] font-bold text-ui-accent">{t('yatraSettings.suggestedMatch')}</span>
            <span className="truncate text-[15px] font-bold text-ui-ink">{suggestion.practice}</span>
          </span>
        </button>
        <button type="button" onClick={() => onLink(suggestion.practice)}
          className="h-9 shrink-0 rounded-[10px] bg-ui-primary px-4 text-[13px] font-extrabold text-ui-on-primary">
          {t('yatraSettings.link')}
        </button>
      </div>
    )
  } else if (hasCompatible) {
    slot = (
      <button type="button" onClick={pick} className={`${slotCls} border-dashed`}>
        <TypeIcon type={y.data_type} />
        <span className="flex-1 text-[15px] font-bold text-ui-accent">{t('yatraSettings.choose')}</span>
        <span aria-hidden className="text-lg text-ui-faint2">›</span>
      </button>
    )
  } else {
    notLinked = false
    slot = (
      <div className={`${slotCls} border-dashed`}>
        <TypeIcon type={y.data_type} />
        <span className="flex min-w-0 flex-1 flex-col text-[13px]">
          <span className="font-bold text-ui-ink">{t('yatraSettings.noneOfType', { type: t(typeLabelKey(y.data_type)) })}</span>
          <span className="text-ui-muted">
            {t('yatraSettings.nothingYet')}{' '}
            <Link to="/user/practices" className="font-bold text-ui-accent">{t('yatraSettings.addInMyPractices')}</Link>
          </span>
        </span>
      </div>
    )
  }
  const status = notLinked && <span className="text-xs font-semibold text-ui-muted">{t('yatraSettings.notLinked')}</span>
  const name = <span className="min-w-0 text-base leading-[1.3] font-extrabold text-ui-ink">{y.practice}</span>

  if (wide) {
    return (
      <li className={`${grid} items-start bg-ui-surface py-3.5 pr-3.5 pl-4`}>
        <div className="flex min-w-0 flex-col items-start gap-1.5 pt-1">{name}<TypeChip type={y.data_type} /></div>
        <span aria-hidden className="pt-4 text-ui-faint2">←</span>
        <div className="flex min-w-0 flex-col gap-1.5">{slot}{status}</div>
      </li>
    )
  }
  return (
    <li className="flex flex-col gap-2.5 bg-ui-surface py-3.5 pr-3.5 pl-4">
      <div className="flex items-start justify-between gap-2.5">
        <span className="pt-0.5">{name}</span>
        <TypeChip type={y.data_type} />
      </div>
      {slot}
      {status}
    </li>
  )
}

