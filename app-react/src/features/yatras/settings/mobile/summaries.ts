import type { TFunction } from 'i18next'
import type { Aggregation, PracticeDataType, YatraPractice, YatraUser, ZoneColour } from '../../../../types/api'
import { bonusOf, formatValue, isScored, zoneCount } from '../zones'

/** The existing colour names: yatras.zoneRed, yatras.zoneGreen, … */
export const zoneKey = (c: ZoneColour) => `yatras.zone${c}`

export const membersLine = (t: TFunction, users: YatraUser[]) =>
  `${t('yatraSettings.members', { count: users.length })} · ${t('yatraSettings.adminsCount', { count: users.filter((u) => u.is_admin).length })}`

/** "done 16 · bonus 20", or null when the practice adds nothing to the score. */
export function scoreSummary(p: YatraPractice, t: TFunction): string | null {
  if (!isScored(p.data_type)) return null
  const dt = p.data_type
  const done = p.daily_score?.mandatory_threshold
  const bonus = bonusOf(p.daily_score)
  const parts = [
    done && t('yatraSettings.doneValue', { value: formatValue(done, dt) }),
    bonus && t('yatraSettings.bonusValue', { value: formatValue(bonus, dt) }),
  ].filter(Boolean)
  return parts.length ? parts.join(' · ') : null
}

export function practiceSummary(p: YatraPractice, t: TFunction): string {
  if (p.data_type === 'Bool') return t('yatraSettings.shownAsCheck')
  if (p.data_type === 'Text') return t('yatraSettings.shownAsWritten')
  const n = zoneCount(p.colour_zones)
  const colours = n ? t('yatraSettings.nColours', { count: n }) : t('yatraSettings.noColours')
  return `${colours} · ${scoreSummary(p, t) ?? t('yatraSettings.notInScore')}`
}

/** For times of day, Min and Max read "earliest" and "latest". */
export const aggLabel = (t: TFunction, agg: Aggregation, dt?: PracticeDataType) =>
  t(dt === 'Time' && (agg === 'Min' || agg === 'Max') ? `yatraSettings.agg${agg}Time` : `yatraSettings.agg${agg}`)

/** Members link practices by name, so two practices of one yatra can't share one. */
export function practiceNameError(t: TFunction, name: string, others: YatraPractice[]): string | null {
  const n = name.trim().toLowerCase()
  if (!n) return t('yatraSettings.nameEmpty')
  return others.some((p) => p.practice.trim().toLowerCase() === n) ? t('yatraSettings.nameTaken') : null
}
