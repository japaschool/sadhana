import { useTranslation } from 'react-i18next'
import { TabletShell } from '../../../layouts/tablet/TabletShell'
import { SettingsList } from '../mobile/SettingsMobile'

/** All sections stacked in one list, as on desktop. */
export function SettingsTablet() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-6 px-9 pt-[calc(36px+env(safe-area-inset-top))] pb-[calc(36px+env(safe-area-inset-bottom))]">
      <h1 className="text-[34px] leading-tight font-extrabold tracking-[-0.02em]">{t('nav.settings')}</h1>
      <div className="max-w-[640px]"><SettingsList /></div>
    </div>
  )
}

export function SettingsTabletScreen() {
  return (
    <TabletShell>
      <SettingsTablet />
    </TabletShell>
  )
}
