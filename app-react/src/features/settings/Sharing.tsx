import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  SHARE_LINKS_KEY, shareLinksApi, shareLinkUrl, useShareLinks,
  type ShareLink, type ShareLinkForm, type ShareLinksData, type ShareableReport,
} from '../../api/shareLinks'
import { useToast } from '../../hooks/useToast'
import { UiLoading } from '../../layouts/ByLayout'
import { SegmentedControl } from '../../ui/primitives/SegmentedControl'
import { Toggle } from '../../ui/primitives/Toggle'
import { formatDay } from '../insights/insightsLogic'
import { toDateStr } from '../today/date'
import { BTN, FIELD, HINT } from '../yatras/settings/mobile/AdminPage'
import { ConfirmSheet } from '../yatras/settings/mobile/fields'
import { AddPill, ROWS, SettingsSubpage } from './SettingsSubpage'

const NAME_MAX = 100
const LABEL = 'text-[13px] font-bold text-ui-muted'

/** Copies a link's URL, with a toast either way (clipboard is missing outside secure contexts). */
function useCopyLink() {
  const { t } = useTranslation()
  const { showToast } = useToast()
  return (id: string) => {
    new Promise<void>((resolve) => resolve(navigator.clipboard.writeText(shareLinkUrl(id))))
      .then(
        () => showToast({ message: t('sharing.copied'), variant: 'success' }),
        () => showToast({ message: t('common.error'), variant: 'error' }),
      )
  }
}

/** /settings/sharing: one link per person, each with its own charts, plus the old all-data link's switch. */
export function Sharing() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language || 'en'
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { showToast } = useToast()
  const { data, isLoading } = useShareLinks()
  const copy = useCopyLink()

  const legacy = useMutation({
    mutationFn: (enabled: boolean) => shareLinksApi.setLegacy(enabled),
    onMutate: (enabled) => qc.setQueryData<ShareLinksData>(SHARE_LINKS_KEY, (d) => d && { ...d, legacy_enabled: enabled }),
    onError: () => showToast({ message: t('common.error'), variant: 'error' }),
    onSettled: () => qc.invalidateQueries({ queryKey: SHARE_LINKS_KEY }),
  })

  const summary = (link: ShareLink) => {
    // Only reports this version can show; an id it can't read stays on the link but isn't counted.
    const names = link.report_ids.flatMap((id) => data?.reports.find((r) => r.id === id)?.name ?? [])
    const charts = !names.length ? t('sharing.noCharts')
      : names.length <= 2 ? names.join(', ') : t('sharing.charts', { count: names.length })
    const parts = [charts, link.start_date ? t('sharing.opensOn', { date: formatDay(link.start_date, locale) }) : t('sharing.opensToday')]
    if (link.last_opened_at) parts.push(t('sharing.lastOpened', { date: formatDay(toDateStr(new Date(link.last_opened_at)), locale) }))
    return parts.join(' · ')
  }

  return (
    <SettingsSubpage title={t('sharing.title')}>
      <p className="px-1 text-sm leading-[1.45] text-ui-muted">{t('sharing.intro')}</p>
      <div className="flex items-center justify-between gap-3 px-1">
        <h2 className="text-[15px] font-extrabold text-ui-ink">{t('sharing.yours')}</h2>
        <AddPill label={t('sharing.newLink')} onClick={() => navigate('/settings/sharing/new')} />
      </div>
      {isLoading || !data ? <UiLoading /> : (
        <>
          {data.links.length ? (
            <ul aria-label={t('sharing.yours')} className={ROWS}>
              {data.links.map((l) => (
                <li key={l.id} className="flex items-stretch bg-ui-surface">
                  <Link to={`/settings/sharing/${l.id}`} className="flex min-h-[52px] min-w-0 flex-1 flex-col gap-0.5 px-4 py-3 text-left">
                    <span className="truncate text-[15px] font-semibold text-ui-ink">{l.name}</span>
                    <span className="text-xs font-medium text-ui-muted">{summary(l)}</span>
                  </Link>
                  <button type="button" onClick={() => copy(l.id)} aria-label={t('sharing.copyOf', { name: l.name })}
                    className="flex min-w-11 shrink-0 items-center justify-center pr-4 pl-2 text-sm font-bold text-ui-accent">
                    {t('sharing.copy')}
                  </button>
                </li>
              ))}
            </ul>
          ) : <p className="px-1 text-sm text-ui-muted">{t('sharing.none')}</p>}
          <div className={ROWS}>
            <div className="flex min-h-[52px] items-center gap-3 bg-ui-surface px-4 py-3">
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[15px] font-semibold text-ui-ink">{t('sharing.legacy')}</span>
                <span id="sharing-legacy-hint" className="text-xs leading-[1.4] font-medium text-ui-muted">{t('sharing.legacyHint')}</span>
              </span>
              <Toggle label={t('sharing.legacy')} describedBy="sharing-legacy-hint" checked={data.legacy_enabled}
                onChange={(on) => legacy.mutate(on)} />
            </div>
          </div>
        </>
      )}
    </SettingsSubpage>
  )
}

/** /settings/sharing/new and /settings/sharing/:id: who it's for, which charts, and where the page opens. */
export function ShareLinkEditor() {
  const { t } = useTranslation()
  const { id } = useParams()
  const { data, isLoading } = useShareLinks()
  const link = id ? data?.links.find((l) => l.id === id) : undefined

  if (isLoading || !data) {
    return <SettingsSubpage title={t('sharing.title')} back={{ to: '/settings/sharing', label: t('sharing.title') }}><UiLoading /></SettingsSubpage>
  }
  if (id && !link) return <Navigate to="/settings/sharing" replace />
  return <EditorForm key={id ?? 'new'} link={link} reports={data.reports} />
}

function EditorForm({ link, reports }: { link?: ShareLink; reports: ShareableReport[] }) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language || 'en'
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { showToast } = useToast()
  const copy = useCopyLink()
  const visible = new Set(reports.map((r) => r.id))
  // Reports this version can't show (a newer kind): kept on save, never dropped behind the owner's back.
  const hidden = (link?.report_ids ?? []).filter((r) => !visible.has(r))

  const [name, setName] = useState(link?.name ?? '')
  const [checked, setChecked] = useState(() => new Set(link?.report_ids ?? []))
  const [mode, setMode] = useState<'today' | 'date'>(link?.start_date ? 'date' : 'today')
  const [date, setDate] = useState(link?.start_date ?? toDateStr(new Date()))
  const [confirming, setConfirming] = useState(false)

  const onError = () => showToast({ message: t('common.error'), variant: 'error' })
  const refresh = () => qc.invalidateQueries({ queryKey: SHARE_LINKS_KEY })
  const save = useMutation({
    mutationFn: (form: ShareLinkForm) => (link ? shareLinksApi.update(link.id, form).then(() => link.id) : shareLinksApi.create(form)),
    onSuccess: (id, form) => {
      if (!link) {
        // In the cache before the URL changes, so the editor reopens on it without waiting for the list.
        qc.setQueryData<ShareLinksData>(SHARE_LINKS_KEY, (d) => d && { ...d, links: [{ id, ...form, last_opened_at: null }, ...d.links] })
        navigate(`/settings/sharing/${id}`, { replace: true })
      }
      showToast({ message: t('common.saved'), variant: 'success' })
    },
    onError,
    onSettled: refresh,
  })
  const remove = useMutation({
    mutationFn: (id: string) => shareLinksApi.remove(id),
    onSuccess: () => navigate('/settings/sharing', { replace: true }),
    onError: () => { setConfirming(false); onError() },
    onSettled: refresh,
  })

  const trimmed = name.trim()
  const valid = !!trimmed && (mode === 'today' || !!date)
  const busy = save.isPending || remove.isPending

  function submit() {
    if (!valid) return
    const report_ids = [...reports.filter((r) => checked.has(r.id)).map((r) => r.id), ...hidden]
    save.mutate({ name: trimmed, start_date: mode === 'date' ? date : null, report_ids })
  }

  function toggle(id: string) {
    setChecked((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <SettingsSubpage title={link ? link.name : t('sharing.newLink')} back={{ to: '/settings/sharing', label: t('sharing.title') }}>
      <div className="flex flex-col gap-1.5 px-1">
        <label htmlFor="share-name" className={LABEL}>{t('sharing.whoFor')}</label>
        <input id="share-name" value={name} maxLength={NAME_MAX} autoComplete="off" onChange={(e) => setName(e.target.value)}
          aria-describedby="share-name-hint" className={FIELD} />
        <p id="share-name-hint" className={HINT}>{t('sharing.whoForHint')}</p>
      </div>

      <fieldset className="flex flex-col gap-1.5">
        <legend className={`${LABEL} mb-1.5 px-1`}>{t('sharing.charts')}</legend>
        {reports.length ? (
          <ul className={ROWS}>
            {reports.map((r) => (
              <li key={r.id}>
                <label className="flex min-h-[52px] cursor-pointer items-start gap-3 bg-ui-surface px-4 py-3">
                  <input type="checkbox" checked={checked.has(r.id)} onChange={() => toggle(r.id)}
                    className="mt-0.5 h-5 w-5 shrink-0 accent-ui-accent" />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex items-baseline gap-2">
                      <span className="min-w-0 truncate text-[15px] font-semibold text-ui-ink">{r.name}</span>
                      <span className="shrink-0 text-xs font-bold text-ui-muted">{t(`sharing.kind.${r.kind}`)}</span>
                    </span>
                    {r.practices.length > 0 && <span className="text-xs font-medium text-ui-muted">{r.practices.join(', ')}</span>}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        ) : <p className={`${HINT} px-1`}>{t('sharing.noReports')}</p>}
      </fieldset>

      <div className="flex flex-col gap-2 px-1">
        <span aria-hidden className={LABEL}>{t('sharing.opensOnLabel')}</span>
        <SegmentedControl label={t('sharing.opensOnLabel')} fill value={mode} onChange={setMode}
          options={[{ value: 'today', label: t('sharing.today') }, { value: 'date', label: t('sharing.date') }]} />
        {mode === 'date' && (
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label={t('sharing.opensOnDate')}
            aria-invalid={!date} className={FIELD} />
        )}
        <p className={HINT}>{mode === 'date' && date ? `${formatDay(date, locale, true)} · ` : ''}{t('sharing.opensOnHint')}</p>
      </div>

      <button type="button" onClick={submit} disabled={!valid || busy} aria-busy={save.isPending}
        className={`${BTN} w-full bg-ui-accent-fill text-ui-ink disabled:opacity-50`}>{t('sharing.save')}</button>

      {link && (
        <div className="flex gap-2.5">
          {'share' in navigator && (
            <button type="button" onClick={() => { navigator.share({ url: shareLinkUrl(link.id) }).catch(() => { /* dismissed */ }) }}
              className={`${BTN} flex-1 border border-ui-control text-ui-ink`}>{t('sharing.share')}</button>
          )}
          <button type="button" onClick={() => copy(link.id)} className={`${BTN} flex-1 border border-ui-control text-ui-ink`}>{t('sharing.copy')}</button>
        </div>
      )}
      {link && (
        <button type="button" disabled={busy} onClick={() => setConfirming(true)}
          className={`${BTN} w-full text-ui-danger disabled:opacity-50`}>{t('sharing.withdrawAccess')}</button>
      )}
      {link && confirming && (
        <ConfirmSheet title={t('sharing.withdrawTitle', { name: link.name })} text={t('sharing.withdrawMsg')}
          confirm={t('sharing.withdraw')} busy={remove.isPending} onClose={() => setConfirming(false)}
          onConfirm={() => remove.mutate(link.id)} />
      )}
    </SettingsSubpage>
  )
}
