import { apiClient } from './client'
import type { UserPractice } from '../types/api'

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
  /** The owner's name for a shared reports link; fails for an unknown user. */
  async getSharedUser(userId: string): Promise<{ id: string; name: string }> {
    const res = await apiClient.get<{ user: { id: string; name: string } }>(`/share/${userId}/user`)
    return res.data.user
  },
  async getSharedPractices(userId: string): Promise<UserPractice[]> {
    const res = await apiClient.get<{ user_practices: UserPractice[] }>(`/share/${userId}/practices`)
    return res.data.user_practices
  },
  async getSharedReportData(userId: string, cob: string, duration: string): Promise<ReportDataEntry[]> {
    const res = await apiClient.get<{ values: ReportDataEntry[] }>(`/share/${userId}`, { params: { end_date: cob, duration } })
    return res.data.values
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
