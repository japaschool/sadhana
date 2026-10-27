import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../../../store/authStore'
import { BottomSheet } from '../../../ui/primitives/BottomSheet'

export function LogoutSheet({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const logout = useAuthStore((s) => s.logout)
  return (
    <BottomSheet label={t('settings.logoutConfirmTitle')} onClose={onClose}>
      <div className="flex flex-col gap-1.5">
        <h2 className="text-xl font-extrabold text-ui-ink">{t('settings.logoutConfirmTitle')}</h2>
        <p className="text-sm text-ui-muted">{t('settings.logoutConfirmMsg')}</p>
      </div>
      <div className="grid grid-cols-[1fr_2fr] gap-2.5">
        <button type="button" onClick={onClose}
          className="h-[50px] rounded-[14px] border border-ui-control text-[15px] font-bold text-ui-ink">
          {t('common.cancel')}
        </button>
        <button type="button" onClick={() => { logout(); navigate('/login', { replace: true }) }}
          className="h-[50px] rounded-[14px] bg-ui-danger text-[15px] font-bold text-white">
          {t('auth.logout')}
        </button>
      </div>
    </BottomSheet>
  )
}
