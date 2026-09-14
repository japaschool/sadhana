import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { FaEye, FaEyeSlash } from 'react-icons/fa'
import { authApi } from '../../api/auth'
import { AuthBackground } from '../../components/layout/AuthBackground'

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.10)',
}

function GlassShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12 relative overflow-hidden">
      <AuthBackground />
      <div className="absolute inset-0 bg-black/30 pointer-events-none" />
      <div
        className="relative w-full max-w-sm rounded-3xl px-8 py-10 flex flex-col gap-5"
        style={{
          background: 'rgba(39,54,86,0.72)',
          backdropFilter: 'blur(36px)',
          WebkitBackdropFilter: 'blur(36px)',
          border: '1px solid rgba(255,255,255,0.10)',
          boxShadow: '0 12px 48px rgba(0,0,0,0.5)',
        }}
      >
        {children}
      </div>
    </div>
  )
}

function PasswordField({ id, label, value, onChange, autoComplete }: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  autoComplete: string
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-base-content/70 uppercase tracking-wider">{label}</label>
      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          autoComplete={autoComplete}
          className="w-full h-12 px-4 pr-14 rounded-xl text-base-content text-sm focus:outline-none transition-colors"
          style={inputStyle}
          onFocus={e => (e.target.style.borderColor = 'rgba(245,158,11,0.5)')}
          onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.10)')}
        />
        <button
          type="button"
          onClick={() => setShow(v => !v)}
          className="absolute right-4 top-1/2 -translate-y-1/2"
          style={{ color: '#f59e0b', background: 'none', border: 'none' }}
        >
          {show ? <FaEyeSlash className="w-4 h-4" /> : <FaEye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}

export function PwdResetPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirmPassword) { setError(t('auth.passwordMismatch')); return }
    setError(null)
    setLoading(true)
    try {
      await authApi.resetPassword(id!, password)
      navigate('/login', { replace: true })
    } catch {
      setError(t('common.error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <GlassShell>
      <div className="mb-1 text-center">
        <h1 className="text-xl font-serif font-extralight text-base-content leading-snug tracking-wide">
          Set your new<br />password.
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <PasswordField
          id="new-password"
          label={t('auth.newPassword')}
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
        />
        <PasswordField
          id="confirm-password"
          label={t('auth.confirmPassword')}
          value={confirmPassword}
          onChange={setConfirmPassword}
          autoComplete="new-password"
        />

        {error && <p className="text-sm text-error text-center">{error}</p>}

        <button
          type="submit"
          disabled={loading || !password || !confirmPassword}
          className="w-full h-12 rounded-full text-sm font-semibold flex items-center justify-center gap-2"
          style={{
            background: 'linear-gradient(135deg, #fcd34d 0%, #f59e0b 100%)',
            color: '#101a30',
            boxShadow: '0 4px 20px rgba(245,158,11,0.35)',
            opacity: loading || !password || !confirmPassword ? 0.6 : 1,
            cursor: loading || !password || !confirmPassword ? 'not-allowed' : 'pointer',
          }}
        >
          {loading && <span className="loading loading-spinner loading-sm" />}
          {t('auth.setPassword')}
        </button>
      </form>
    </GlassShell>
  )
}
