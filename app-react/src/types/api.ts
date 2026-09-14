// Mirrors Rust model structs; serde default serialization (PascalCase enum variants)

export interface UserInfo {
  id: string
  email: string
  token: string
  name: string
}

export type PracticeDataType = 'Int' | 'Bool' | 'Time' | 'Text' | 'Duration'

// Rust serde default: enum variants with data serialize as { "VariantName": payload }
export type PracticeValue =
  | { Int: number }
  | { Bool: boolean }
  | { Time: { h: number; m: number } }
  | { Text: string }
  | { Duration: number }

export interface UserPractice {
  id: string
  practice: string
  data_type: PracticeDataType
  is_active: boolean
  is_required?: boolean
  dropdown_variants?: string
}

export interface DiaryEntry {
  practice: string
  data_type: PracticeDataType
  dropdown_variants?: string
  value?: PracticeValue
}

export interface Confirmation {
  id: string
  email: string
  expires_at: string
}

// API response envelopes
export interface UserInfoWrapper { user: UserInfo }
export interface SignupLinkDetailsWrapper { confirmation: Confirmation }

export interface ChartReport {
  id: string
  name: string
  practices: string[]
  date_from: string
  date_to: string
  chart_type: 'Line' | 'Bar' | 'Grid'
  share_id?: string
}

export interface SharedChart extends ChartReport {
  entries: DiaryEntry[]
}

export interface YatraMember {
  id: string
  name: string
}

export interface YatraUser {
  user_id: string
  user_name: string
  is_admin: boolean
}

export interface Yatra {
  id: string
  name: string
  statistics?: YatraStatisticsConfig | null
  show_stability_metrics: boolean
  // Optional fields used by settings pages (may not be present in all responses)
  member_count?: number
  is_member?: boolean
  is_admin?: boolean
  practices?: UserPractice[]
  members?: YatraMember[]
}

export type ZoneColour = 'Neutral' | 'MutedRed' | 'Red' | 'Yellow' | 'Green' | 'DarkGreen'
export type BetterDirection = 'Higher' | 'Lower'

export interface ColourBound {
  to: PracticeValue | null
  colour: ZoneColour
}

export interface ColourZonesConfig {
  better_direction: BetterDirection
  bounds: ColourBound[]
  no_value_colour: ZoneColour
  best_colour?: ZoneColour | null
}

export interface BonusRule {
  threshold: PracticeValue
  points: number
}

export interface DailyScoreConfig {
  better_direction: BetterDirection
  mandatory_threshold: PracticeValue | null
  bonus_rules: BonusRule[]
}

export interface YatraPractice {
  id: string
  practice: string
  data_type: PracticeDataType
  colour_zones?: ColourZonesConfig | null
  daily_score_config?: DailyScoreConfig | null
}

export interface UserYatraDataRow {
  user_id: string
  user_name: string
  row: (unknown | null)[]
  trend_arrow: 'Up' | 'Down' | 'Flat' | null
  stability_heatmap: number[]
}

// Yatra statistics configuration (used in admin settings)
export type Aggregation = 'Sum' | 'Avg' | 'Min' | 'Max' | 'Count'
export type TimeRange =
  | 'Last7Days'
  | 'Last30Days'
  | 'Last90Days'
  | 'Last365Days'
  | 'ThisWeek'
  | 'ThisMonth'
  | 'ThisQuarter'
  | 'ThisYear'

export interface YatraStatisticConfig {
  label: string
  practice_id: string
  aggregation: Aggregation
  time_range: TimeRange
}

export interface YatraStatisticsConfig {
  visible_to_all: boolean
  statistics: YatraStatisticConfig[]
}

// Response row from /yatra/:id/data
export interface YatraStatistic {
  label: string
  value: unknown | null
}

export interface YatraDataResponse {
  practices: YatraPractice[]
  data: UserYatraDataRow[]
  statistics: YatraStatistic[]
  stability_heatmap_days: number[]
}

export interface YatraUserPracticeItem {
  yatra_practice: YatraPractice
  user_practice: string | null
}

export interface ImportPreview {
  columns: string[]
  sample_rows: string[][]
}

export interface ImportResult {
  imported_count: number
}
