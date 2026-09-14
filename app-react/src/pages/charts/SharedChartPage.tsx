import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { FaChartLine, FaTh } from 'react-icons/fa'
import { chartsApi } from '../../api/charts'
import type { ReportDefinition } from '../../api/charts'

function isGridDef(def: ReportDefinition): def is { Grid: { practices: string[] } } {
  return 'Grid' in def
}
import { Spinner } from '../../components/ui/Spinner'
import { ACCENT, ACCENT_GRADIENT, BORDER } from '../../theme/tokens'

const glass: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: `1px solid ${BORDER}`,
  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
}

export function SharedChartPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()

  const { data: reports = [], isLoading, isError } = useQuery({
    queryKey: ['shared-reports', id],
    queryFn: () => chartsApi.getSharedReports(id!),
    enabled: !!id,
  })

  if (isLoading) return <Spinner />

  if (isError) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-sm text-base-content/70">{t('charts.notFound')}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen px-4 py-8 max-w-lg sm:max-w-2xl mx-auto flex flex-col gap-4">
      {/* Header */}
      <div className="rounded-2xl px-5 py-5 flex items-center gap-4" style={glass}>
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{
            background: ACCENT_GRADIENT,
            boxShadow: '0 4px 16px rgba(245,158,11,0.30)',
          }}
        >
          <FaChartLine className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-base font-bold text-base-content">{t('charts.shared')}</h1>
          <p className="text-xs text-base-content/70 mt-0.5">
            {reports.length} report{reports.length === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      {reports.length === 0 ? (
        <p className="text-center text-sm text-base-content/70 py-12">{t('charts.noShared')}</p>
      ) : (
        reports.map(r => {
          const def = r.definition
          const gridDef = isGridDef(def) ? def : null
          const count = gridDef
            ? gridDef.Grid.practices.length
            : (def as { Graph: { bar_layout: string; traces: unknown[] } }).Graph.traces.length
          return (
            <div key={r.id} className="rounded-2xl px-4 py-4 flex items-center gap-3" style={glass}>
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: gridDef ? 'rgba(99,102,241,0.10)' : 'rgba(245,158,11,0.10)' }}
              >
                {gridDef
                  ? <FaTh className="w-4 h-4" style={{ color: '#6366f1' }} />
                  : <FaChartLine className="w-4 h-4" style={{ color: ACCENT }} />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-base-content truncate">{r.name}</p>
                <p className="text-xs mt-0.5" style={{ color: 'rgba(242,244,246,0.7)' }}>
                  {gridDef ? 'Grid' : 'Graph'} · {count} practice{count === 1 ? '' : 's'}
                </p>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
