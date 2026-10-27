import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueries, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { chartsApi } from '../../api/charts'
import { practicesApi } from '../../api/practices'
import { yatrasApi } from '../../api/yatras'
import { useServiceWorkerUpdate } from '../../hooks/useServiceWorkerUpdate'
import { useAuthStore } from '../../store/authStore'
import { initials } from '../../ui/initials'
import { AnchoredMenu, MenuItem } from '../../ui/primitives/AnchoredMenu'
import { SegmentedControl } from '../../ui/primitives/SegmentedControl'
import { Toggle } from '../../ui/primitives/Toggle'
import type { ThemePref } from '../../ui/theme'
import { useTheme } from '../../ui/useTheme'
import { isPreview, setPreview, switchChannel } from './releaseChannel'
import { SettingsRow } from './mobile/SettingsRow'

// Native names on purpose: a user stuck in the wrong language can still find theirs.
export const LANGS = [
  { code: 'en', name: 'English' },
  { code: 'ru', name: 'Русский' },
  { code: 'uk', name: 'Українська' },
] as const

/** Rows of each Settings section, shared by the mobile hub and the tablet detail pane. */
export function PreferencesRows() {
  const { t, i18n } = useTranslation()
  const [theme, setTheme] = useTheme()
  const [langAnchor, setLangAnchor] = useState<HTMLElement | null>(null)
  const lang = LANGS.find((l) => l.code === i18n.resolvedLanguage?.slice(0, 2)) ?? LANGS[0]

  const themeOptions: { value: ThemePref; label: string }[] = [
    { value: 'auto', label: t('settings.themeAuto') },
    { value: 'light', label: t('settings.themeLight') },
    { value: 'dark', label: t('settings.themeDark') },
  ]

  return (
    <>
      <SettingsRow label={t('settings.language')} value={lang.name} onClick={(e) => setLangAnchor(e.currentTarget)} />
      <SettingsRow label={t('settings.theme')}
        control={<SegmentedControl label={t('settings.theme')} options={themeOptions} value={theme} onChange={setTheme} />} />
      <SettingsRow label={t('settings.previewChannel')} hint={t('settings.previewHint')}
        control={<Toggle label={t('settings.previewChannel')} checked={isPreview()}
          onChange={(on) => { setPreview(on); void switchChannel() }} />} />
      {langAnchor && (
        <AnchoredMenu anchor={langAnchor} label={t('settings.language')} onClose={() => setLangAnchor(null)}>
          {LANGS.map((l) => (
            <MenuItem key={l.code} selected={l.code === lang.code}
              onSelect={() => { setLangAnchor(null); void i18n.changeLanguage(l.code) }}>
              {l.name}
            </MenuItem>
          ))}
        </AnchoredMenu>
      )}
    </>
  )
}

export function AccountRows() {
  const { t } = useTranslation()
  return (
    <>
      <SettingsRow label={t('settings.changePassword')} to="/settings/edit-password" />
      <SettingsRow label={t('settings.importCsv')} to="/settings/import" />
    </>
  )
}

export function SupportRows() {
  const { t } = useTranslation()
  const { updateReady, applyUpdate } = useServiceWorkerUpdate()
  return (
    <>
      {updateReady && <SettingsRow label={t('settings.updateAvailable')} accent onClick={applyUpdate} />}
      <SettingsRow label={t('settings.helpSupport')} to="/help" />
      <SettingsRow label={t('settings.aboutShort')} href="https://sadhana.pro" />
    </>
  )
}

/** Insights, Yatras and Practices, each to its own list, with how many there are. */
export function SadhanaRows() {
  const { t } = useTranslation()
  const practices = useQuery({ queryKey: ['practices'], queryFn: practicesApi.getUserPractices }).data
  const count = (n?: number) => (n ? String(n) : undefined)
  return (
    <>
      <SettingsRow label={t('insights.title')} value={count(useMyCharts().length)} to="/settings/charts" />
      <SettingsRow label={t('settings.yatras')} value={count(useMyYatras().length)} to="/settings/yatras" />
      <SettingsRow label={t('practices.title')} value={count(practices?.length)} to="/settings/practices" />
    </>
  )
}

export const useMyYatras = () => useQuery({ queryKey: ['yatras'], queryFn: yatrasApi.getYatras }).data ?? []

/** One row per yatra, to its settings, with my role there. */
export function YatraRows() {
  const { t } = useTranslation()
  const userId = useAuthStore((s) => s.user?.id)
  const yatras = useMyYatras()
  const users = useQueries({
    queries: yatras.map((y) => ({ queryKey: ['yatra-users', y.id], queryFn: () => yatrasApi.getYatraUsers(y.id) })),
  })
  return (
    <>
      {yatras.map((y, i) => {
        const admin = users[i]?.data?.find((u) => u.user_id === userId)?.is_admin
        return (
          <SettingsRow key={y.id} label={y.name} to={`/yatra/${y.id}/settings`}
            value={admin === undefined ? undefined : t(admin ? 'yatraSettings.roleAdmin' : 'yatraSettings.roleMember')} />
        )
      })}
    </>
  )
}

export const useMyCharts = () => useQuery({ queryKey: ['reports'], queryFn: chartsApi.getReports }).data ?? []

/** One row per chart, to its settings, with its kind. */
export function ChartRows() {
  const { t } = useTranslation()
  return (
    <>
      {useMyCharts().map((r) => (
        <SettingsRow key={r.id} label={r.name} to={`/settings/charts/${r.id}`}
          value={t('Graph' in r.definition ? 'chartSettings.graph' : 'chartSettings.table')} />
      ))}
    </>
  )
}

export function ProfileCard() {
  const { t } = useTranslation()
  const name = useAuthStore((s) => s.user?.name ?? '')
  return (
    <Link to="/settings/edit-user"
      className="flex items-center gap-3 rounded-[18px] border border-ui-hairline bg-ui-surface py-3.5 pr-3 pl-3.5">
      <span data-testid="avatar"
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ui-selected text-base font-extrabold text-ui-on-selected">
        {initials(name)}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[17px] font-extrabold text-ui-ink">{name}</span>
        <span className="text-[13px] text-ui-muted">{t('settings.userDetails')}</span>
      </span>
      <span aria-hidden className="text-lg text-ui-muted">›</span>
    </Link>
  )
}
