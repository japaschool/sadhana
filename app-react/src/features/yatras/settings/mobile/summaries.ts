import type { TFunction } from 'i18next'
import type { YatraPractice, YatraUser, ZoneColour } from '../../../../types/api'
import { bonusOf, formatValue, isScored } from '../zones'

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
