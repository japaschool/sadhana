import { useState } from 'react'
import type { ReactNode } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { yatrasApi } from '../../../api/yatras'
import { useAuthStore } from '../../../store/authStore'
import { AppBar } from '../../../layouts/mobile/AppBar'
import { MobileShell } from '../../../layouts/mobile/MobileShell'
import { ListGroup } from '../../../ui/primitives/ListGroup'
import { AccountRows, PreferencesRows, ProfileCard, SupportRows } from '../sections'
import { LogoutSheet } from './LogoutSheet'
import { SettingsRow } from './SettingsRow'

export function SettingsMobile() {
  const { t } = useTranslation()
  return (
    <>
      <AppBar title={<h1 className="text-[28px] font-extrabold tracking-[-0.02em] text-ui-ink">{t('nav.settings')}</h1>} />
      <div className="px-4 pt-2 pb-4"><SettingsList extra={<YatraRows />} /></div>
    </>
  )
}

/** One row per yatra, to its link page; hidden without yatras. */
function YatraRows() {
  const { t } = useTranslation()
  const userId = useAuthStore((s) => s.user?.id)
  const { data: yatras = [] } = useQuery({ queryKey: ['yatras'], queryFn: yatrasApi.getYatras })
  const users = useQueries({
    queries: yatras.map((y) => ({ queryKey: ['yatra-users', y.id], queryFn: () => yatrasApi.getYatraUsers(y.id) })),
  })
  if (!yatras.length) return null
  return (
    <ListGroup label={t('settings.yatras')}>
      {yatras.map((y, i) => {
        const admin = users[i]?.data?.find((u) => u.user_id === userId)?.is_admin
        return (
          <SettingsRow key={y.id} label={y.name} to={`/yatra/${y.id}/settings`}
            value={admin === undefined ? undefined : t(admin ? 'yatraSettings.roleAdmin' : 'yatraSettings.roleMember')} />
        )
      })}
    </ListGroup>
  )
}

/** Profile card, the three sections and log out, stacked (mobile and desktop); `extra` goes after Preferences. */
export function SettingsList({ extra }: { extra?: ReactNode }) {
  const { t } = useTranslation()
  const [logoutOpen, setLogoutOpen] = useState(false)

  return (
    <>
      <div className="flex flex-col gap-[18px]">
        <ProfileCard />
        <ListGroup label={t('settings.preferences')}><PreferencesRows /></ListGroup>
        {extra}
        <ListGroup label={t('settings.accountData')}><AccountRows /></ListGroup>
        <ListGroup label={t('settings.support')}><SupportRows /></ListGroup>
        <button type="button" onClick={() => setLogoutOpen(true)}
          className="flex min-h-[52px] items-center rounded-[18px] border border-ui-hairline bg-ui-surface px-4 text-left text-[15px] font-bold text-ui-danger">
          {t('settings.logout')}
        </button>
      </div>
      {logoutOpen && <LogoutSheet onClose={() => setLogoutOpen(false)} />}
    </>
  )
}

export function SettingsMobileScreen() {
  return (
    <MobileShell>
      <SettingsMobile />
    </MobileShell>
  )
}
