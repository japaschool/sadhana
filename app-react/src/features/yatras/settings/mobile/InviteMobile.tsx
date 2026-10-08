import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useToast } from '../../../../hooks/useToast'
import { useYatraAdmin } from '../useYatraAdmin'
import { AdminPage, BTN, CARD, HINT, SECTION_TITLE } from './AdminPage'

export function InviteMobile() {
  const { t } = useTranslation()
  const { id = '' } = useParams()
  const a = useYatraAdmin(id)
  const { showToast } = useToast()
  const url = `${window.location.origin}/yatra/${id}/join`
  const canShare = typeof navigator.share === 'function'

  function copy() {
    // clipboard is missing outside secure contexts: that's an error toast, not a crash.
    new Promise<void>((resolve) => resolve(navigator.clipboard.writeText(url)))
      .then(
        () => showToast({ message: t('yatraSettings.copied'), variant: 'success' }),
        () => showToast({ message: t('common.error'), variant: 'error' }),
      )
  }

  return (
    <AdminPage admin={a} title={t('yatraSettings.invite')}>
      {() => (
        <section className={`${CARD} flex flex-col gap-3 p-4`}>
          <h2 className={SECTION_TITLE}>{t('yatraSettings.inviteTitle')}</h2>
          <p className={HINT}>{t('yatraSettings.inviteText', { name: a.yatra!.name })}</p>
          <p className="rounded-xl bg-ui-field px-3.5 py-3 font-ui-mono text-sm break-all text-ui-ink">{url.replace(/^https?:\/\//, '')}</p>
          <div className="flex gap-2.5">
            {canShare && (
              <button type="button" onClick={() => { navigator.share({ title: a.yatra!.name, url }).catch(() => { /* dismissed */ }) }}
                className={`${BTN} flex-1 bg-ui-primary text-ui-on-primary`}>
                {t('yatraSettings.share')}
              </button>
            )}
            <button type="button" onClick={copy} className={`${BTN} flex-1 border border-ui-control text-ui-ink`}>{t('yatraSettings.copy')}</button>
          </div>
          {canShare && <p className={HINT}>{t('yatraSettings.shareHint')}</p>}
        </section>
      )}
    </AdminPage>
  )
}
