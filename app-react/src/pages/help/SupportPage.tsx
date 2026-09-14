import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LuMessageSquare, LuCheck, LuX } from 'react-icons/lu'
import { supportApi } from '../../api/support'
import { useAuthStore } from '../../store/authStore'
import { ACCENT, SURFACE_2, TEXT, BORDER } from '../../theme/tokens'

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

function onFocus(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
  e.target.style.borderColor = ACCENT
  e.target.style.boxShadow = '0 0 0 3px rgba(245,158,11,0.15)'
}

function onBlur(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
  e.target.style.borderColor = BORDER
  e.target.style.boxShadow = 'none'
}

export function SupportPage() {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState(false)

  const mutation = useMutation({
    mutationFn: () => supportApi.sendMessage({ name, email, message }),
    onSuccess: () => setSent(true),
    onError: () => {
      window.location.href = `mailto:support@sadhana.pro?subject=Support request&body=${encodeURIComponent(message)}`
    },
  })

  if (sent) {
    return (
      <div className="px-4 py-6 max-w-lg sm:max-w-2xl mx-auto flex flex-col items-center justify-center gap-4 pb-24 sm:pb-8" style={{ paddingTop: '6rem' }}>
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(245,158,11,0.12)' }}
        >
          <LuCheck className="w-7 h-7" style={{ color: ACCENT }} />
        </div>
        <p className="font-semibold text-base-content text-lg text-center">{t('support.thankYou')}</p>
        <Link
          to="/help"
          className="text-sm font-medium no-underline"
          style={{ color: ACCENT }}
        >
          {t('support.backToHelp')}
        </Link>
      </div>
    )
  }

  const canSubmit = name.trim() && email.trim() && message.trim()

  return (
    <div className="px-4 py-6 max-w-lg sm:max-w-2xl mx-auto flex flex-col gap-4 pb-24 sm:pb-8">
      {/* Header */}
      <div className="rounded-2xl px-5 py-5 flex items-center gap-4" style={glass}>
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg, #fcd34d 0%, #f59e0b 100%)',
            boxShadow: '0 4px 16px rgba(245,158,11,0.28)',
          }}
        >
          <LuMessageSquare className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-bold text-base-content">{t('support.title')}</h1>
          <p className="text-xs text-base-content/70 mt-0.5">{t('support.subtitle')}</p>
        </div>
        <Link
          to="/help"
          aria-label="Close"
          className="w-9 h-9 flex items-center justify-center rounded-full flex-shrink-0"
          style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.40)' }}
        >
          <LuX className="w-4 h-4" />
        </Link>
      </div>

      {/* Form */}
      <form
        onSubmit={(e) => { e.preventDefault(); mutation.mutate() }}
        className="flex flex-col gap-4"
      >
        <div className="rounded-2xl px-5 py-5 flex flex-col gap-4" style={glass}>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-base-content/70 uppercase tracking-widest">{t('support.name')}</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              style={inputStyle}
              onFocus={onFocus}
              onBlur={onBlur}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-base-content/70 uppercase tracking-widest">{t('auth.email')}</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={inputStyle}
              onFocus={onFocus}
              onBlur={onBlur}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-base-content/70 uppercase tracking-widest">{t('support.message')}</label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder={t('support.messagePlaceholder')}
              style={{ ...inputStyle, height: '7rem', resize: 'none' }}
              onFocus={onFocus}
              onBlur={onBlur}
            />
          </div>

          {mutation.isError && (
            <p className="text-sm rounded-xl px-3 py-2.5" style={{ background: 'rgba(225,29,72,0.07)', color: '#e11d48' }}>
              {t('support.sendFailed')}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={mutation.isPending || !canSubmit}
          className="w-full h-12 rounded-full text-sm font-semibold flex items-center justify-center gap-2"
          style={{
            background: 'linear-gradient(135deg, #fcd34d 0%, #f59e0b 100%)',
            color: '#101a30',
            border: 'none',
            boxShadow: '0 4px 20px rgba(245,158,11,0.35)',
            opacity: mutation.isPending || !canSubmit ? 0.55 : 1,
            transition: 'opacity 0.15s',
          }}
        >
          {mutation.isPending && <span className="loading loading-spinner loading-xs" />}
          {t('support.send')}
        </button>
      </form>
    </div>
  )
}
