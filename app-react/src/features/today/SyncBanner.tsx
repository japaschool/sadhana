import { useTranslation } from 'react-i18next'
import useNetworkStatus from '../../hooks/useNetworkStatus'

/** Offline, or diary values still waiting to sync. Nothing when online and everything is sent. */
export function SyncBanner({ className = '' }: { className?: string }) {
  const { t } = useTranslation()
  const { online, pending } = useNetworkStatus()
  if (online && pending === 0) return null
  const text = online ? t('today.syncing', { count: pending })
    : pending ? t('today.offlinePending', { count: pending }) : t('home.offline')
  return <p role="status" className={`rounded-xl bg-ui-accent-soft px-3 py-2 text-xs font-semibold text-ui-accent ${className}`}>{text}</p>
}

/** Above the rows when the day couldn't be loaded: entering values still works. */
export function DayFailedNote() {
  const { t } = useTranslation()
  return <p role="status" className="rounded-xl bg-ui-field px-3 py-2 text-xs text-ui-muted">{t('today.dayFailed')}</p>
}
