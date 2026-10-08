import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { MobileShell } from '../../../../layouts/mobile/MobileShell'
import type { UserPractice, YatraUserPracticeItem } from '../../../../types/api'
import { pickerGroups, suggestions, unlinked } from '../linking'
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
  const s = useLinkPractices(id)
  const [pickerFor, setPickerFor] = useState<string | null>(null)
  const [leaving, setLeaving] = useState(false)

  const missing = unlinked(s.items)
  const suggested = suggestions(s.items, s.practices)
  const total = s.items.length
  const linked = total - missing.length
  const joined = params.get('joined') === '1'

  return (
    <>
      <header className="sticky top-0 z-30 bg-ui-bg pt-[env(safe-area-inset-top)]">
        <div className="flex min-h-11 items-center px-2">
          <Link to="/yatras" className="flex min-h-11 items-center gap-1 px-2 text-[17px] font-semibold text-ui-accent">
            <span aria-hidden>‹</span>{t('yatraSettings.back')}
          </Link>
        </div>
      </header>
      <div className="flex flex-col gap-0.5 px-5 pb-4">
        <h1 className="text-[28px] font-extrabold leading-[1.15] tracking-[-0.02em] text-ui-ink">
          {joined && s.yatra ? t('yatraSettings.joinedTitle', { name: s.yatra.name }) : t('yatraSettings.title')}
        </h1>
        {!joined && s.yatra && <p className="text-sm text-ui-muted">{s.yatra.name}</p>}
        {joined && <p className="pt-1 text-sm leading-normal text-ui-ink2">{t('yatraSettings.joinedIntro')}</p>}
      </div>

      {s.isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <span role="status" aria-label={t('common.loading')} className="h-6 w-6 animate-spin rounded-full border-2 border-ui-control border-t-ui-accent" />
        </div>
      ) : s.isError ? (
        <p role="alert" className="py-10 text-center text-sm text-ui-danger">{t('common.error')}</p>
      ) : (
        <div className="flex flex-col gap-4 px-4 pb-8">
          <section className={`${CARD} flex flex-col gap-3 p-4`}>
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
              <span className="text-[22px] font-extrabold tracking-[-0.01em] text-ui-ink">
                {missing.length ? t('yatraSettings.countLinked', { linked, total }) : t('yatraSettings.allLinked', { total })}
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
              {missing.length
                ? t('yatraSettings.wontAppear', { names: joinNames(missing.map((p) => p.practice), i18n.language || 'en') })
                : t('yatraSettings.allAppear')}
            </p>
            {suggested.size > 0 && (
              <button type="button" onClick={() => s.linkAll(suggested)}
                className="min-h-12 rounded-[14px] bg-ui-accent-fill px-5 text-[15px] font-extrabold text-ui-ink">
                {t('yatraSettings.linkSuggested', { count: suggested.size })}
              </button>
            )}
          </section>

          <section className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2 px-1.5 pt-1 text-[11px] font-bold uppercase tracking-[.1em] text-ui-muted">
              <span>{t('yatraSettings.colYatra')}</span><span aria-hidden className="text-sm text-ui-faint2">←</span><span>{t('yatraSettings.colMine')}</span>
            </div>
            <ul className="flex flex-col gap-px overflow-hidden rounded-[18px] border border-ui-hairline bg-ui-hairline">
              {s.items.map((item) => (
                <LinkRow key={item.yatra_practice.id} item={item} suggestion={suggested.get(item.yatra_practice.id)}
                  hasCompatible={s.practices.some((p) => p.is_active && p.data_type === item.yatra_practice.data_type)}
                  onLink={(name) => s.link(item.yatra_practice.id, name)} onPick={() => setPickerFor(item.yatra_practice.id)} />
              ))}
            </ul>
          </section>

          <div className="flex flex-col gap-px overflow-hidden rounded-[18px] border border-ui-hairline bg-ui-hairline">
            {s.me?.is_admin && (
              <Link to={`/yatra/${id}/admin/settings`} className="flex min-h-[52px] items-center gap-3 bg-ui-surface px-4">
                <span className="flex-1 text-[15px] font-semibold text-ui-ink">{t('yatraSettings.manage')}</span>
                <span className="rounded-full bg-ui-accent-pill px-2 py-0.5 text-[11px] font-bold text-ui-accent">{t('yatraSettings.admin')}</span>
                <span aria-hidden className="text-lg text-ui-faint2">›</span>
              </Link>
            )}
            <button type="button" onClick={() => setLeaving(true)}
              className="flex min-h-[52px] items-center bg-ui-surface px-4 text-left text-[15px] font-bold text-ui-danger">
              {t('yatraSettings.leave')}
            </button>
          </div>
        </div>
      )}
      {pickerFor && (() => {
        const item = s.items.find((i) => i.yatra_practice.id === pickerFor)
        return item && (
          <LinkPickerSheet item={item} groups={pickerGroups(s.items, s.practices, pickerFor)}
            onPick={(name) => s.link(pickerFor, name)} onClose={() => setPickerFor(null)} />
        )
      })()}
      {/* Task 6 renders LeaveSheets for leaving. */}
      {leaving && null}
    </>
  )
}

function LinkRow({ item, suggestion, hasCompatible, onLink, onPick }: {
  item: YatraUserPracticeItem; suggestion?: UserPractice; hasCompatible: boolean
  onLink: (name: string) => void; onPick: () => void
}) {
  const { t } = useTranslation()
  const { yatra_practice: y, user_practice: mine } = item
  const slot = 'flex min-h-[54px] w-full items-center gap-2.5 rounded-xl border border-ui-hairline bg-ui-field px-3 py-[7px] text-left'
  return (
    <li className="flex flex-col gap-2.5 bg-ui-surface py-3.5 pr-3.5 pl-4">
      <div className="flex items-start justify-between gap-2.5">
        <span className="min-w-0 pt-0.5 text-base font-extrabold leading-[1.3] text-ui-ink">{y.practice}</span>
        <TypeChip type={y.data_type} />
      </div>
      {mine ? (
        <button type="button" onClick={onPick} className={slot}>
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
      ) : suggestion ? (
        <>
          <div className={slot}>
            <button type="button" onClick={onPick} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
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
          <span className="text-xs font-semibold text-ui-muted">{t('yatraSettings.notLinked')}</span>
        </>
      ) : hasCompatible ? (
        <>
          <button type="button" onClick={onPick} className={`${slot} border-dashed`}>
            <TypeIcon type={y.data_type} />
            <span className="flex-1 text-[15px] font-bold text-ui-accent">{t('yatraSettings.choose')}</span>
            <span aria-hidden className="text-lg text-ui-faint2">›</span>
          </button>
          <span className="text-xs font-semibold text-ui-muted">{t('yatraSettings.notLinked')}</span>
        </>
      ) : (
        <div className={`${slot} border-dashed`}>
          <TypeIcon type={y.data_type} />
          <span className="flex min-w-0 flex-1 flex-col text-[13px]">
            <span className="font-bold text-ui-ink">{t('yatraSettings.noneOfType', { type: t(typeLabelKey(y.data_type)) })}</span>
            <span className="text-ui-muted">
              {t('yatraSettings.nothingYet')}{' '}
              <Link to="/user/practices" className="font-bold text-ui-accent">{t('yatraSettings.addInMyPractices')}</Link>
            </span>
          </span>
        </div>
      )}
    </li>
  )
}

export function LinkPracticesMobileScreen() {
  return (
    <MobileShell>
      <LinkPracticesMobile />
    </MobileShell>
  )
}
