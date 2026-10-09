import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supportApi } from '../../api/support'
import { useLayout } from '../../layouts/useLayout'
import { useAuthStore } from '../../store/authStore'
import { CARD, FIELD } from '../yatras/settings/mobile/AdminPage'
import { ErrorBanner, LABEL, PRIMARY, SettingsDetail, SPINNER } from './SettingsDetail'

const SUBJECT_MAX = 128
const MESSAGE_MAX = 4000
/** The counter shows only near the limit. */
const COUNTER_FROM = 3600

export function SendMessage() {
  const { t, i18n } = useTranslation()
  const mobile = useLayout() === 'mobile'
  const email = useAuthStore((s) => s.user?.email ?? '')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const send = useMutation({ mutationFn: () => supportApi.sendMessage({ subject: subject.trim(), message: message.trim() }) })
  const ready = !!subject.trim() && !!message.trim()
  const back = mobile ? { to: '/help', label: t('help.short') } : { to: '/help', label: t('settings.helpSupport') }

  if (send.isSuccess) return (
    <SettingsDetail title={t('support.title')} back={back}>
      <div className={`${CARD} flex flex-col items-center gap-2 px-6 py-8 text-center`}>
        <span aria-hidden className="mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-ui-good text-2xl text-white">✓</span>
        <h2 role="status" className="text-xl font-extrabold text-ui-ink">{t('support.sent')}</h2>
        <p className="text-sm leading-normal text-ui-ink2">{t('support.thanks', { email })}</p>
        <Link to="/help" className="mt-3 flex min-h-11 items-center gap-1 text-[15px] font-bold text-ui-accent">
          <span aria-hidden>‹</span>{t('support.backToHelp')}
        </Link>
      </div>
    </SettingsDetail>
  )

  return (
    <SettingsDetail title={t('support.title')} back={back} subtitle={t('support.replyTo', { email })} footer={
      <button type="button" className={PRIMARY} disabled={!ready || send.isPending} onClick={() => send.mutate()}>
        {send.isPending
          ? <><span aria-hidden className={SPINNER} />{t('support.sending')}</>
          : t(send.isError ? 'support.tryAgain' : 'support.send')}
      </button>
    }>
      <div className={`${CARD} flex flex-col gap-4 p-4`}>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="support-subject" className={LABEL}>{t('support.subject')}</label>
          <input id="support-subject" value={subject} maxLength={SUBJECT_MAX} disabled={send.isPending}
            placeholder={t('support.subjectPlaceholder')} className={`${FIELD} disabled:opacity-50`}
            onChange={(e) => setSubject(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="support-message" className={LABEL}>{t('support.message')}</label>
          <textarea id="support-message" value={message} maxLength={MESSAGE_MAX} disabled={send.isPending} rows={7}
            placeholder={t('support.messagePlaceholder')} aria-describedby="support-count"
            className={`${FIELD} resize-y py-3 leading-normal disabled:opacity-50`}
            onChange={(e) => setMessage(e.target.value)} />
          {message.length >= COUNTER_FROM && (
            <p id="support-count" className="self-end font-ui-mono text-xs font-semibold text-ui-accent">
              {message.length.toLocaleString(i18n.language)} / {MESSAGE_MAX}
            </p>
          )}
        </div>
      </div>
      {send.isError && <ErrorBanner title={t('support.failed')} text={t('support.failedHint')} />}
    </SettingsDetail>
  )
}
