import { chartsApi } from '../../api/charts'
import { practicesApi } from '../../api/practices'
import { toCSV, triggerCSVDownload } from '../../pages/charts/csv'
import { useAuthStore } from '../../store/authStore'
import { toDateStr } from './date'

export async function downloadCsv() {
  const [entries, practices] = await Promise.all([
    chartsApi.getReportData(toDateStr(new Date()), 'AllData'),
    practicesApi.getUserPractices(),
  ])
  const practiceMap = Object.fromEntries(practices.map((p) => [p.id, p.practice]))
  triggerCSVDownload(toCSV(entries, practiceMap))
}

/** Copies the public charts link. Returns false when nobody is signed in. */
export function copyShareLink(): boolean {
  const user = useAuthStore.getState().user
  if (!user) return false
  void navigator.clipboard.writeText(`${window.location.origin}/shared/${user.id}`)
  return true
}
