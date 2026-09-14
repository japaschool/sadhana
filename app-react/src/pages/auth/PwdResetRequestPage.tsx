import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
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

export function PwdResetRequestPage() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await authApi.sendConfirmationLink(email, 'PasswordReset')
      setSent(true)
    } catch {
      setError(t('common.error'))
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <GlassShell>
        <div className="flex flex-col gap-4 text-center">
          <h1 className="text-xl font-serif font-extralight text-base-content leading-snug tracking-wide">
            Check your inbox.
          </h1>
          <p className="text-sm text-base-content/60">{t('auth.resetSent')}</p>
          <Link to="/login" className="text-sm font-medium hover:underline" style={{ color: '#f59e0b' }}>
            {t('auth.signIn')}
          </Link>
        </div>
      </GlassShell>
    )
  }

  return (
    <GlassShell>
      <div className="mb-1 text-center">
        <h1 className="text-xl font-serif font-extralight text-base-content leading-snug tracking-wide">
          Reset your<br />password.
        </h1>
        <p className="text-xs text-base-content/70 mt-2">
          Enter your email and we'll send a reset link.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-xs font-medium text-base-content/70 uppercase tracking-wider">
            {t('auth.email')}
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="you@example.com"
            className="w-full h-12 px-4 rounded-xl text-base-content placeholder:text-base-content/45 text-sm focus:outline-none transition-colors"
            style={inputStyle}
            onFocus={e => (e.target.style.borderColor = 'rgba(245,158,11,0.5)')}
            onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.10)')}
          />
        </div>

        {error && <p className="text-sm text-error text-center">{error}</p>}

        <button
          type="submit"
          disabled={loading || !email}
          className="w-full h-12 rounded-full text-sm font-semibold flex items-center justify-center gap-2"
          style={{
            background: 'linear-gradient(135deg, #fcd34d 0%, #f59e0b 100%)',
            color: '#101a30',
            boxShadow: '0 4px 20px rgba(245,158,11,0.35)',
            opacity: loading || !email ? 0.6 : 1,
            cursor: loading || !email ? 'not-allowed' : 'pointer',
          }}
        >
          {loading && <span className="loading loading-spinner loading-sm" />}
          {t('auth.sendLink')}
        </button>
      </form>

      <p className="text-center text-xs text-base-content/70">
        Remember it?{' '}
        <Link to="/login" className="font-medium hover:underline" style={{ color: '#f59e0b' }}>
          {t('auth.signIn')}
        </Link>
      </p>
    </GlassShell>
  )
}
