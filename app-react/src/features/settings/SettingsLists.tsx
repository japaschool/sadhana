import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { chartsApi } from '../../api/charts'
import { yatrasApi } from '../../api/yatras'
import { UiLoading } from '../../layouts/ByLayout'
import { useLayout } from '../../layouts/useLayout'
import { NewChartSheet } from '../insights/settings/mobile/NewChartSheet'
import { ChartRows, YatraRows } from './sections'
import { AddPill, ROWS, SettingsSubpage } from './SettingsSubpage'

const EMPTY = 'rounded-[18px] border border-dashed border-ui-control px-6 py-8 text-center text-sm text-ui-muted'

/** /settings/charts: your charts. Tablet and desktop list them beside the editor, so they open the first one. */
export function ChartsSettings() {
  const { t } = useTranslation()
  const layout = useLayout()
  const [creating, setCreating] = useState(false)
  const q = useQuery({ queryKey: ['reports'], queryFn: chartsApi.getReports })
  if (q.isLoading) return <UiLoading />
  if (layout !== 'mobile' && q.data?.length) return <Navigate to={`/settings/charts/${q.data[0].id}`} replace />
  return (
    <SettingsSubpage title={t('insights.title')} action={<AddPill label={t('chartSettings.newChart')} onClick={() => setCreating(true)} />}>
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
