import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useMutation } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { authApi } from '../../api/auth'
import { useToastStore } from '../../hooks/useToast'
import { useLayout } from '../../layouts/useLayout'
import { CARD, FIELD, HINT } from '../yatras/settings/mobile/AdminPage'
import { ErrorBanner, FIELD_ERROR, LABEL, PRIMARY, SettingsDetail, SPINNER } from './SettingsDetail'

const MIN = 5
const MAX = 256

function Eye({ off }: { off: boolean }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {off && <path d="M4 20 20 4" />}
    </svg>
  )
}

function PasswordField({ id, label, value, onChange, disabled, error, note, autoComplete }: {
  id: string; label: string; value: string; onChange: (v: string) => void; disabled: boolean; autoComplete: string
  error?: string | null
  /** Under the field when there's no error: a hint, or "Passwords match". */
  note?: ReactNode
}) {
  const { t } = useTranslation()
  const [shown, setShown] = useState(false)
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={LABEL}>{label}</label>
      <div className="relative">
        <input id={id} type={shown ? 'text' : 'password'} value={value} disabled={disabled} autoComplete={autoComplete}
          aria-invalid={!!error} aria-describedby={`${id}-msg`} spellCheck={false}
          className={`${FIELD} pr-12 disabled:opacity-50 ${shown ? 'font-ui-mono' : ''}`}
          onChange={(e) => onChange(e.target.value)} />
        {/* A slashed eye means the text is visible. */}
        <button type="button" aria-label={t(shown ? 'password.hide' : 'password.show')} aria-pressed={shown} disabled={disabled}
          onClick={() => setShown((s) => !s)}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-ui-muted">
          <Eye off={shown} />
        </button>
      </div>
      <div id={`${id}-msg`}>{error ? <p role="alert" className={FIELD_ERROR}>{error}</p> : note}</div>
    </div>
  )
}

export function ChangePassword() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const mobile = useLayout() === 'mobile'
  const showToast = useToastStore((s) => s.showToast)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const save = useMutation({
    mutationFn: () => authApi.updatePassword(current, next),
    onSuccess: () => {
      if (!mobile) return
      showToast({ message: t('password.changed'), variant: 'success' })
      navigate('/settings')
    },
  })
  // Wider layouts show "Saved ✓" on the button for a moment, then go back.
  useEffect(() => {
    if (!save.isSuccess || mobile) return
    const id = setTimeout(() => navigate('/settings'), 1200)
    return () => clearTimeout(id)
  }, [save.isSuccess, mobile, navigate])

  const wrongCurrent = isAxiosError(save.error) && save.error.response?.status === 401
  // Don't flag a mismatch while the confirmation is still being typed toward a match.
  const mismatch = !!confirm && confirm !== next && (confirm.length >= next.length || !next.startsWith(confirm))
  const badLength = !!next && (next.length > MAX || (next.length < MIN && !!confirm))
  const ready = !!current && next.length >= MIN && next.length <= MAX && confirm === next
  const busy = save.isPending || save.isSuccess
  const edit = (set: (v: string) => void) => (v: string) => { set(v); save.reset() }
  const submit = () => { if (ready && !busy) save.mutate() }

  return (
    <SettingsDetail title={t('settings.changePassword')} footer={
      save.isSuccess && !mobile
        ? <span role="status" className={`${PRIMARY} bg-ui-surface`}><span aria-hidden className="text-ui-good">✓</span>{t('common.saved')}</span>
        : <button type="submit" form="change-password" className={PRIMARY} disabled={!ready || busy}>
            {save.isPending ? <><span aria-hidden className={SPINNER} />{t('userDetails.saving')}</> : t('settings.changePassword')}
          </button>
    }>
      <form id="change-password" className={`${CARD} flex flex-col gap-4 p-4`} onSubmit={(e) => { e.preventDefault(); submit() }}>
        <PasswordField id="current-password" label={t('password.current')} value={current} onChange={edit(setCurrent)}
          disabled={busy} autoComplete="current-password" error={wrongCurrent ? t('password.wrongCurrent') : null} />
        <PasswordField id="new-password" label={t('password.new')} value={next} onChange={edit(setNext)}
          disabled={busy} autoComplete="new-password"
          error={badLength ? t('password.length', { min: MIN, max: MAX }) : null}
          note={<p className={HINT}>{t('password.length', { min: MIN, max: MAX })}</p>} />
        <PasswordField id="confirm-password" label={t('password.confirmNew')} value={confirm} onChange={edit(setConfirm)}
          disabled={busy} autoComplete="new-password"
          error={mismatch ? t('password.mismatch') : null}
          note={confirm && confirm === next && (
            <p className="flex items-center gap-1.5 text-xs font-semibold text-ui-muted">
              <span aria-hidden className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-ui-good text-[9px] text-white">✓</span>
              {t('password.match')}
            </p>
          )} />
      </form>
      {save.isError && !wrongCurrent && <ErrorBanner title={t('password.failed')} text={t('userDetails.saveFailedHint')} />}
    </SettingsDetail>
  )
}
