import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { chartsApi } from '../../../../api/charts'
import { nameTaken, REPORTS_KEY, useReports } from '../../useReports'
import type { Report, ReportDefinition } from '../../../../api/charts'
import { useToast } from '../../../../hooks/useToast'
import { BottomSheet } from '../../../../ui/primitives/BottomSheet'
import { BTN, CARD, FIELD, HINT } from '../../../yatras/settings/mobile/AdminPage'
import { SheetHeader } from '../../../yatras/settings/mobile/fields'
import { KindGlyph } from '../../ReportGlyph'
import { writeStored } from '../../useInsights'

type Kind = 'Graph' | 'Grid'

const TEMPLATES = ['sleep', 'japa', 'duration'] as const

const GROUP = 'px-1 text-[11px] font-bold uppercase tracking-[.1em] text-ui-muted'

/**
 * Ready-made reports first, each opening its own form (15m1). Under them Graph and Table: picking one asks for a
 * name, and Create opens the new chart's settings (a graph with its practice picker up).
 */
export function NewChartSheet({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { showToast } = useToast()
  const [kind, setKind] = useState<Kind | null>(null)
  const [name, setName] = useState('')
  const taken = nameTaken(useReports().data ?? [], name)
  const create = useMutation({
    mutationFn: async () => {
      const definition: ReportDefinition = kind === 'Graph' ? { Graph: { bar_layout: 'Grouped', traces: [] } } : { Grid: { practices: [], group_columns: true } }
      const id = await chartsApi.createReport(name.trim(), definition)
      return { id, name: name.trim(), definition } satisfies Report
    },
    onSuccess: (r) => {
      qc.setQueryData<Report[]>([...REPORTS_KEY], (list) => [...(list ?? []), r])
      // Back on Insights, the new chart is the one shown.
      writeStored(r.id)
      navigate(`/settings/charts/${r.id}`, { state: { pick: kind === 'Graph' } })
    },
    onError: () => showToast({ message: t('common.error'), variant: 'error' }),
  })

  const row = (k: Kind, glyph: 'graph' | 'table', title: string, desc: string) => {
    const on = kind === k
    return (
      <button type="button" role="radio" aria-checked={on} onClick={() => setKind(k)}
        className={`flex min-h-16 min-w-0 items-center gap-2.5 rounded-[14px] border p-2.5 text-left ${on ? 'border-ui-accent-fill bg-ui-accent-soft' : 'border-ui-control bg-ui-surface'}`}>
        <span className="flex w-5 shrink-0 justify-center"><KindGlyph kind={glyph} className="text-ui-ink2" /></span>
        <span className="flex min-w-0 flex-1 flex-col gap-px">
          <span className="text-[15px] font-extrabold text-ui-ink">{title}</span>
          <span className="text-xs leading-snug text-ui-muted">{desc}</span>
        </span>
      </button>
    )
  }

  return (
    <BottomSheet label={t('chartSettings.newChart')} onClose={onClose}>
      <SheetHeader title={t('chartSettings.newChart')} onClose={onClose} />
      <div className="flex flex-col gap-2">
        <h3 className={GROUP}>{t('chartSettings.readyMade')}</h3>
        <div className={`${CARD} overflow-hidden`}>
          {TEMPLATES.map((k, i) => (
            <Link key={k} to={`/settings/charts/new/${k}`} onClick={onClose}
              className={`flex min-h-[72px] items-center gap-3 py-2.5 pr-3.5 pl-3 ${i ? 'border-t border-ui-hairline' : ''}`}>
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ui-accent-soft">
                <span className="flex scale-150"><KindGlyph kind={k} className="text-ui-accent" /></span>
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-base font-extrabold text-ui-ink">{t(`chartSettings.${k}`)}</span>
                <span className="text-[13px] leading-snug text-ui-muted">{t(`chartSettings.${k}Desc`)}</span>
              </span>
              <span aria-hidden className="text-lg text-ui-faint2">›</span>
            </Link>
          ))}
        </div>
        <p className={`${HINT} px-1`}>{t('chartSettings.readyMadeHint')}</p>
      </div>
      <div className="flex flex-col gap-2">
        <h3 id="chart-kind" className={GROUP}>{t('chartSettings.buildYourOwn')}</h3>
        <div role="radiogroup" aria-labelledby="chart-kind" className="grid grid-cols-2 gap-2">
          {row('Graph', 'graph', t('chartSettings.graph'), t('chartSettings.graphDesc'))}
          {row('Grid', 'table', t('chartSettings.table'), t('chartSettings.tableDesc'))}
        </div>
      </div>
      {kind && (
        <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); if (name.trim() && !taken) create.mutate() }}>
          <p className={HINT}>{t('chartSettings.typeFixed')}</p>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="new-chart-name" className="text-[13px] font-bold text-ui-muted">{t('chartSettings.name')}</label>
            <input id="new-chart-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off"
              placeholder={t('chartSettings.namePlaceholder')} aria-invalid={taken} className={FIELD} />
            {taken && <p role="alert" className="text-[13px] text-ui-danger">{t('chartSettings.nameTaken')}</p>}
          </div>
          <button type="submit" disabled={!name.trim() || taken || create.isPending} className={`${BTN} bg-ui-accent-fill text-ui-ink disabled:opacity-50`}>
            {t(kind === 'Graph' ? 'chartSettings.createGraph' : 'chartSettings.createTable')}
          </button>
          <p className={`${HINT} text-center`}>{t(kind === 'Graph' ? 'chartSettings.nextGraph' : 'chartSettings.nextTable')}</p>
        </form>
      )}
    </BottomSheet>
  )
}
