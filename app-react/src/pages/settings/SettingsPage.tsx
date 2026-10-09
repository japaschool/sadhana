import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { FaCog, FaChevronRight, FaSignOutAlt } from 'react-icons/fa'
import { LuUser, LuLock, LuLayers, LuUpload, LuCircleHelp, LuInfo, LuRefreshCw } from 'react-icons/lu'
import { useAuthStore } from '../../store/authStore'
import { ConfirmModal } from '../../components/ui/ConfirmModal'
import { ACCENT_GRADIENT } from '../../theme/tokens'
import { useServiceWorkerUpdate } from '../../hooks/useServiceWorkerUpdate'

const glass: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid rgba(255,255,255,0.10)',
  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
}

function MenuItem({
  label,
  to,
  icon: Icon,
  last = false,
}: {
  label: string
  to: string
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  last?: boolean
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 px-4 py-3.5 transition-colors"
      style={{
        borderTop: last ? undefined : '1px solid rgba(255,255,255,0.08)',
        color: 'inherit',
        textDecoration: 'none',
      }}
    >
      <Icon className="w-4 h-4 flex-shrink-0" style={{ color: '#f59e0b' }} />
      <span className="flex-1 text-sm font-medium text-base-content">{label}</span>
      <FaChevronRight className="w-3 h-3 flex-shrink-0" style={{ color: '#d1d5db' }} />
    </Link>
  )
}

function SectionCard({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl overflow-hidden" style={glass}>
      <div className="px-4 pt-4 pb-2">
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgba(242,244,246,0.7)' }}>
          {title}
        </span>
      </div>
      {children}
    </div>
  )
}

export function SettingsPage() {
  const { t } = useTranslation()
  const logout = useAuthStore((s) => s.logout)
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const { updateReady, applyUpdate } = useServiceWorkerUpdate()

  useEffect(() => {
    if (showLogoutConfirm) {
      (document.getElementById('logout-confirm') as HTMLDialogElement)?.showModal()
      setShowLogoutConfirm(false)
    }
  }, [showLogoutConfirm])

  return (
    <>
    <div className="px-4 py-4 pt-16 sm:pt-[4.5rem] max-w-lg sm:max-w-2xl mx-auto flex flex-col gap-4 pb-24 sm:pb-8">
      {/* Page header */}
      <div className="rounded-2xl px-5 py-5 flex items-center gap-4" style={glass}>
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{
            background: ACCENT_GRADIENT,
            boxShadow: '0 4px 16px rgba(245,158,11,0.30)',
          }}
        >
          <FaCog className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-base font-bold font-serif text-base-content leading-tight">{user?.name || t('nav.settings')}</h1>
          <p className="text-xs text-base-content/70 mt-0.5">{t('settings.subtitle')}</p>
        </div>
      </div>

      {/* Account */}
      <SectionCard title={t('settings.account')}>
        <MenuItem label={t('settings.editProfile')}    to="/settings/edit-user"     icon={LuUser}  last />
        <MenuItem label={t('settings.changePassword')} to="/settings/edit-password" icon={LuLock}  />
      </SectionCard>

      {/* Practices */}
      <SectionCard title={t('settings.practices')}>
        <MenuItem label={t('settings.myPractices')} to="/user/practices" icon={LuLayers} last />
      </SectionCard>

      {/* Data */}
      <SectionCard title={t('settings.data')}>
        <MenuItem label={t('settings.import')} to="/settings/import" icon={LuUpload} last />
      </SectionCard>

      {/* App */}
      <SectionCard title={t('settings.app')}>
        {updateReady && (
          <button
            onClick={applyUpdate}
            className="flex items-center gap-3 px-4 py-3.5 w-full text-left transition-colors"
            style={{
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              color: 'inherit',
              background: 'rgba(245,158,11,0.06)',
            }}
          >
            <LuRefreshCw className="w-4 h-4 flex-shrink-0" style={{ color: '#f59e0b' }} />
            <span className="flex-1 text-sm font-medium" style={{ color: '#f59e0b' }}>{t('settings.updateApp')}</span>
          </button>
        )}
        <MenuItem label={t('settings.help')}     to="/help"              icon={LuCircleHelp} />
        <a
          href="https://sadhana.pro"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-4 py-3.5 transition-colors"
          style={{ borderTop: '1px solid rgba(255,255,255,0.08)', color: 'inherit', textDecoration: 'none' }}
        >
          <LuInfo className="w-4 h-4 flex-shrink-0" style={{ color: '#f59e0b' }} />
          <span className="flex-1 text-sm font-medium text-base-content">{t('settings.about')}</span>
        </a>
      </SectionCard>

      {/* Logout — lives in the settings surface (now a glass popup) */}
      <button
        onClick={() => setShowLogoutConfirm(true)}
        className="w-full h-12 rounded-full text-sm font-semibold flex items-center justify-center gap-2"
        style={{
          background: 'rgba(255,255,255,0.08)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          color: '#dc2626',
          border: '1.5px solid rgba(220,38,38,0.35)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          cursor: 'pointer',
        }}
      >
        <FaSignOutAlt className="w-3.5 h-3.5" />
        {t('auth.logout')}
      </button>
    </div>
    <ConfirmModal
      id="logout-confirm"
      title={t('settings.logoutConfirmTitle')}
      message={t('settings.logoutConfirmMsg')}
      confirmLabel={t('auth.logout')}
      onConfirm={() => { logout(); navigate('/login', { replace: true }) }}
    />
    </>
  )
}
