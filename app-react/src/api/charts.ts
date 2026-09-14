import { apiClient } from './client'

export type BarLayout = 'Grouped' | 'Overlaid' | 'Stacked'
export type LineStyle = 'Regular' | 'Square'
export type TraceType = 'Bar' | 'Dot' | { Line: { style: LineStyle } }

export interface PracticeTrace {
  label: string | null
  type_: TraceType
  practice: string   // UUID
  y_axis: string | null
  show_average: boolean
}

export interface GraphReport {
  bar_layout: BarLayout
  traces: PracticeTrace[]
}

export interface GridReport {
  practices: string[]  // UUIDs
}

export type ReportDefinition = { Graph: GraphReport } | { Grid: GridReport }

export interface Report {
  id: string
  name: string
  definition: ReportDefinition
}

export const chartsApi = {
  async getReports(): Promise<Report[]> {
    const res = await apiClient.get<{ reports: Report[] }>('/reports')
    return res.data.reports
  },
  async createReport(name: string, definition: ReportDefinition): Promise<string> {
    const res = await apiClient.post<{ report_id: string }>('/reports', { report: { name, definition } })
    return res.data.report_id
  },
  async updateReport(id: string, name: string, definition: ReportDefinition): Promise<void> {
    await apiClient.put(`/report/${id}`, { report: { name, definition } })
  },
  async deleteReport(id: string): Promise<void> {
    await apiClient.delete(`/report/${id}`)
  },
  async getSharedReports(userId: string): Promise<Report[]> {
    const res = await apiClient.get<{ reports: Report[] }>(`/share/${userId}/reports`)
    return res.data.reports
  },
  async getReportData(cob: string, duration: string): Promise<ReportDataEntry[]> {
    const res = await apiClient.get<{ values: ReportDataEntry[] }>(`/diary/${cob}/report`, { params: { duration } })
    return res.data.values
  },
}

export type ReportDuration = 'Week' | 'Month' | 'Quarter' | 'HalfYear' | 'Year' | 'AllData'

export interface ReportDataEntry {
  cob_date: string
  practice: string
  value: unknown
}
