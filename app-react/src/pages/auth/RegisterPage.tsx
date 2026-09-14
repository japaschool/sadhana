import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { authApi } from '../../api/auth'
import { AuthBackground } from '../../components/layout/AuthBackground'
import { useToast } from '../../hooks/useToast'

export function RegisterPage() {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [resendCountdown, setResendCountdown] = useState(0)
  const [resending, setResending] = useState(false)
  const [resendTrigger, setResendTrigger] = useState(0)

  useEffect(() => {
    if (!sent) return
    setResendCountdown(30)
    const interval = setInterval(() => {
      setResendCountdown(c => {
        if (c <= 1) { clearInterval(interval); return 0 }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [sent, resendTrigger])

  async function handleResend() {
    setResending(true)
    try {
      await authApi.sendConfirmationLink(email, 'Registration')
      showToast({ message: t('auth.resendSent'), variant: 'success' })
      setResendTrigger(c => c + 1)
    } catch {
      showToast({ message: t('common.error'), variant: 'error' })
    } finally {
      setResending(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await authApi.sendConfirmationLink(email, 'Registration')
      setSent(true)
    } catch {
      setError(t('common.error'))
    } finally {
      setLoading(false)
    }
  }

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
        {sent ? (
          <div className="flex flex-col gap-4 text-center">
            <h1 className="text-xl font-serif font-extralight text-base-content leading-snug tracking-wide">
              {t('auth.inboxCheck')}
            </h1>
            <p className="text-sm text-base-content/60">{t('auth.checkEmail')}</p>
            <Link
              to="/login"
              className="text-sm font-medium hover:underline"
              style={{ color: '#f59e0b' }}
            >
              {t('auth.signIn')}
            </Link>
            {resendCountdown > 0 ? (
              <p className="text-xs" style={{ color: 'rgba(242,244,246,0.7)' }}>
                {t('auth.resendIn', { seconds: resendCountdown })}
              </p>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                disabled={resending}
                className="text-sm font-medium hover:underline"
                style={{ color: '#f59e0b', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                {resending ? '…' : t('auth.resendEmail')}
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="mb-1 text-center">
              <h1 className="text-xl font-serif font-extralight text-base-content leading-snug tracking-wide" style={{ whiteSpace: 'pre-line' }}>
                {t('auth.headlineRegister')}
              </h1>
              <p className="text-xs text-base-content/70 mt-2">
                {t('auth.hasAccount')}{' '}
                <Link to="/login" className="font-medium hover:underline" style={{ color: '#f59e0b' }}>
                  {t('auth.signIn')}
                </Link>
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
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="w-full h-12 px-4 rounded-xl text-base-content placeholder:text-base-content/45 text-sm focus:outline-none transition-colors"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.10)',
                  }}
                  onFocus={e => (e.target.style.borderColor = 'rgba(245,158,11,0.5)')}
                  onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.10)')}
                />
              </div>

              {error && (
                <p className="text-sm text-error text-center">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-full text-sm font-semibold transition-all flex items-center justify-center gap-2"
                style={{
                  background: 'linear-gradient(135deg, #fcd34d 0%, #f59e0b 100%)',
                  color: '#101a30',
                  boxShadow: '0 4px 20px rgba(245,158,11,0.35)',
                }}
              >
                {loading && <span className="loading loading-spinner loading-sm" />}
                {t('auth.sendLink')}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
