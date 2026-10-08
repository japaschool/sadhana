import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { SettingsRow } from '../../../settings/mobile/SettingsRow'
import { useYatraAdmin } from '../useYatraAdmin'
import { AdminPage, LIST } from './AdminPage'
import { membersLine } from './summaries'

export function ManageYatraMobile() {
  const { t } = useTranslation()
  const { id = '' } = useParams()
  const a = useYatraAdmin(id)
  const base = `/yatra/${id}/admin`
  return (
    <AdminPage admin={a} title={t('yatraSettings.manage')} back={{ to: `/yatra/${id}/settings`, label: t('yatraSettings.title') }}>
      {() => {
        const stats = a.yatra?.statistics
        return (
          <div className={LIST}>
            <SettingsRow label={t('yatraSettings.general')} hint={t('yatraSettings.generalHint')} to={`${base}/general`} />
            <SettingsRow label={t('yatraSettings.practices')} hint={t('yatraSettings.practicesHint', { count: a.practices.length })} to={`${base}/practices`} />
            <SettingsRow label={t('yatraSettings.membersTitle')} hint={membersLine(t, a.users)} to={`${base}/members`} />
            <SettingsRow label={t('yatraSettings.statistics')} to={`${base}/statistics`}
              hint={t(stats?.visible_to_all ? 'yatraSettings.statsHintAll' : 'yatraSettings.statsHintAdmins', { count: stats?.statistics.length ?? 0 })} />
            <SettingsRow label={t('yatraSettings.invite')} hint={t('yatraSettings.inviteHint')} to={`${base}/invite`} />
            <SettingsRow label={t('yatraSettings.danger')} hint={t('yatraSettings.dangerHint')} to={`${base}/danger`} danger />
          </div>
        )
      }}
    </AdminPage>
  )
}
