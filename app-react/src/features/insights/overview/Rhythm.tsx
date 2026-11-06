import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useMarkedPeriods } from '../../../api/markedPeriods'
import { UiLoading } from '../../../layouts/ByLayout'
import { SettingsSubpage } from '../../settings/SettingsSubpage'
import { fromDateStr, toDateStr } from '../../today/date'
import { fingerprint, fingerprintRows } from './fingerprint'
import { rowName, rowValueText } from './format'
import { rowSeries } from './series'
import { stepStyle } from './stepStyle'
import { useInsightRows } from './useInsightRows'
import { useYearData } from './useYearData'
import { shift } from './usual'
import { mondayOf } from './yearMap'

const SWATCH = 'h-3.5 w-3.5 shrink-0 rounded-[4px]'

/** /insights/rhythm: each row's typical Monday to Sunday (16m8). */
export function Rhythm() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language || 'en'
  const todayCob = toDateStr(new Date())
  const { periods } = useMarkedPeriods()
  const dataQ = useYearData(todayCob)
  const data = useInsightRows(dataQ, todayCob)
  const rows = useMemo(() => fingerprintRows(data.practices), [data.practices])
  const noRows = rows.length === 0
  const fp = useMemo(
    () => fingerprint(rows, rowSeries(rows, data.entries, data.practices, null, todayCob), periods, todayCob),
    [rows, data.practices, data.entries, periods, todayCob],
  )
  const weekdays = useMemo(() => Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(fromDateStr(shift(mondayOf(todayCob), i)))), [locale, todayCob])
  const units = { h: t('today.unitH'), min: t('today.unitMin') }
  const cols = { gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }

  let body
  if (dataQ.isLoading || data.isLoading) body = <UiLoading />
  else if (data.isError) body = <p role="alert" className="py-10 text-center text-sm text-ui-danger">{t('insights.loadFailed')}</p>
  else if (!fp) body = <p className="py-10 text-center text-sm text-ui-muted">{t(noRows ? 'insights.rhythm.footnote' : 'insights.rhythm.notYet')}</p>
  else body = (
    <>
      <p className="text-[13px] leading-[1.45] text-ui-muted">{t('insights.rhythm.intro')}</p>
      <div className="flex flex-col gap-3">
        <div aria-hidden className="grid gap-1 text-center font-ui-mono text-[10px] font-bold text-ui-faint2 uppercase" style={cols}>
          {weekdays.map((d, i) => <span key={i}>{d}</span>)}
        </div>
        {fp.map(({ row, typical, days }) => {
          const name = rowName(row, data.practices, t)
          return (
            <div key={row.key} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 text-[13px] font-extrabold text-ui-ink">{name}</span>
                <span className="font-ui-mono text-xs text-ui-muted">{t('insights.rhythm.typical', { v: rowValueText(row.kind, typical, units) })}</span>
              </div>
              <ul aria-label={name} className="grid gap-1" style={cols}>
                {days.map((d, i) => (
                  <li key={i} aria-label={t('insights.rhythm.cell', { row: name, day: weekdays[i], value: d.avg === null ? t('insights.rhythm.noDays') : rowValueText(row.kind, d.avg, units) })}
                    className="flex h-10 min-w-0 items-center justify-center rounded-[6px] font-ui-mono text-[11px] font-semibold text-ui-ink"
                    style={d.avg === null ? { border: '1px dashed var(--ui-hairline)' } : stepStyle(d.step)}>
                    {d.avg === null ? '' : rowValueText(row.kind, d.avg, units)}
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs font-bold text-ui-ink2">
        <li className="inline-flex items-center gap-1.5"><span aria-hidden className={SWATCH} style={{ background: 'var(--ui-div-p3)' }} />{t('insights.rhythm.above')}</li>
        <li className="inline-flex items-center gap-1.5"><span aria-hidden className={SWATCH} style={{ background: 'var(--ui-div-m3)' }} />{t('insights.rhythm.below')}</li>
        <li className="inline-flex items-center gap-1.5"><span aria-hidden className={SWATCH} style={{ border: '1px dashed var(--ui-hairline)' }} />{t('insights.rhythm.noDays')}</li>
      </ul>
      <p className="text-xs leading-[1.4] text-ui-muted">{t('insights.rhythm.footnote')}</p>
    </>
  )
  return <SettingsSubpage wide title={t('insights.rhythm.title')} back={{ to: '/charts', label: t('insights.overview.overview') }}>{body}</SettingsSubpage>
}
