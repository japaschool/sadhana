import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { FaEye, FaEyeSlash } from 'react-icons/fa'
import { authApi } from '../../api/auth'
import { useAuthStore } from '../../store/authStore'
import { AuthBackground } from '../../components/layout/AuthBackground'
import { GoogleLoginButton } from '../../components/ui/GoogleLoginButton'

export function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const user = await authApi.login(email, password)
      setAuth(user)
      navigate('/', { replace: true })
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 401) {
        setError(t('auth.wrongCredentials'))
      } else if (!navigator.onLine) {
        setError(t('auth.offline'))
      } else {
        setError(t('auth.serverError'))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12 relative overflow-hidden">
      <AuthBackground />
      {/* Dark overlay to improve readability */}
      <div className="absolute inset-0 bg-black/30 pointer-events-none" />

      {/* Glass card */}
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
        {/* Headline */}
        <div className="mb-1 text-center">
          <h1 className="text-xl font-serif font-extralight text-base-content leading-snug tracking-wide" style={{ whiteSpace: 'pre-line' }}>
            {t('auth.headline')}
          </h1>
          <p className="text-xs text-base-content/70 mt-2">
            {t('auth.noAccount')}{' '}
            <Link to="/register" className="font-medium hover:underline" style={{ color: '#f59e0b' }}>
              {t('auth.signUp')}
            </Link>
          </p>
        </div>

        {/* Email + password form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-xs font-medium text-base-content/70 uppercase tracking-wider">{t('auth.email')}</label>
            <input
              id="email"
              type="email"
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

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-xs font-medium text-base-content/70 uppercase tracking-wider">{t('auth.password')}</label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="w-full h-12 px-4 pr-16 rounded-xl text-base-content text-sm focus:outline-none transition-colors"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.10)',
                }}
                onFocus={e => (e.target.style.borderColor = 'rgba(245,158,11,0.5)')}
                onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.10)')}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors"
                style={{ color: '#f59e0b' }}
              >
                {showPassword ? <FaEyeSlash className="w-4 h-4" /> : <FaEye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <p role="alert" className="text-sm text-error text-center">{error}</p>
          )}

          <div className="text-center -mt-1">
            <Link to="/reset" className="text-sm text-base-content/70 hover:text-primary transition-colors">
              {t('auth.forgotPassword')}
            </Link>
          </div>

          {/* Sign in — teal pill */}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-full text-sm font-semibold transition-all flex items-center justify-center gap-2"
            style={{
              background: 'linear-gradient(135deg, #fcd34d 0%, #f59e0b 100%)',
              color: '#101a30',
              boxShadow: '0 4px 20px rgba(245,158,11,0.35)',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading && <span className="loading loading-spinner loading-sm" />}
            {t('auth.signIn')}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.10)' }} />
          <span className="text-xs text-base-content/70 font-medium">{t('auth.orContinueWith')}</span>
          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.10)' }} />
        </div>

        {/* OAuth buttons */}
        <GoogleLoginButton
          onSuccess={async (accessToken) => {
            try {
              const user = await authApi.googleSignin(accessToken)
              setAuth(user)
              navigate('/', { replace: true })
            } catch {
              setError(t('common.error'))
            }
          }}
          onError={() => setError(t('common.error'))}
        />

      </div>
    </div>
  )
}
