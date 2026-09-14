import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation } from '@tanstack/react-query'
import { LuUser, LuCheck, LuX } from 'react-icons/lu'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
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

export function EditUserPage() {
  const { t } = useTranslation()
  const user = useAuthStore(s => s.user)
  const [name, setName] = useState(user?.name ?? '')
  const [success, setSuccess] = useState(false)

  const mutation = useMutation({
    mutationFn: () => authApi.updateUser(name),
    onSuccess: () => setSuccess(true),
  })

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
          <LuUser className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-bold text-base-content">{t('settings.editProfile')}</h1>
          <p className="text-xs text-base-content/70 mt-0.5">Update your display name</p>
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

      {/* Form */}
      <div className="rounded-2xl px-5 py-5 flex flex-col gap-4" style={glass}>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="display-name" className="text-xs font-semibold text-base-content/70 uppercase tracking-widest">{t('auth.name')}</label>
          <input
            id="display-name"
            value={name}
            onChange={e => { setName(e.target.value); setSuccess(false) }}
            style={inputStyle}
            onFocus={onFocus}
            onBlur={onBlurInput}
            maxLength={50}
          />
          <p
            className="text-[10px] text-right"
            style={{ color: name.length >= 50 ? '#e11d48' : name.length >= 45 ? '#d97706' : 'rgba(242,244,246,0.7)' }}
          >
            {name.length}/50
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="user-email" className="text-xs font-semibold text-base-content/70 uppercase tracking-widest">{t('auth.email')}</label>
          <input
            id="user-email"
            value={user?.email ?? ''}
            readOnly
            style={{ ...inputStyle, background: 'rgba(255,255,255,0.04)', color: 'rgba(242,244,246,0.7)', cursor: 'default' }}
          />
        </div>

        {mutation.isError && (
          <p className="text-sm rounded-xl px-3 py-2.5" style={{ background: 'rgba(225,29,72,0.07)', color: '#e11d48' }}>
            {t('common.error')}
          </p>
        )}
      </div>

      <button
        onClick={() => { setSuccess(false); mutation.mutate() }}
        disabled={mutation.isPending || !name.trim()}
        className="w-full h-12 rounded-full text-sm font-semibold flex items-center justify-center gap-2 transition-opacity"
        style={{
          background: success
            ? 'rgba(245,158,11,0.12)'
            : ACCENT_GRADIENT,
          color: success ? ACCENT : 'white',
          border: success ? '1px solid rgba(245,158,11,0.30)' : 'none',
          boxShadow: success ? 'none' : '0 4px 20px rgba(245,158,11,0.35)',
          opacity: mutation.isPending || !name.trim() ? 0.55 : 1,
          cursor: mutation.isPending || !name.trim() ? 'not-allowed' : 'pointer',
        }}
      >
        {mutation.isPending && <span className="loading loading-spinner loading-xs" />}
        {success ? <><LuCheck className="w-4 h-4" /> {t('settings.saved')}</> : t('common.save')}
      </button>
    </div>
  )
}
