import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { authApi } from '../../api/auth'
import { useToastStore } from '../../hooks/useToast'
import { useLayout } from '../../layouts/useLayout'
import { useAuthStore } from '../../store/authStore'
import { initials } from '../../ui/initials'
import { CARD, FIELD, HINT } from '../yatras/settings/mobile/AdminPage'
import { ErrorBanner, FIELD_ERROR, LABEL, PRIMARY, SECONDARY, SettingsDetail, SPINNER } from './SettingsDetail'

const NAME_MIN = 3
const NAME_MAX = 50

export function UserDetails() {
  const { t } = useTranslation()
  const wide = useLayout() !== 'mobile'
  const user = useAuthStore((s) => s.user)
  const saved = user?.name ?? ''
  const [name, setName] = useState(saved)
  const showToast = useToastStore((s) => s.showToast)
  const save = useMutation({
    mutationFn: (n: string) => authApi.updateUser(n),
    onSuccess: (_, n) => {
      useAuthStore.setState((s) => ({ user: s.user && { ...s.user, name: n } }))
      showToast({ message: t('settings.saved'), variant: 'success' })
    },
  })

  const trimmed = name.trim()
  const dirty = trimmed !== saved
  const error = !dirty ? null : !trimmed ? t('userDetails.nameEmpty') : trimmed.length < NAME_MIN ? t('userDetails.nameShort') : null

  return (
    <SettingsDetail title={t('settings.userDetails')} footer={
      <>
        {wide && dirty && !save.isPending && (
          <button type="button" className={SECONDARY} onClick={() => { setName(saved); save.reset() }}>{t('common.cancel')}</button>
        )}
        <button type="button" className={PRIMARY} disabled={!dirty || !!error || save.isPending} onClick={() => save.mutate(trimmed)}>
          {save.isPending ? <><span aria-hidden className={SPINNER} />{t('userDetails.saving')}</> : t('common.save')}
        </button>
      </>
    }>
      <div className={`flex items-center gap-3.5 ${wide ? '' : 'flex-col'}`}>
        <span className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-ui-selected text-xl font-extrabold text-ui-on-selected ${wide ? '' : 'h-[72px] w-[72px] text-2xl'}`}>
          {initials(saved)}
        </span>
        <span className={`flex min-w-0 flex-col ${wide ? '' : 'items-center'}`}>
          <span className="text-xl font-extrabold break-words text-ui-ink">{saved}</span>
          {wide && <span className="text-[13px] text-ui-muted">{user?.email}</span>}
        </span>
      </div>
      <div className={`${CARD} flex flex-col gap-4 p-4`}>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <label htmlFor="user-email" className={LABEL}>{t('userDetails.email')}</label>
            <span className="text-xs font-semibold text-ui-muted">{t('userDetails.emailLocked')}</span>
          </div>
          {/* Read-only reads read-only: dashed, tinted, no focus ring. */}
          <input id="user-email" readOnly tabIndex={-1} value={user?.email ?? ''} aria-describedby="user-email-hint"
            className="min-h-12 w-full cursor-default rounded-xl border border-dashed border-ui-faint bg-ui-field px-3.5 text-ui-ink2 outline-none" />
          <p id="user-email-hint" className={HINT}>{t('userDetails.emailHint')}</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="user-name" className={LABEL}>{t('userDetails.name')}</label>
          <input id="user-name" value={name} maxLength={NAME_MAX} autoComplete="name" disabled={save.isPending}
            aria-invalid={!!error} aria-describedby="user-name-msg" className={`${FIELD} disabled:opacity-50`}
            onChange={(e) => { setName(e.target.value); save.reset() }}
            onKeyDown={(e) => { if (e.key === 'Enter' && dirty && !error) save.mutate(trimmed) }} />
          {error
            ? <p id="user-name-msg" role="alert" className={FIELD_ERROR}>{error}</p>
            : <p id="user-name-msg" className={HINT}>{t('userDetails.nameHint')}</p>}
        </div>
      </div>
      {save.isError && <ErrorBanner title={t('userDetails.saveFailed')} text={t('userDetails.saveFailedHint')} />}
    </SettingsDetail>
  )
}
