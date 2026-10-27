import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { authApi } from '../../api/auth'
import { useToastStore } from '../../hooks/useToast'
import { AuthFrame } from './AuthFrame'
import { BackToSignIn, Banner, Field, Form, PasswordField, PrimaryButton, SentTo, Title } from './kit'
import { failure } from './Login'
import { mismatch, ResendButton } from './Register'

/** /reset: an email gets a reset link. */
export function ResetRequest() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const send = useMutation({ mutationFn: () => authApi.sendConfirmationLink(email.trim(), 'PasswordReset') })

  if (send.isSuccess) return (
    <AuthFrame footer={<BackToSignIn />}>
      <div className="flex flex-col gap-7">
        <Title medallion="accent" hint={<><p>{t('auth.resetSentHint')}</p><SentTo email={email.trim()} /></>}>{t('auth.resetSent')}</Title>
        <ResendButton email={email.trim()} type="PasswordReset" />
      </div>
    </AuthFrame>
  )

  return (
    <AuthFrame footer={<BackToSignIn />}>
      <Form onSubmit={() => { if (email.trim() && !send.isPending) send.mutate() }}>
        <Title hint={<p>{t('auth.resetHint')}</p>}>{t('auth.resetTitle')}</Title>
        <div className="flex flex-col gap-4">
          {send.isError && <Banner>{t(failure(send.error).key)}</Banner>}
          <Field id="email" type="email" label={t('auth.email')} value={email} onChange={(v) => { setEmail(v); send.reset() }}
            disabled={send.isPending} autoComplete="email" inputMode="email" placeholder="name@example.com" autoFocus />
        </div>
        <PrimaryButton busy={send.isPending} busyLabel={t('auth.sending')} disabled={!email.trim()}>{t('auth.sendLink')}</PrimaryButton>
      </Form>
    </AuthFrame>
  )
}

/** /reset/:id, from the emailed link: the new password, then Sign in. */
export function ResetPassword() {
  const { t } = useTranslation()
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const showToast = useToastStore((s) => s.showToast)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const save = useMutation({
    mutationFn: () => authApi.resetPassword(id, password),
    onSuccess: () => { showToast({ message: t('password.changed'), variant: 'success' }); navigate('/login', { replace: true }) },
  })
  const ready = !!password && confirm === password
  const edit = (set: (v: string) => void) => (v: string) => { set(v); save.reset() }

  return (
    <AuthFrame>
      <Form onSubmit={() => { if (ready && !save.isPending) save.mutate() }}>
        <Title>{t('auth.newPasswordTitle')}</Title>
        <div className="flex flex-col gap-4">
          {save.isError && <Banner>{t(failure(save.error).key)}</Banner>}
          <PasswordField id="new-password" label={t('auth.newPassword')} value={password} onChange={edit(setPassword)}
            disabled={save.isPending} autoComplete="new-password" />
          <PasswordField id="confirm-password" label={t('auth.confirmPassword')} value={confirm} onChange={edit(setConfirm)}
            disabled={save.isPending} autoComplete="new-password" error={mismatch(password, confirm) ? t('auth.passwordMismatch') : null} />
        </div>
        <PrimaryButton busy={save.isPending} busyLabel={t('auth.saving')} disabled={!ready}>{t('auth.setPassword')}</PrimaryButton>
      </Form>
    </AuthFrame>
  )
}
