import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useReports } from '../insights/useReports'
import { useInsightPrefs } from '../insights/overview/prefs'
import { SleepSetupSheet } from '../insights/overview/SleepSetupSheet'
import { resolveSleep } from '../insights/overview/useOverview'
import { useMarkedPeriods } from '../../api/markedPeriods'
import { practicesApi } from '../../api/practices'
import { Toggle } from '../../ui/primitives/Toggle'
import { SettingsRow } from './mobile/SettingsRow'
import { yatrasApi } from '../../api/yatras'
import { UiLoading } from '../../layouts/ByLayout'
import { useLayout } from '../../layouts/useLayout'
import { NewChartSheet } from '../insights/settings/mobile/NewChartSheet'
import { ChartRows, YatraRows } from './sections'
import { AddPill, ROWS, SettingsSubpage } from './SettingsSubpage'

const EMPTY = 'rounded-[18px] border border-dashed border-ui-control px-6 py-8 text-center text-sm text-ui-muted'

/** Streaks, period suggestions, the sleep pair and marked periods (16m13). */
export function InsightsPrefsRows() {
  const { t } = useTranslation()
  const [prefs, setPrefs] = useInsightPrefs()
  const [asking, setAsking] = useState(false)
  const reports = useReports().data
  const practices = useQuery({ queryKey: ['practices'], queryFn: practicesApi.getUserPractices }).data
  const { periods } = useMarkedPeriods()
  const sleep = practices ? resolveSleep(prefs.sleep, practices, reports ?? []) : null
  const nameOf = (id: string) => practices?.find((p) => p.id === id)?.practice ?? ''
  return (
    <div className={ROWS}>
      <SettingsRow label={t('insights.periods.showStreaks')} hint={t('insights.periods.streaksHint')}
        control={<Toggle label={t('insights.periods.showStreaks')} checked={prefs.streaks} onChange={(streaks) => setPrefs({ streaks })} />} />
      <SettingsRow label={t('insights.periods.suggest')} hint={t('insights.periods.suggestHint')}
        control={<Toggle label={t('insights.periods.suggest')} checked={prefs.suggest} onChange={(suggest) => setPrefs({ suggest })} />} />
      <SettingsRow label={t('insights.periods.sleep')} onClick={() => setAsking(true)}
        value={sleep ? `${nameOf(sleep.bedtime)} · ${nameOf(sleep.wake)}` : t('settings.off')} />
      <SettingsRow label={t('insights.periods.title')} to="/settings/periods" value={String(periods.length)} />
      {asking && practices && (
        <SleepSetupSheet current={sleep} practices={practices.filter((p) => p.is_active && p.data_type === 'Time')} onClose={() => setAsking(false)}
          onSave={(rows) => { setPrefs({ sleep: rows }); setAsking(false) }}
          onSkip={() => { setPrefs({ sleep: 'skip' }); setAsking(false) }} />
      )}
    </div>
  )
}

/** /settings/charts: your charts. Tablet and desktop list them beside the editor, so they open the first one. */
export function ChartsSettings() {
  const { t } = useTranslation()
  const layout = useLayout()
  const [creating, setCreating] = useState(false)
  const q = useReports()
  if (q.isLoading) return <UiLoading />
  if (layout !== 'mobile' && q.data?.length) return <Navigate to={`/settings/charts/${q.data[0].id}`} replace />
  return (
    <SettingsSubpage title={t('insights.title')} action={<AddPill label={t('chartSettings.newChart')} onClick={() => setCreating(true)} />}>
      <InsightsPrefsRows />
      {q.isError ? <p role="alert" className="text-sm text-ui-danger">{t('common.error')}</p>
        : q.data?.length ? <div className={ROWS}><ChartRows /></div>
        : <p className={EMPTY}>{t('charts.empty')}</p>}
      {creating && <NewChartSheet onClose={() => setCreating(false)} />}
    </SettingsSubpage>
  )
}

/** /settings/yatras: your yatras, each to its settings. */
export function YatrasSettings() {
  const { t } = useTranslation()
  const q = useQuery({ queryKey: ['yatras'], queryFn: yatrasApi.getYatras })
  if (q.isLoading) return <UiLoading />
  return (
    <SettingsSubpage title={t('settings.yatras')}>
      {q.isError ? <p role="alert" className="text-sm text-ui-danger">{t('common.error')}</p>
        : q.data?.length ? <div className={ROWS}><YatraRows /></div>
        : <p className={EMPTY}>{t('yatras.empty')}</p>}
    </SettingsSubpage>
  )
}
