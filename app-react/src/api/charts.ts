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
  practices: string[]  // UUIDs, in column order
  group_columns?: boolean
}

/** The "panels" report format; mirrors server/src/app/report/panels.rs. */
export type Label = { Key: string } | { Text: string }
export type Mark = 'Bar' | 'Line' | 'Dot' | 'Range'
export type Side = 'Left' | 'Right'
/** NoonClock: minutes after the noon before the night. */
export type Format = 'Duration' | 'Count' | 'NoonClock'
export type End = 'From' | 'To'

export interface Ref { practice: string; day_offset: number }
export interface Term { sign: number; practice: string; day_offset: number; optional: boolean }
export type Source =
  | { Practice: { practice: string } }
  | { Calc: { terms: Term[] } }
  | { Range: { from: Ref; to: Ref } }

export interface Target {
  min: number | null
  max: number | null
  of: Source
  lines: boolean
  colour: boolean
  label: Label | null
}
export interface RefLine { of: Source; pick: End | null; dashed: boolean; label: Label | null }
export interface Series {
  label: Label | null
  mark: Mark
  source: Source
  axis: Side
  /** Index of a series this one is drawn beside. */
  only_with: number | null
}
export interface ChartPanel {
  title: Label | null
  series: Series[]
  bar_layout: BarLayout
  format: Format
  reversed: boolean
  target: Target | null
  lines: RefLine[]
  /** The first series' daily average and its change vs the previous window, in place of the title. */
  headline?: boolean
}

/** Sleep: today in, missing skipped. Japa and Duration: today out, missing counts as 0. */
export interface Scope { today: boolean; missing_zero: boolean }
export type StatValue =
  | { Average: { of: Source; pick: End | null; format: Format; scope: Scope } }
  | { OnTarget: { of: Source; min: number | null; max: number | null; scope: Scope } }
  | { Logged: { of: Source; scope: Scope } }
  | { CountTrue: { of: Source; scope: Scope } }
export interface Stat { label: Label; value: StatValue; under: Stat | null }

export interface AroundRow { label: Label | null; source: Source }

export type Panel = { kind: 'Stats'; stats: Stat[] } | ({ kind: 'Chart' } & ChartPanel)
  | { kind: 'Month'; practice: string }
  /** Days between events of one Bool or Text practice. */
  | { kind: 'Gaps'; event: string }
  /** Rows on the days around those events. */
  | { kind: 'Around'; event: string; rows: AroundRow[] }

export interface SleepTemplate { bedtime: string; wake: string; nap: string | null; min: number | null; max: number | null }
/** `quality` and `attunement`: older reports may have them; no longer drawn, and saved as null. */
export interface JapaTemplate { total: string; target: number; morning: string | null; quality: string | null; attunement: string | null }
export interface DurationTemplate { practices: string[]; goal: number | null }
export interface DaysTemplate { practices: string[] }
export interface SleepRows { bedtime: string; wake: string; nap: string | null }
export interface GapsTemplate { event: string; rows: string[]; sleep: SleepRows | null }
export type Template = { Sleep: SleepTemplate } | { Japa: JapaTemplate } | { Duration: DurationTemplate } | { Days: DaysTemplate }
  | { Gaps: GapsTemplate }
export interface Required { practice: string; label: Label }

export interface PanelsReport {
  version: number
  template: Template | null
  /** Practices the report can't work without. */
  required: Required[]
  panels: Panel[]
}

export type ReportDefinition = { Graph: GraphReport } | { Grid: GridReport } | { Panels: PanelsReport }

export interface Report {
  id: string
  name: string
  definition: ReportDefinition
}

export const chartsApi = {
  async getReports(): Promise<Report[]> {
    // panels is a level: 3 includes Gaps and Around. The shared list stays at 1; it never gets those.
    const res = await apiClient.get<{ reports: Report[] }>('/reports', { params: { panels: 3, months: true } })
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
    const res = await apiClient.get<{ reports: Report[] }>(`/share/${userId}/reports`, { params: { panels: true, months: true } })
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
