import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { authApi } from '../../api/auth'
import { useAuthStore } from '../../store/authStore'
import type { UserInfo } from '../../types/api'
import { AuthFrame } from './AuthFrame'
import { Banner, Divider, Field, Form, GoogleButton, PasswordField, PrimaryButton, SwitchLink, Title } from './kit'

/** The banner's text for a failed request. `signIn`: a 401 means the credentials were rejected (`wrong`). */
export function failure(err: unknown, signIn = false): { key: string; wrong: boolean } {
  if (signIn && isAxiosError(err) && err.response?.status === 401) return { key: 'auth.wrongCredentials', wrong: true }
  if (!navigator.onLine || (isAxiosError(err) && !err.response)) return { key: 'auth.offline', wrong: false }
  return { key: 'auth.serverError', wrong: false }
}

// GuestRoute sends a signed-in user on (back to an invite link, or Today), so success only stores the user.
export function Login() {
  const { t, i18n } = useTranslation()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const signIn = useMutation({ mutationFn: () => authApi.login(email.trim(), password), onSuccess: setAuth })
  const google = useMutation({ mutationFn: (token: string) => authApi.googleSignin(token, (i18n.resolvedLanguage || 'en').slice(0, 2)), onSuccess: (u: UserInfo) => setAuth(u) })
  const [googleFailed, setGoogleFailed] = useState(false)
  const busy = signIn.isPending || google.isPending
  const err = signIn.error ? failure(signIn.error, true) : google.error ? failure(google.error, true) : googleFailed ? { key: 'auth.serverError', wrong: false } : null
  const edit = (set: (v: string) => void) => (v: string) => { set(v); signIn.reset() }

  return (
    <AuthFrame footer={<div className="flex flex-col items-center gap-2">
      <SwitchLink prompt={t('auth.noAccount')} to="/register">{t('auth.signUp')}</SwitchLink>
      <SwitchLink to="/help">{t('settings.helpSupport')}</SwitchLink>
    </div>}>
      <Form onSubmit={() => { if (email && password && !busy) { setGoogleFailed(false); google.reset(); signIn.mutate() } }}>
        <Title>{t('auth.headline')}</Title>
        <div className="flex flex-col gap-4">
          {err && <Banner>{t(err.key)}</Banner>}
          <Field id="email" type="email" label={t('auth.email')} value={email} onChange={edit(setEmail)} disabled={busy}
            autoComplete="email" inputMode="email" placeholder="name@example.com" invalid={err?.wrong} />
          <PasswordField id="password" label={t('auth.password')} value={password} onChange={edit(setPassword)} disabled={busy}
            autoComplete="current-password" invalid={err?.wrong} />
          <div className="-mt-2 -mb-3 flex justify-end">
            <Link to="/reset" className="flex min-h-11 items-center text-sm font-bold text-ui-accent">{t('auth.forgotPassword')}</Link>
          </div>
        </div>
        <div className="flex flex-col gap-3.5">
          <PrimaryButton busy={signIn.isPending} busyLabel={t('auth.signingIn')} disabled={google.isPending}>{t('auth.signIn')}</PrimaryButton>
          <Divider />
          <GoogleButton disabled={busy} onToken={(token) => { signIn.reset(); setGoogleFailed(false); google.mutate(token) }}
            onError={() => { signIn.reset(); setGoogleFailed(true) }} />
        </div>
      </Form>
    </AuthFrame>
  )
}
