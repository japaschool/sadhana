import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BottomSheet } from '../../../../ui/primitives/BottomSheet'

const BTN = 'flex h-[50px] items-center justify-center rounded-[14px] text-[15px] font-bold'

export function LeaveSheets({ yatraId, yatraName, lastAdmin, leaving, onLeave, onClose }: {
  yatraId: string; yatraName: string; lastAdmin: boolean; leaving: boolean; onLeave: () => void; onClose: () => void
}) {
  const { t } = useTranslation()
  const cancel = (
    <button type="button" onClick={onClose} className={`${BTN} border border-ui-control text-ui-ink`}>{t('common.cancel')}</button>
  )
  if (lastAdmin) {
    const title = t('yatraSettings.lastAdminTitle')
    return (
      <BottomSheet label={title} onClose={onClose}>
        <h2 className="text-xl font-extrabold text-ui-ink">{title}</h2>
        <p className="text-sm leading-normal text-ui-ink2">{t('yatraSettings.lastAdminText')}</p>
        <div className="flex flex-col gap-2.5">
          {/* ponytail: phase 2 points these at /admin/members and /admin/danger */}
          <Link to={`/yatra/${yatraId}/admin/settings`} className={`${BTN} bg-ui-primary text-ui-on-primary`}>{t('yatraSettings.chooseAdmin')}</Link>
          <Link to={`/yatra/${yatraId}/admin/settings`} className={`${BTN} border border-ui-control text-ui-danger`}>{t('yatraSettings.deleteYatra')}</Link>
          {cancel}
        </div>
      </BottomSheet>
    )
  }
  const title = t('yatraSettings.leaveTitle', { name: yatraName })
  return (
    <BottomSheet label={title} onClose={onClose}>
      <h2 className="text-xl font-extrabold text-ui-ink">{title}</h2>
      <p className="text-sm leading-normal text-ui-ink2">{t('yatraSettings.leaveText')}</p>
      <div className="flex flex-col gap-2.5">
        <button type="button" disabled={leaving} onClick={onLeave} className={`${BTN} bg-ui-danger text-white disabled:opacity-60`}>
          {t('yatraSettings.leave')}
        </button>
        {cancel}
      </div>
    </BottomSheet>
  )
}
