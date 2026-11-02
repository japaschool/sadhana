import { chartsApi } from '../../api/charts'
import { toCSV, triggerCSVDownload } from '../insights/csv'
import { useAuthStore } from '../../store/authStore'
import { toDateStr } from './date'

export async function downloadCsv() {
  triggerCSVDownload(toCSV(await chartsApi.getReportData(toDateStr(new Date()), 'AllData')))
}

/** The public charts link, or null when nobody is signed in. */
export function shareUrl(): string | null {
  const user = useAuthStore.getState().user
  return user ? `${window.location.origin}/shared/${user.id}` : null
}

/** Copies the public charts link. Returns false when nobody is signed in. */
export function copyShareLink(): boolean {
  const url = shareUrl()
  if (!url) return false
  void navigator.clipboard.writeText(url)
  return true
}
