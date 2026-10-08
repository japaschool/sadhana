import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useYatraAdmin } from '../useYatraAdmin'
import { AdminPage, BTN, CARD, FIELD, HINT } from './AdminPage'
import { ConfirmSheet } from './fields'

export function DangerZoneMobile() {
  const { t } = useTranslation()
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const a = useYatraAdmin(id)
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const close = () => { setOpen(false); setTyped('') }
  return (
    <AdminPage admin={a} title={t('yatraSettings.danger')}>
      {() => {
        const name = a.yatra!.name
        return (
          <>
            <section className={`${CARD} flex flex-col gap-3 p-4`}>
              <h2 className="text-[17px] font-extrabold text-ui-danger">{t('yatraSettings.dangerHint')}</h2>
              <p className={HINT}>{t('yatraSettings.dangerText')}</p>
              <button type="button" onClick={() => setOpen(true)} className={`${BTN} border border-ui-danger text-ui-danger`}>
                {t('yatraSettings.deleteYatra')}
              </button>
            </section>
            {open && (
              <ConfirmSheet title={t('yatraSettings.deleteYatraTitle', { name })} text={t('yatraSettings.deleteYatraText', { count: a.users.length })}
                confirm={t('yatraSettings.deleteForever')} disabled={typed !== name} busy={a.deleteYatra.isPending} onClose={close}
                onConfirm={() => a.deleteYatra.mutate(undefined, { onSuccess: () => navigate('/yatras', { replace: true }) })}>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="confirm-name" className="text-[13px] font-bold text-ui-muted">{t('yatraSettings.typeName')}</label>
                  <input id="confirm-name" value={typed} autoComplete="off" onChange={(e) => setTyped(e.target.value)} className={FIELD} />
                  <p className={HINT}>{t('yatraSettings.typeNameHint')}</p>
                </div>
              </ConfirmSheet>
            )}
          </>
        )
      }}
    </AdminPage>
  )
}
