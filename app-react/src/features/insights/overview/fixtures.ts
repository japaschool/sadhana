import type { ReportDataEntry } from '../../../api/charts'
import type { PracticeDataType, UserPractice } from '../../../types/api'

export const TODAY = '2026-11-05'

export const practice = (
  id: string, name: string, type: PracticeDataType, opts: Partial<UserPractice> = {},
): UserPractice => ({ id, practice: name, data_type: type, is_active: true, ...opts })

/** Report data from `{ cob: { practice name: raw value } }`. */
export const entries = (days: Record<string, Record<string, unknown>>): ReportDataEntry[] =>
  Object.entries(days).flatMap(([cob_date, values]) =>
    Object.entries(values).map(([name, value]) => ({ cob_date, practice: name, value })))

/** Bedtime, wake-up, rounds per day, rounds before 7, under their Russian default names. */
export const FOUR: UserPractice[] = [
  practice('bed', 'Отбой', 'Time'),
  practice('wake', 'Подъём', 'Time'),
  practice('rounds', 'Кругов за день', 'Int'),
  practice('before7', 'Кругов до 7', 'Int'),
]
