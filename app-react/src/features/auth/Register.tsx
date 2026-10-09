import { useEffect, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { authApi } from '../../api/auth'
import { useToastStore } from '../../hooks/useToast'
import { useAuthStore } from '../../store/authStore'
import { AuthFrame } from './AuthFrame'
import {
  BackToSignIn, Banner, BTN, Divider, Field, Form, GoogleButton, PasswordField, PrimaryButton, PrimaryLink, SecondaryButton, SentTo, SwitchLink, Title,
} from './kit'
import { failure } from './Login'

const COOLDOWN = 60

/** Don't flag a mismatch while the confirmation is still being typed toward a match. */
export function mismatch(password: string, confirm: string) {
  return !!confirm && confirm !== password && (confirm.length >= password.length || !password.startsWith(confirm))
}

/** "Resend in 42s" until the cooldown runs out, then "Resend email". */
export function ResendButton({ email, type }: { email: string; type: 'Registration' | 'PasswordReset' }) {
  const { t } = useTranslation()
  const showToast = useToastStore((s) => s.showToast)
  const [left, setLeft] = useState(COOLDOWN)
  const resend = useMutation({
    mutationFn: () => authApi.sendConfirmationLink(email, type),
    onSuccess: () => { setLeft(COOLDOWN); showToast({ message: t('auth.resendSent'), variant: 'success' }) },
    onError: (e) => showToast({ message: t(failure(e).key), variant: 'error' }),
  })
  useEffect(() => {
    if (left <= 0) return
    const id = setTimeout(() => setLeft((s) => s - 1), 1000)
    return () => clearTimeout(id)
  }, [left])

  if (left > 0) return (
    <p role="timer" className={`${BTN} gap-1.5 bg-ui-hairline text-ui-muted`}>
      {t('auth.resendInLabel')}<span className="font-ui-mono text-ui-ink2">{left}s</span>
    </p>
  )
  return <SecondaryButton disabled={resend.isPending} onClick={() => resend.mutate()}>{t('auth.resendEmail')}</SecondaryButton>
}

/** Step 1: an email gets a confirmation link; then "Check your inbox". */
export function Register() {
  const { t } = useTranslation()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [email, setEmail] = useState('')
  const send = useMutation({ mutationFn: () => authApi.sendConfirmationLink(email.trim(), 'Registration') })
  const google = useMutation({ mutationFn: (token: string) => authApi.googleSignin(token), onSuccess: setAuth })
  const [googleFailed, setGoogleFailed] = useState(false)
  const busy = send.isPending || google.isPending
  const err = send.error ?? google.error

  if (send.isSuccess) return (
    <AuthFrame footer={<BackToSignIn />}>
      <div className="flex flex-col gap-7">
        <Title medallion="accent" hint={<><p>{t('auth.checkEmail')}</p><SentTo email={email.trim()} /></>}>{t('auth.inboxCheck')}</Title>
        <ResendButton email={email.trim()} type="Registration" />
      </div>
    </AuthFrame>
  )

  return (
    <AuthFrame footer={<SwitchLink prompt={t('auth.hasAccount')} to="/login">{t('auth.signIn')}</SwitchLink>}>
      <Form onSubmit={() => { if (email.trim() && !busy) { google.reset(); setGoogleFailed(false); send.mutate() } }}>
        <Title hint={<p>{t('auth.registerHint')}</p>}>{t('auth.headlineRegister')}</Title>
        <div className="flex flex-col gap-4">
          {(err || googleFailed) && <Banner>{t(err ? failure(err).key : 'auth.serverError')}</Banner>}
          <Field id="email" type="email" label={t('auth.email')} value={email} onChange={(v) => { setEmail(v); send.reset() }}
            disabled={busy} autoComplete="email" inputMode="email" placeholder="name@example.com" autoFocus />
        </div>
        <div className="flex flex-col gap-3.5">
          <PrimaryButton busy={send.isPending} busyLabel={t('auth.sending')} disabled={!email.trim() || google.isPending}>{t('auth.sendLink')}</PrimaryButton>
          <Divider />
          <GoogleButton disabled={busy} onToken={(token) => { send.reset(); setGoogleFailed(false); google.mutate(token) }}
            onError={() => { send.reset(); setGoogleFailed(true) }} />
        </div>
      </Form>
    </AuthFrame>
  )
}

export function Spinner() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-1 items-center justify-center py-16">
      <span role="status" aria-label={t('common.loading')} className="h-6 w-6 animate-spin rounded-full border-2 border-ui-control border-t-ui-accent" />
    </div>
  )
}

/** Step 2, from the emailed link: name and password. */
export function ConfirmRegistration() {
  const { t, i18n } = useTranslation()
  const { id = '' } = useParams()
  const setAuth = useAuthStore((s) => s.setAuth)
  const details = useQuery({ queryKey: ['confirmation', id], queryFn: () => authApi.getConfirmationDetails(id), retry: false })
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const create = useMutation({
    mutationFn: () => authApi.register(id, details.data!.email, password, name.trim(), (i18n.resolvedLanguage || 'en').slice(0, 2)),
    onSuccess: setAuth,
  })
  const expired = details.isError || (!!details.data && new Date(details.data.expires_at) < new Date())
  const ready = !!name.trim() && !!password && confirm === password

  if (details.isLoading) return <AuthFrame><Spinner /></AuthFrame>

  if (expired) return (
    <AuthFrame footer={<SwitchLink prompt={t('auth.hasAccount')} to="/login">{t('auth.signIn')}</SwitchLink>}>
      <div className="flex flex-col gap-7">
        <Title medallion="danger" hint={<p>{t('auth.expiredHint')}</p>}>{t('auth.confirmationExpired')}</Title>
        <PrimaryLink to="/register">{t('auth.signUp')}</PrimaryLink>
      </div>
    </AuthFrame>
  )

  const edit = (set: (v: string) => void) => (v: string) => { set(v); create.reset() }
  return (
    <AuthFrame>
      <Form onSubmit={() => { if (ready && !create.isPending) create.mutate() }}>
        <Title>{t('auth.createTitle')}</Title>
        <div className="flex flex-col gap-4">
          {create.isError && <Banner>{t(failure(create.error).key)}</Banner>}
          <Field id="email" type="email" label={t('auth.email')} value={details.data?.email ?? ''} onChange={() => {}} readOnly
            trailing={
              <span className="flex shrink-0 items-center gap-1.5 pr-1.5 text-xs font-bold text-ui-good">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-ui-good" />{t('auth.confirmed')}
              </span>
            } />
          <Field id="name" label={t('auth.name')} value={name} onChange={edit(setName)} disabled={create.isPending} autoComplete="name" />
          <PasswordField id="password" label={t('auth.password')} value={password} onChange={edit(setPassword)}
            disabled={create.isPending} autoComplete="new-password" />
          <PasswordField id="confirm-password" label={t('auth.confirmPassword')} value={confirm} onChange={edit(setConfirm)}
            disabled={create.isPending} autoComplete="new-password" error={mismatch(password, confirm) ? t('auth.passwordMismatch') : null} />
        </div>
        <PrimaryButton busy={create.isPending} busyLabel={t('auth.creating')} disabled={!ready}>{t('auth.register')}</PrimaryButton>
      </Form>
    </AuthFrame>
  )
}
