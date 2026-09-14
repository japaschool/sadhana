import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation } from '@tanstack/react-query'
import { LuLock, LuCheck, LuX } from 'react-icons/lu'
import { FaEye, FaEyeSlash } from 'react-icons/fa'
import { Link } from 'react-router-dom'
import { authApi } from '../../api/auth'
import { ACCENT, ACCENT_GRADIENT, SURFACE_2, TEXT, BORDER } from '../../theme/tokens'

const glass: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: `1px solid ${BORDER}`,
  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
}

const inputStyle: React.CSSProperties = {
  background: SURFACE_2,
  border: `1px solid ${BORDER}`,
  borderRadius: '0.75rem',
  outline: 'none',
  width: '100%',
  fontSize: '0.9rem',
  color: TEXT,
  padding: '0.625rem 0.875rem',
  transition: 'border-color 0.15s, box-shadow 0.15s',
}

function onFocus(e: React.FocusEvent<HTMLInputElement>) {
  e.target.style.borderColor = ACCENT
  e.target.style.boxShadow = '0 0 0 3px rgba(245,158,11,0.15)'
}
function onBlurInput(e: React.FocusEvent<HTMLInputElement>) {
  e.target.style.borderColor = BORDER
  e.target.style.boxShadow = 'none'
}

function PasswordField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  const [show, setShow] = useState(false)
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-semibold text-base-content/70 uppercase tracking-widest">{label}</label>
      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{ ...inputStyle, paddingRight: '2.75rem' }}
          onFocus={onFocus}
          onBlur={onBlurInput}
        />
        <button
          type="button"
          onClick={() => setShow(v => !v)}
          aria-label={show ? 'Hide password' : 'Show password'}
          className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors"
          style={{ color: ACCENT, background: 'none', border: 'none', cursor: 'pointer' }}
        >
          {show ? <FaEyeSlash className="w-4 h-4" /> : <FaEye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}

export function EditPasswordPage() {
  const { t } = useTranslation()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [clientError, setClientError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const mutation = useMutation({
    mutationFn: () => authApi.updatePassword(current, next),
    onSuccess: () => {
      setSuccess(true)
      setCurrent('')
      setNext('')
      setConfirm('')
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (next !== confirm) { setClientError(t('auth.passwordMismatch')); return }
    setClientError(null)
    setSuccess(false)
    mutation.mutate()
  }

  const error = clientError ?? (mutation.isError ? t('common.error') : null)
  const realtimeMismatch = confirm.length > 0 && next.length > 0 && confirm !== next

  return (
    <div className="px-4 py-6 max-w-lg sm:max-w-2xl mx-auto flex flex-col gap-4 pb-24 sm:pb-8">
      {/* Header */}
      <div className="rounded-2xl px-5 py-5 flex items-center gap-4" style={glass}>
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{
            background: ACCENT_GRADIENT,
            boxShadow: '0 4px 16px rgba(245,158,11,0.30)',
          }}
        >
          <LuLock className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-bold text-base-content">{t('settings.changePassword')}</h1>
          <p className="text-xs text-base-content/70 mt-0.5">Update your login password</p>
        </div>
        <Link
          to="/settings"
          aria-label="Close"
          className="w-9 h-9 flex items-center justify-center rounded-full flex-shrink-0"
          style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.40)' }}
        >
          <LuX className="w-4 h-4" />
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="rounded-2xl px-5 py-5 flex flex-col gap-4" style={glass}>
          <PasswordField id="current-password" label={t('settings.currentPassword')} value={current} onChange={v => { setCurrent(v); setSuccess(false) }} />
          <PasswordField id="new-password" label={t('auth.newPassword')} value={next} onChange={v => { setNext(v); setSuccess(false) }} />
          <PasswordField id="confirm-password" label={t('auth.confirmPassword')} value={confirm} onChange={v => { setConfirm(v); setSuccess(false) }} />

          {realtimeMismatch && !clientError && (
            <p className="text-sm rounded-xl px-3 py-2.5" style={{ background: 'rgba(225,29,72,0.07)', color: '#e11d48' }}>
              {t('auth.passwordMismatch')}
            </p>
          )}
          {error && (
            <p className="text-sm rounded-xl px-3 py-2.5" style={{ background: 'rgba(225,29,72,0.07)', color: '#e11d48' }}>
              {error}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={mutation.isPending || !current || !next || !confirm}
          className="w-full h-12 rounded-full text-sm font-semibold flex items-center justify-center gap-2 transition-opacity"
          style={{
            background: success
              ? 'rgba(245,158,11,0.12)'
              : ACCENT_GRADIENT,
            color: success ? ACCENT : 'white',
            border: success ? '1px solid rgba(245,158,11,0.30)' : 'none',
            boxShadow: success ? 'none' : '0 4px 20px rgba(245,158,11,0.35)',
            opacity: mutation.isPending || !current || !next || !confirm ? 0.55 : 1,
            cursor: mutation.isPending || !current || !next || !confirm ? 'not-allowed' : 'pointer',
          }}
        >
          {mutation.isPending && <span className="loading loading-spinner loading-xs" />}
          {success ? <><LuCheck className="w-4 h-4" /> {t('settings.saved')}</> : t('common.save')}
        </button>
      </form>
    </div>
  )
}
