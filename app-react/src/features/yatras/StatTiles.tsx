import { useTranslation } from 'react-i18next'
import type { PracticeDataType, Yatra, YatraDataResponse, YatraStatisticConfig } from '../../types/api'
import type { DurationUnits } from '../today/values'
import { statValue } from './settings/statistics'
import { aggLabel } from './settings/mobile/summaries'

/** One statistic as 12m20 draws it: label, value (with "times" for counts), aggregation · range. */
export function Tile({ stat, dt, raw, units }: { stat: YatraStatisticConfig; dt?: PracticeDataType; raw: unknown; units: DurationUnits }) {
  const { t } = useTranslation()
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-[18px] border border-ui-hairline bg-ui-surface p-3.5">
      <span className="truncate text-xs font-bold text-ui-muted">{stat.label}</span>
      <span className="flex items-baseline gap-1">
        <span className="text-[22px] font-extrabold tracking-[-0.01em] text-ui-ink">{statValue(raw, stat.aggregation, dt ?? 'Int', units)}</span>
        {stat.aggregation === 'Count' && <span className="text-xs text-ui-muted">{t('yatraSettings.times')}</span>}
      </span>
      <span className="text-[11px] text-ui-muted">{`${aggLabel(t, stat.aggregation, dt)} · ${t(`yatraSettings.range${stat.time_range}`)}`}</span>
    </div>
  )
}

/** The tiles above the yatra table. The server sends values only to those allowed to see them, matched to the config by position. */
export function StatTiles({ yatra, data }: { yatra: Yatra; data: YatraDataResponse }) {
  const { t } = useTranslation()
  const config = yatra.statistics?.statistics ?? []
  const units = { h: t('today.unitH'), min: t('today.unitMin') }
  if (!data.statistics.length || !config.length) return null
  return (
    <section aria-label={t('yatraSettings.statistics')} className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2.5">
      {data.statistics.map((s, i) => config[i] && (
        <Tile key={i} stat={config[i]} raw={s.value} units={units}
          dt={data.practices.find((p) => p.id === config[i].practice_id)?.data_type} />
      ))}
    </section>
  )
}
