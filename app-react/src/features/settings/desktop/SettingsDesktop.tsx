import { useTranslation } from 'react-i18next'
import { DesktopShell } from '../../../layouts/desktop/DesktopShell'
import { SettingsList } from '../mobile/SettingsMobile'

function SettingsDesktop() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-6 px-9 pt-8 pb-9">
      <h1 className="text-[34px] leading-tight font-extrabold tracking-[-0.02em]">{t('nav.settings')}</h1>
      <div className="max-w-[640px]"><SettingsList /></div>
    </div>
  )
}

export function SettingsDesktopScreen() {
  return <DesktopShell>{() => <SettingsDesktop />}</DesktopShell>
}
