import { chartsApi } from '../../api/charts'
import { toCSV, triggerCSVDownload } from '../insights/csv'
import { toDateStr } from './date'

export async function downloadCsv() {
  triggerCSVDownload(toCSV(await chartsApi.getReportData(toDateStr(new Date()), 'AllData')))
}
