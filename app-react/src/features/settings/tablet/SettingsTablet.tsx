import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { TabletShell } from '../../../layouts/tablet/TabletShell'
import { LogoutSheet } from '../mobile/LogoutSheet'
import { AccountRows, PreferencesRows, ProfileCard, SupportRows, useMyYatras, YatraRows } from '../sections'

const SECTIONS = [
  { key: 'settings.preferences', Rows: PreferencesRows },
  { key: 'settings.yatras', Rows: YatraRows },
  { key: 'settings.accountData', Rows: AccountRows },
  { key: 'settings.support', Rows: SupportRows },
] as const

/** Master–detail: sections on the left, the selected section's rows on the right. */
export function SettingsTablet() {
  const { t } = useTranslation()
  const [selected, setSelected] = useState<(typeof SECTIONS)[number]['key']>(SECTIONS[0].key)
  const [logoutOpen, setLogoutOpen] = useState(false)
  const { Rows } = SECTIONS.find((s) => s.key === selected)!
  const hasYatras = useMyYatras().length > 0
  const sections = SECTIONS.filter((s) => s.key !== 'settings.yatras' || hasYatras)

  return (
    <div className="flex min-h-dvh">
      <div className="sticky top-0 flex h-dvh w-[280px] shrink-0 flex-col gap-4 overflow-y-auto border-r border-ui-control px-4 pt-[calc(32px+env(safe-area-inset-top))] pb-[calc(24px+env(safe-area-inset-bottom))]">
        <h1 className="px-1.5 text-[28px] font-extrabold tracking-[-0.02em]">{t('nav.settings')}</h1>
        <ProfileCard />
        <nav aria-label={t('nav.settings')} className="flex flex-col gap-1.5">
          {sections.map((s) => (
            <button key={s.key} type="button" aria-current={s.key === selected ? 'true' : undefined} onClick={() => setSelected(s.key)}
              className={`rounded-xl p-3 text-left text-[15px] ${s.key === selected ? 'bg-ui-selected font-bold text-ui-on-selected' : 'font-semibold text-ui-ink'}`}>
              {t(s.key)}
            </button>
          ))}
        </nav>
        <button type="button" onClick={() => setLogoutOpen(true)}
          className="mt-auto rounded-xl p-3 text-left text-[15px] font-bold text-ui-danger">
          {t('settings.logout')}
        </button>
      </div>

      <section aria-label={t(selected)} className="flex min-w-0 flex-1 flex-col gap-3.5 px-7 pt-[calc(32px+env(safe-area-inset-top))] pb-8">
        <h2 className="text-2xl font-extrabold tracking-[-0.02em]">{t(selected)}</h2>
        <div className="flex flex-col gap-px overflow-hidden rounded-[18px] border border-ui-hairline bg-ui-hairline">
          <Rows />
        </div>
      </section>

      {logoutOpen && <LogoutSheet onClose={() => setLogoutOpen(false)} />}
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
