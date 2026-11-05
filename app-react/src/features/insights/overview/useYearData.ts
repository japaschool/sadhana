import { useQuery } from '@tanstack/react-query'
import { chartsApi } from '../../../api/charts'

/** The year of report data up to `todayCob`. Shares its cache entry with useInsights. */
export function useYearData(todayCob: string, enabled = true) {
  return useQuery({ queryKey: ['report-data', todayCob, 'Year'], queryFn: () => chartsApi.getReportData(todayCob, 'Year'), enabled })
}
