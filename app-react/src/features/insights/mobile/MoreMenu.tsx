import { useState } from 'react'
import type { ReactNode } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { chartsApi } from '../../../api/charts'
import { useToast } from '../../../hooks/useToast'
import type { AppBarAction } from '../../../layouts/mobile/AppBar'
import { BottomSheet } from '../../../ui/primitives/BottomSheet'
import { copyShareLink, downloadCsv } from '../../today/actions'
import { NewChartSheet } from '../settings/mobile/NewChartSheet'
import type { Report } from '../../../api/charts'

export function useMoreMenu(report: Report | null): { actions: AppBarAction[]; sheet: ReactNode } {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { showToast } = useToast()
  const [confirming, setConfirming] = useState(false)
  const [creating, setCreating] = useState(false)
  const remove = useMutation({
    mutationFn: (id: string) => chartsApi.deleteReport(id),
    onSuccess: () => { setConfirming(false); void qc.invalidateQueries({ queryKey: ['reports'] }) },
    onError: () => showToast({ message: t('common.error'), variant: 'error' }),
  })

  const actions: AppBarAction[] = [
    { label: t('insights.newChart'), onSelect: () => setCreating(true) },
    ...(report
      ? [{
        label: t('insights.editReport', { name: report.name }),
        onSelect: () => navigate(`/settings/charts/${report.id}`),
      }]
      : []),
    { label: t('charts.shareLink'), onSelect: () => { if (copyShareLink()) showToast({ message: t('charts.copied'), variant: 'success' }) } },
    { label: t('charts.downloadCsv'), onSelect: () => { downloadCsv().catch(() => showToast({ message: t('common.error'), variant: 'error' })) } },
    ...(report ? [{ label: t('insights.deleteReport'), onSelect: () => setConfirming(true) }] : []),
  ]

  const sheet = confirming && report ? (
    <BottomSheet label={t('charts.deleteTitle')} onClose={() => setConfirming(false)}>
      <div className="flex flex-col gap-1.5">
        <h2 className="text-xl font-extrabold text-ui-ink">{t('charts.deleteTitle')}</h2>
        <p className="text-sm text-ui-muted">{t('charts.deleteMsg', { name: report.name })}</p>
      </div>
      <div className="grid grid-cols-[1fr_2fr] gap-2.5">
        <button type="button" onClick={() => setConfirming(false)}
          className="h-[50px] rounded-[14px] border border-ui-control text-[15px] font-bold text-ui-ink">
          {t('common.cancel')}
        </button>
        <button type="button" disabled={remove.isPending} onClick={() => remove.mutate(report.id)}
          className="h-[50px] rounded-[14px] bg-ui-danger text-[15px] font-bold text-white disabled:opacity-60">
          {t('common.delete')}
        </button>
      </div>
    </BottomSheet>
  ) : null

  return { actions, sheet: <>{sheet}{creating && <NewChartSheet onClose={() => setCreating(false)} />}</> }
}
