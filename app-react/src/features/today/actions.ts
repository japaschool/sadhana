import { chartsApi } from '../../api/charts'
import { toCSV, triggerCSVDownload } from '../insights/csv'
import { useAuthStore } from '../../store/authStore'
import { toDateStr } from './date'

export async function downloadCsv() {
  triggerCSVDownload(toCSV(await chartsApi.getReportData(toDateStr(new Date()), 'AllData')))
}

/** Copies the public charts link. Returns false when nobody is signed in. */
export function copyShareLink(): boolean {
  const user = useAuthStore.getState().user
  if (!user) return false
  void navigator.clipboard.writeText(`${window.location.origin}/shared/${user.id}`)
  return true
}
