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

/** Copies the public charts link. Resolves to false when nobody is signed in or the browser refuses. */
export async function copyShareLink(): Promise<boolean> {
  const url = shareUrl()
  if (!url) return false
  try {
    await navigator.clipboard.writeText(url)
    return true
  } catch { return false }
}
