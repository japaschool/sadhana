import { useState } from 'react'
import type { ReactNode } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { chartsApi } from '../../../../api/charts'
import type { Report, ReportDefinition } from '../../../../api/charts'
import { useToast } from '../../../../hooks/useToast'
import { BottomSheet } from '../../../../ui/primitives/BottomSheet'
import { BTN, FIELD, HINT } from '../../../yatras/settings/mobile/AdminPage'
import { SheetHeader } from '../../../yatras/settings/mobile/fields'
import { ZONE_BG } from '../../../yatras/yatrasLogic'
import { writeStored } from '../../useInsights'

type Kind = 'Graph' | 'Grid'

function GraphSketch() {
  const bars = [9, 6, 4, 8, 5, 11, 7, 6, 10, 4]
  return (
    <svg aria-hidden viewBox="0 0 100 44" className="h-full w-full">
      {bars.map((h, i) => <rect key={i} x={4 + i * 9.4} y={42 - h * 3.4} width="5" height={h * 3.4} rx="1" fill="var(--ui-chart-1)" />)}
      <polyline points="6,26 15,32 25,22 34,24 44,21 53,23 62,14 72,20 81,10 92,16" fill="none" stroke="var(--ui-chart-2)" strokeWidth="1.6" />
    </svg>
  )
}

function TableSketch() {
  const z = [ZONE_BG.Green, ZONE_BG.Yellow, 'bg-ui-chip', ZONE_BG.Red]
  return (
    <span aria-hidden className="grid h-full w-full grid-cols-5 gap-1 p-1">
      {Array.from({ length: 20 }, (_, i) => <span key={i} className={`rounded-[3px] ${i % 5 === 0 ? 'bg-ui-chip' : z[(i * 7) % 4]}`} />)}
    </span>
  )
}

/** Type and name in one sheet; Create opens the new chart's settings (a graph with its practice picker up). */
export function NewChartSheet({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { showToast } = useToast()
  const [kind, setKind] = useState<Kind>('Graph')
  const [name, setName] = useState('')
  const create = useMutation({
    mutationFn: async () => {
      const definition: ReportDefinition = kind === 'Graph' ? { Graph: { bar_layout: 'Grouped', traces: [] } } : { Grid: { practices: [] } }
      const id = await chartsApi.createReport(name.trim(), definition)
      return { id, name: name.trim(), definition } satisfies Report
    },
    onSuccess: (r) => {
      qc.setQueryData<Report[]>(['reports'], (list) => [...(list ?? []), r])
      // Back on Insights, the new chart is the one shown.
      writeStored(r.id)
      navigate(`/charts/${r.id}/edit`, { state: { pick: kind === 'Graph' } })
    },
    onError: () => showToast({ message: t('common.error'), variant: 'error' }),
  })

  const card = (k: Kind, title: string, desc: string, sketch: ReactNode) => {
    const on = kind === k
    return (
      <button type="button" role="radio" aria-checked={on} onClick={() => setKind(k)}
        className={`flex flex-col gap-2.5 rounded-[18px] border-[1.5px] p-2.5 text-left ${on ? 'border-ui-accent-fill bg-ui-accent-soft' : 'border-ui-control bg-ui-surface'}`}>
        <span className="flex h-[76px] items-center justify-center overflow-hidden rounded-xl bg-ui-surface px-2 py-1.5 ring-1 ring-ui-hairline">{sketch}</span>
        <span className="flex items-start gap-2 px-1.5 pb-1">
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[17px] font-extrabold text-ui-ink">{title}</span>
            <span className="text-[13px] leading-snug text-ui-muted">{desc}</span>
          </span>
          <span aria-hidden className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${on ? 'border-ui-accent-fill' : 'border-ui-faint2'}`}>
            {on && <span className="h-2.5 w-2.5 rounded-full bg-ui-accent-fill" />}
          </span>
        </span>
      </button>
    )
  }

  return (
    <BottomSheet label={t('chartSettings.newChart')} onClose={onClose}>
      <SheetHeader title={t('chartSettings.newChart')} onClose={onClose} />
      <div className="flex flex-col gap-2">
        <span id="chart-kind" className="text-[13px] font-bold text-ui-muted">{t('chartSettings.kindQuestion')}</span>
        <div role="radiogroup" aria-labelledby="chart-kind" className="grid grid-cols-2 gap-2.5">
          {card('Graph', t('chartSettings.graph'), t('chartSettings.graphDesc'), <GraphSketch />)}
          {card('Grid', t('chartSettings.table'), t('chartSettings.tableDesc'), <TableSketch />)}
        </div>
        <p className={HINT}>{t('chartSettings.typeFixed')}</p>
      </div>
      <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); if (name.trim()) create.mutate() }}>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="new-chart-name" className="text-[13px] font-bold text-ui-muted">{t('chartSettings.name')}</label>
          <input id="new-chart-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off"
            placeholder={t('chartSettings.namePlaceholder')} className={FIELD} />
        </div>
        <button type="submit" disabled={!name.trim() || create.isPending} className={`${BTN} bg-ui-accent-fill text-ui-ink disabled:opacity-50`}>
          {t(kind === 'Graph' ? 'chartSettings.createGraph' : 'chartSettings.createTable')}
        </button>
        <p className={`${HINT} text-center`}>{t(kind === 'Graph' ? 'chartSettings.nextGraph' : 'chartSettings.nextTable')}</p>
      </form>
    </BottomSheet>
  )
}
