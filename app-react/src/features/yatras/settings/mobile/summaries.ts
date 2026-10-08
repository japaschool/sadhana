import type { TFunction } from 'i18next'
import type { YatraUser, ZoneColour } from '../../../../types/api'

/** The existing colour names: yatras.zoneRed, yatras.zoneGreen, … */
export const zoneKey = (c: ZoneColour) => `yatras.zone${c}`

export const membersLine = (t: TFunction, users: YatraUser[]) =>
  `${t('yatraSettings.members', { count: users.length })} · ${t('yatraSettings.adminsCount', { count: users.filter((u) => u.is_admin).length })}`
