import { useState } from 'react'
import type { ComponentProps, InputHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google'
import { useLayout } from '../../layouts/useLayout'

/** The auth form kit (Turn 14): one field, primary button, Google button, error banner and text link for every screen. */

const BOX = 'flex min-h-[52px] items-center gap-2 rounded-xl border bg-ui-surface pr-2 pl-3.5'
const BOX_STATE = 'border-ui-control focus-within:border-ui-accent-fill focus-within:shadow-[0_0_0_4px_var(--ui-accent-soft)]'
const BOX_INVALID = 'border-ui-danger shadow-[0_0_0_4px_var(--ui-danger-soft)]'
export const BTN = 'flex min-h-[52px] w-full items-center justify-center gap-2.5 rounded-2xl px-4 py-3 text-center text-base leading-tight font-bold'
export const SPINNER = 'h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent'

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  invalid?: boolean
  error?: string | null
  /** Right of the value, inside the box (Show, Confirmed). */
  trailing?: ReactNode
}

/** Label above the field, so ru/uk labels wrap instead of being cut. */
export function Field({ id, label, value, onChange, invalid, error, trailing, readOnly, className = '', ...input }: FieldProps) {
  const bad = invalid || !!error
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-bold text-ui-muted">{label}</label>
      <div className={`${BOX} ${readOnly ? 'border-transparent bg-ui-chip' : bad ? BOX_INVALID : BOX_STATE}`}>
        <input id={id} value={value} readOnly={readOnly} aria-invalid={bad} aria-describedby={error ? `${id}-err` : undefined}
          onChange={(e) => onChange(e.target.value)}
          className={`min-w-0 flex-1 bg-transparent text-base text-ui-ink outline-none placeholder:text-ui-faint2 disabled:opacity-60 ${readOnly ? 'text-ui-ink2' : ''} ${className}`}
          {...input} />
        {trailing}
      </div>
      {error && (
        <p id={`${id}-err`} role="alert" className="flex items-center gap-1.5 text-[13px] font-semibold text-ui-danger-text">
          <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-ui-danger" />{error}
        </p>
      )}
    </div>
  )
}

/** Show/Hide is a text button, not an eye. */
export function PasswordField(props: Omit<FieldProps, 'trailing' | 'type'>) {
  const { t } = useTranslation()
  const [shown, setShown] = useState(false)
  return (
    <Field {...props} type={shown ? 'text' : 'password'} spellCheck={false}
      className={props.value && !shown ? 'font-ui-mono tracking-[.08em]' : ''}
      trailing={
        <button type="button" aria-pressed={shown} aria-controls={props.id} disabled={props.disabled} onClick={() => setShown((s) => !s)}
          className="flex min-h-11 shrink-0 items-center px-1.5 text-[13px] font-bold text-ui-accent disabled:opacity-60">
          {t(shown ? 'auth.hide' : 'auth.show')}
        </button>
      } />
  )
}

/** Keeps its size while busy; the label changes and a spinner appears. */
export function PrimaryButton({ busy, busyLabel, children, ...btn }: { busy?: boolean; busyLabel?: string; children: ReactNode } & Omit<ComponentProps<'button'>, 'children'>) {
  return (
    <button type="submit" aria-busy={busy} {...btn} disabled={btn.disabled || busy}
      className={`${BTN} bg-ui-selected text-ui-on-selected ${busy ? '' : 'disabled:opacity-45'}`}>
      {busy ? <><span aria-hidden className={SPINNER} />{busyLabel}</> : children}
    </button>
  )
}

export function SecondaryButton({ children, ...btn }: ComponentProps<'button'>) {
  return (
    <button type="button" {...btn} className={`${BTN} border border-ui-control bg-ui-surface text-ui-ink disabled:opacity-60`}>{children}</button>
  )
}

export function PrimaryLink({ to, children }: { to: string; children: ReactNode }) {
  return <Link to={to} className={`${BTN} bg-ui-selected text-ui-on-selected`}>{children}</Link>
}

/** Network and server errors, above the fields. */
export function Banner({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="flex items-start gap-2.5 rounded-[14px] bg-ui-danger-soft px-3.5 py-3 text-sm leading-snug font-semibold text-ui-danger-text">
      <span aria-hidden className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-ui-danger" />
      <span>{children}</span>
    </div>
  )
}

const TITLE = { mobile: 'text-[30px]', tablet: 'text-[32px]', desktop: 'text-[38px]' }

export function Title({ children, hint, medallion }: { children: ReactNode; hint?: ReactNode; medallion?: 'accent' | 'danger' }) {
  const layout = useLayout()
  return (
    <div className="flex flex-col gap-5">
      {medallion && (
        <span aria-hidden className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full ${medallion === 'danger' ? 'bg-ui-danger-soft' : 'bg-ui-accent-pill'}`}>
          <span className={`h-[22px] w-[22px] rounded-full ${medallion === 'danger' ? 'bg-ui-danger' : 'bg-ui-accent-fill'}`} />
        </span>
      )}
      <div className="flex flex-col gap-2.5">
        <h1 className={`${TITLE[layout]} leading-[1.1] font-extrabold tracking-[-0.025em] text-balance`}>{children}</h1>
        {hint && <div className="flex flex-col gap-2.5 text-[15px] leading-normal text-pretty text-ui-ink2">{hint}</div>}
      </div>
    </div>
  )
}

export function SentTo({ email }: { email: string }) {
  const { t } = useTranslation()
  return (
    <p className="mt-1.5 flex max-w-full items-center gap-2 self-start rounded-full bg-ui-hairline px-3 py-2 font-ui-mono text-sm font-medium text-ui-ink">
      <span className="shrink-0 font-ui text-xs font-semibold text-ui-muted">{t('auth.sentTo')}</span>
      <span className="truncate">{email}</span>
    </p>
  )
}

/** "Don't have an account? Sign up": the prompt is optional. */
export function SwitchLink({ prompt, to, children }: { prompt?: string; to: string; children: ReactNode }) {
  return (
    <p className="flex flex-wrap justify-center gap-x-1.5 gap-y-0.5 text-center text-sm leading-normal text-ui-muted">
      {prompt && <span>{prompt}</span>}
      <Link to={to} className="font-bold text-ui-accent">{children}</Link>
    </p>
  )
}

export function BackToSignIn() {
  const { t } = useTranslation()
  return <SwitchLink to="/login">{t('auth.backToSignIn')}</SwitchLink>
}

/** Shared slot for every form: title block 28px above the fields, fields 28px above the buttons. */
export function Form({ onSubmit, children }: { onSubmit: () => void; children: ReactNode }) {
  return (
    <form noValidate className="flex flex-col gap-7" onSubmit={(e) => { e.preventDefault(); onSubmit() }}>{children}</form>
  )
}

export function Divider() {
  const { t } = useTranslation()
  return (
    <div className="flex items-center gap-3 text-xs font-semibold text-ui-faint2">
      <span className="h-px flex-1 bg-ui-control" />
      <span className="text-center">{t('auth.orContinueWith')}</span>
      <span className="h-px flex-1 bg-ui-control" />
    </div>
  )
}

interface GoogleProps { onToken: (accessToken: string) => void; onError: () => void; disabled?: boolean }

function GoogleFace({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  const { t } = useTranslation()
  return (
    <SecondaryButton disabled={disabled} onClick={onClick}>
      <span aria-hidden className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-ui-control text-[11px] font-extrabold text-ui-ink2">G</span>
      {t('auth.continueGoogle')}
    </SecondaryButton>
  )
}

function GoogleWithProvider({ onToken, onError, disabled }: GoogleProps) {
  const login = useGoogleLogin({ onSuccess: (r) => onToken(r.access_token), onError })
  return <GoogleFace disabled={disabled} onClick={() => login()} />
}

export function GoogleButton(props: GoogleProps) {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
  // Without a client id (local dev) there's no Google to call: the button just reports an error.
  if (!clientId) return <GoogleFace disabled={props.disabled} onClick={props.onError} />
  return (
    <GoogleOAuthProvider clientId={clientId}>
      <GoogleWithProvider {...props} />
    </GoogleOAuthProvider>
  )
}
