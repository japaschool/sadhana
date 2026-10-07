import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AppBar } from '../../../layouts/mobile/AppBar'
import { MobileShell } from '../../../layouts/mobile/MobileShell'
import { ListGroup } from '../../../ui/primitives/ListGroup'
import { AccountRows, PreferencesRows, ProfileCard, SupportRows } from '../sections'
import { LogoutSheet } from './LogoutSheet'

export function SettingsMobile() {
  const { t } = useTranslation()
  return (
    <>
      <AppBar title={<h1 className="text-[28px] font-extrabold tracking-[-0.02em] text-ui-ink">{t('nav.settings')}</h1>} />
      <div className="px-4 pt-2 pb-4"><SettingsList /></div>
    </>
  )
}

/** Profile card, the three sections and log out, stacked (mobile and desktop). */
export function SettingsList() {
  const { t } = useTranslation()
  const [logoutOpen, setLogoutOpen] = useState(false)

  return (
    <>
      <div className="flex flex-col gap-[18px]">
        <ProfileCard />
        <ListGroup label={t('settings.preferences')}><PreferencesRows /></ListGroup>
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
