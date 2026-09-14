import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { FaChartLine, FaTh } from 'react-icons/fa'
import { LuX } from 'react-icons/lu'
import { practicesApi } from '../../api/practices'
import { chartsApi } from '../../api/charts'
import type { ReportDefinition, TraceType, PracticeTrace } from '../../api/charts'
import { Spinner } from '../../components/ui/Spinner'
import { ACCENT, ACCENT_GRADIENT, SURFACE_2, TEXT, BORDER } from '../../theme/tokens'

type ReportKind = 'Graph' | 'Grid'
type GraphTraceType = 'Line' | 'Bar' | 'Dot'

const glass: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: `1px solid ${BORDER}`,
  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
}

const inputStyle: React.CSSProperties = {
  background: SURFACE_2,
  border: `1px solid ${BORDER}`,
  borderRadius: '0.75rem',
  outline: 'none',
  width: '100%',
  fontSize: '0.95rem',
  color: TEXT,
  padding: '0.625rem 0.875rem',
  transition: 'border-color 0.15s, box-shadow 0.15s',
}

function onFocus(e: React.FocusEvent<HTMLInputElement>) {
  e.target.style.borderColor = ACCENT
  e.target.style.boxShadow = '0 0 0 3px rgba(245,158,11,0.15)'
}
function onBlur(e: React.FocusEvent<HTMLInputElement>) {
  e.target.style.borderColor = BORDER
  e.target.style.boxShadow = 'none'
}

const TRACE_TYPES: { value: GraphTraceType; tKey: string }[] = [
  { value: 'Line', tKey: 'traceLine' },
  { value: 'Bar',  tKey: 'traceBar'  },
  { value: 'Dot',  tKey: 'traceDot'  },
]

export function NewChartPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [kind, setKind] = useState<ReportKind>('Graph')
  // Map: practice_id → trace type (for Graph)
  const [traceTypes, setTraceTypes] = useState<Record<string, GraphTraceType>>({})
  // Selected practice IDs (both Grid and Graph)
  const [selected, setSelected] = useState<string[]>([])

  const { data: practices = [], isLoading } = useQuery({
    queryKey: ['practices'],
    queryFn: practicesApi.getUserPractices,
  })

  const mutation = useMutation({
    mutationFn: () => {
      let definition: ReportDefinition
      if (kind === 'Grid') {
        definition = { Grid: { practices: selected } }
      } else {
        const traces: PracticeTrace[] = selected.map(id => {
          const tt: GraphTraceType = traceTypes[id] ?? 'Line'
          const type_: TraceType = tt === 'Line'
            ? { Line: { style: 'Regular' } }
            : tt === 'Bar' ? 'Bar' : 'Dot'
          return { label: null, type_, practice: id, y_axis: null, show_average: true }
        })
        definition = { Graph: { bar_layout: 'Grouped', traces } }
      }
      return chartsApi.createReport(name, definition)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reports'] })
      navigate('/charts')
    },
  })

  if (isLoading) return <Spinner />

  const activePractices = practices.filter(p => p.is_active)
  const STEP_LABELS = [t('charts.reportName'), t('charts.selectPractices')]
  const canNext0 = name.trim().length > 0
  const canSave = selected.length > 0

  function togglePractice(id: string) {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
    if (!traceTypes[id]) setTraceTypes(prev => ({ ...prev, [id]: 'Line' }))
  }

  function selectAll() {
    setSelected(activePractices.map(p => p.id))
  }

  function clearAll() {
    setSelected([])
    setTraceTypes({})
  }

  return (
    <div className="px-4 py-6 max-w-lg sm:max-w-2xl mx-auto flex flex-col gap-4 pb-24 sm:pb-8">
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
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-bold text-base-content leading-tight">{t('charts.newReport')}</h1>
          <p className="text-xs text-base-content/70 mt-0.5">Step {step + 1} of {STEP_LABELS.length}</p>
        </div>
        <Link
          to="/charts"
          aria-label="Close"
          className="w-9 h-9 flex items-center justify-center rounded-full flex-shrink-0"
          style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.40)' }}
        >
          <LuX className="w-4 h-4" />
        </Link>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-1 px-1">
        {STEP_LABELS.map((label, i) => (
          <div key={label} className="flex-1 flex flex-col gap-1.5">
            <div
              className="h-1 rounded-full transition-all duration-300"
              style={{ background: i <= step ? ACCENT : 'rgba(255,255,255,0.15)' }}
            />
            <span className="text-xs font-medium" style={{ color: i === step ? ACCENT : 'rgba(242,244,246,0.7)' }}>
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* ── Step 0: name + kind ── */}
      {step === 0 && (
        <div className="flex flex-col gap-3">
          {/* Name */}
          <div className="rounded-2xl px-5 py-4 flex flex-col gap-2" style={glass}>
            <label className="text-xs font-semibold text-base-content/70 uppercase tracking-widest">{t('charts.reportName')}</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={t('charts.reportNamePlaceholder')}
              style={inputStyle}
              onFocus={onFocus}
              onBlur={onBlur}
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter' && canNext0) setStep(1) }}
            />
          </div>

          {/* Kind: Graph vs Grid */}
          <div className="rounded-2xl p-4 flex flex-col gap-3" style={glass}>
            <span className="text-xs font-semibold text-base-content/70 uppercase tracking-widest">{t('charts.reportType')}</span>
            <div className="flex gap-3">
              {([
                ['Graph', 'kindGraph', 'kindGraphDesc', FaChartLine],
                ['Grid',  'kindGrid',  'kindGridDesc',  FaTh],
              ] as const).map(([k, labelKey, descKey, Icon]) => {
                  const active = kind === k
                  return (
                    <button
                      key={k}
                      onClick={() => setKind(k)}
                      className="flex-1 flex flex-col items-center gap-2 py-4 rounded-xl transition-all"
                      style={{
                        background: active ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.04)',
                        border: active ? '1.5px solid rgba(245,158,11,0.40)' : `1.5px solid ${BORDER}`,
                      }}
                    >
                      <Icon className="w-5 h-5" style={{ color: active ? ACCENT : 'rgba(242,244,246,0.7)' }} />
                      <div>
                        <div className="text-sm font-semibold" style={{ color: active ? ACCENT : '#f2f4f6' }}>{t(`charts.${labelKey}`)}</div>
                        <div className="text-xs text-center" style={{ color: 'rgba(242,244,246,0.7)' }}>{t(`charts.${descKey}`)}</div>
                      </div>
                    </button>
                  )
                }
              )}
            </div>
          </div>

          <button
            onClick={() => setStep(1)}
            disabled={!canNext0}
            className="w-full h-12 rounded-full text-sm font-semibold transition-opacity"
            style={{
              background: ACCENT_GRADIENT,
              color: 'white',
              border: 'none',
              boxShadow: '0 4px 20px rgba(245,158,11,0.35)',
              opacity: canNext0 ? 1 : 0.45,
            }}
          >
            {t('charts.next')}
          </button>
        </div>
      )}

      {/* ── Step 1: pick practices (+ trace type for Graph) ── */}
      {step === 1 && (
        <div className="flex flex-col gap-2">
          <div className="rounded-2xl px-4 py-3 flex flex-col gap-1.5" style={glass}>
            <p className="text-xs font-semibold text-base-content/70 uppercase tracking-widest pb-1">
              {kind === 'Grid' ? t('charts.selectPractices') : t('charts.selectWithType')}
            </p>
            <div className="flex gap-3 pb-1">
              <button
                type="button"
                onClick={selectAll}
                className="text-xs font-semibold"
                style={{ color: ACCENT, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                {t('charts.selectAll')}
              </button>
              <button
                type="button"
                onClick={clearAll}
                className="text-xs font-semibold"
                style={{ color: 'rgba(242,244,246,0.7)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                {t('charts.clearAll')}
              </button>
            </div>

            {activePractices.map(p => {
              const sel = selected.includes(p.id)
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-3 py-2"
                  style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}
                >
                  {/* Checkbox */}
                  <button
                    type="button"
                    onClick={() => togglePractice(p.id)}
                    className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-all"
                    style={{
                      background: sel ? ACCENT : 'rgba(255,255,255,0.06)',
                      border: sel ? 'none' : `1.5px solid ${BORDER}`,
                    }}
                  >
                    {sel && (
                      <svg viewBox="0 0 10 8" fill="none" className="w-2.5 h-2.5">
                        <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>

                  <span className="flex-1 text-sm font-semibold text-base-content">{p.practice}</span>

                  {/* Trace type selector (Graph only, when selected) */}
                  {kind === 'Graph' && sel && (
                    <div className="flex gap-1 flex-shrink-0">
                      {TRACE_TYPES.map(tt => (
                        <button
                          key={tt.value}
                          onClick={() => setTraceTypes(prev => ({ ...prev, [p.id]: tt.value }))}
                          className="px-2 py-0.5 rounded-lg text-xs font-semibold transition-all"
                          style={{
                            background: (traceTypes[p.id] ?? 'Line') === tt.value
                              ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.05)',
                            color: (traceTypes[p.id] ?? 'Line') === tt.value
                              ? ACCENT : 'rgba(242,244,246,0.65)',
                            border: (traceTypes[p.id] ?? 'Line') === tt.value
                              ? '1px solid rgba(245,158,11,0.30)' : '1px solid transparent',
                          }}
                        >
                          {t(`charts.${tt.tKey}`)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}

            {activePractices.length === 0 && (
              <p className="text-sm text-base-content/70 py-4 text-center">{t('charts.noPractices')}</p>
            )}
          </div>

          <div className="flex gap-2 mt-1">
            <button
              onClick={() => setStep(0)}
              className="flex-1 h-12 rounded-full text-sm font-semibold"
              style={{ background: 'rgba(255,255,255,0.06)', color: TEXT, border: `1px solid ${BORDER}` }}
            >
              {t('common.back')}
            </button>
            <button
              onClick={() => mutation.mutate()}
              disabled={!canSave || mutation.isPending}
              className="flex-1 h-12 rounded-full text-sm font-semibold flex items-center justify-center gap-2 transition-opacity"
              style={{
                background: ACCENT_GRADIENT,
                color: 'white',
                border: 'none',
                boxShadow: '0 4px 20px rgba(245,158,11,0.35)',
                opacity: canSave && !mutation.isPending ? 1 : 0.45,
              }}
            >
              {mutation.isPending && <span className="loading loading-spinner loading-xs" />}
              {t('charts.saveReport')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
