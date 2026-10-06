import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useServiceWorkerUpdate } from '../../../hooks/useServiceWorkerUpdate'
import { AppBar } from '../../../layouts/mobile/AppBar'
import { MobileShell } from '../../../layouts/mobile/MobileShell'
import { useAuthStore } from '../../../store/authStore'
import { AnchoredMenu, MenuItem } from '../../../ui/primitives/AnchoredMenu'
import { ListGroup } from '../../../ui/primitives/ListGroup'
import { SegmentedControl } from '../../../ui/primitives/SegmentedControl'
import { Toggle } from '../../../ui/primitives/Toggle'
import type { ThemePref } from '../../../ui/theme'
import { useTheme } from '../../../ui/useTheme'
import { isPreview, setPreview } from '../releaseChannel'
import { LogoutSheet } from './LogoutSheet'
import { SettingsRow } from './SettingsRow'

// Native names on purpose: a user stuck in the wrong language can still find theirs.
const LANGS = [
  { code: 'en', name: 'English' },
  { code: 'ru', name: 'Русский' },
  { code: 'uk', name: 'Українська' },
] as const

function initials(name: string) {
  const letters = name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('')
  return letters || '?'
}

export function SettingsMobile() {
  const { t, i18n } = useTranslation()
  const name = useAuthStore((s) => s.user?.name ?? '')
  const { updateReady, applyUpdate } = useServiceWorkerUpdate()
  const [theme, setTheme] = useTheme()
  const [langAnchor, setLangAnchor] = useState<HTMLElement | null>(null)
  const [logoutOpen, setLogoutOpen] = useState(false)
  const lang = LANGS.find((l) => l.code === i18n.resolvedLanguage?.slice(0, 2)) ?? LANGS[0]

  const themeOptions: { value: ThemePref; label: string }[] = [
    { value: 'auto', label: t('settings.themeAuto') },
    { value: 'light', label: t('settings.themeLight') },
    { value: 'dark', label: t('settings.themeDark') },
  ]

  return (
    <>
      <AppBar title={<h1 className="text-[28px] font-extrabold tracking-[-0.02em] text-ui-ink">{t('nav.settings')}</h1>} />
      <div className="flex flex-col gap-[18px] px-4 pt-2 pb-4">
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

        <ListGroup label={t('settings.preferences')}>
          <SettingsRow label={t('settings.language')} value={lang.name} onClick={(e) => setLangAnchor(e.currentTarget)} />
          <SettingsRow label={t('settings.theme')}
            control={<SegmentedControl label={t('settings.theme')} options={themeOptions} value={theme} onChange={setTheme} />} />
          <SettingsRow label={t('settings.previewChannel')} hint={t('settings.previewHint')}
            control={<Toggle label={t('settings.previewChannel')} checked={isPreview()}
              onChange={(on) => { setPreview(on); window.location.reload() }} />} />
        </ListGroup>

        <ListGroup label={t('settings.accountData')}>
          <SettingsRow label={t('settings.changePassword')} to="/settings/edit-password" />
          <SettingsRow label={t('settings.importCsv')} to="/settings/import" />
        </ListGroup>

        <ListGroup label={t('settings.support')}>
          {updateReady && <SettingsRow label={t('settings.updateAvailable')} accent onClick={applyUpdate} />}
          <SettingsRow label={t('settings.helpSupport')} to="/help" />
          <SettingsRow label={t('settings.aboutShort')} href="https://sadhana.pro" />
        </ListGroup>

        <button type="button" onClick={() => setLogoutOpen(true)}
          className="flex min-h-[52px] items-center rounded-[18px] border border-ui-hairline bg-ui-surface px-4 text-left text-[15px] font-bold text-ui-danger">
          {t('settings.logout')}
        </button>
      </div>

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
