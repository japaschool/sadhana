import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { chartsApi } from '../../api/charts'
import type { ReportDuration } from '../../api/charts'
import { toCSV, triggerCSVDownload } from '../insights/csv'
import { usePractices } from '../practices/usePractices'
import { useLogDate } from '../today/useLogDate'
import { toDateStr } from '../today/date'
import { CARD, FIELD, HINT, LIST } from '../yatras/settings/mobile/AdminPage'
import { ErrorBanner, LABEL, PRIMARY, SettingsDetail, SPINNER } from './SettingsDetail'

const DURATIONS: ReportDuration[] = ['Week', 'Month', 'Quarter', 'HalfYear', 'Year', 'TwoYears', 'ThreeYears', 'FiveYears', 'AllData']

/** Settings → Export CSV: chosen practices, over a duration ending on a day (the log's, by default). */
export function ExportCsv() {
  const { t } = useTranslation()
  const [logDate] = useLogDate()
  // The report endpoint only returns active practices.
  const practices = usePractices().practices.filter((p) => p.is_active)
  const [off, setOff] = useState<Set<string>>(new Set()) // unticked ids, so all start ticked
  // Opened from a report: its range. Otherwise all of it.
  const asked = useSearchParams()[0].get('duration') as ReportDuration
  const [duration, setDuration] = useState<ReportDuration>(DURATIONS.includes(asked) ? asked : 'AllData')
  const [end, setEnd] = useState(toDateStr(logDate))
  const chosen = practices.filter((p) => !off.has(p.id))
  const toggle = (id: string) => setOff((s) => { const n = new Set(s); if (!n.delete(id)) n.add(id); return n })

  const download = useMutation({
    mutationFn: async () => {
      const names = new Set(chosen.map((p) => p.practice))
      const rows = await chartsApi.getReportData(end, duration)
      triggerCSVDownload(toCSV(rows.filter((r) => names.has(r.practice))))
    },
  })

  return (
    <SettingsDetail title={t('export.title')} footer={
      <button type="button" className={PRIMARY} disabled={!chosen.length || !end || download.isPending} onClick={() => download.mutate()}>
        {download.isPending && <span aria-hidden className={SPINNER} />}{t('export.download')}
      </button>
    }>
      <div className={`${CARD} flex flex-col gap-4 p-4`}>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="export-duration" className={LABEL}>{t('export.duration')}</label>
          <select id="export-duration" value={duration} onChange={(e) => setDuration(e.target.value as ReportDuration)} className={FIELD}>
            {DURATIONS.map((d) => <option key={d} value={d}>{t(`export.range.${d}`)}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="export-end" className={LABEL}>{t('export.lastDay')}</label>
          <input id="export-end" type="date" value={end} max={toDateStr(new Date())} onChange={(e) => setEnd(e.target.value)} className={FIELD} />
        </div>
      </div>

      <fieldset className="flex flex-col gap-1.5">
        <legend className={`${LABEL} mb-1.5 flex w-full items-center px-1`}>
          <span className="flex-1">{t('export.practices')}</span>
          <button type="button" className="text-[13px] font-bold text-ui-accent"
            onClick={() => setOff(chosen.length ? new Set(practices.map((p) => p.id)) : new Set())}>
            {t(chosen.length ? 'export.none' : 'export.all')}
          </button>
        </legend>
        {practices.length ? (
          <ul className={LIST}>
            {practices.map((p) => (
              <li key={p.id}>
                <label className="flex min-h-[52px] cursor-pointer items-center gap-3 bg-ui-surface px-4 py-3">
                  <input type="checkbox" checked={!off.has(p.id)} onChange={() => toggle(p.id)} className="h-5 w-5 shrink-0 accent-ui-accent" />
                  <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-ui-ink">{p.practice}</span>
                </label>
              </li>
            ))}
          </ul>
        ) : <p className={`${HINT} px-1`}>{t('export.noPractices')}</p>}
      </fieldset>
      {download.isError && <ErrorBanner title={t('export.failed')} text={t('export.failedHint')} />}
    </SettingsDetail>
  )
}
