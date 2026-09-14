import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { FaUsers, FaPlus, FaCog } from 'react-icons/fa'
import { LuX, LuRefreshCw } from 'react-icons/lu'
import { useTranslation } from 'react-i18next'
import { yatrasApi } from '../../api/yatras'
import { useUiStore } from '../../store/uiStore'
import { Spinner } from '../../components/ui/Spinner'
import type { UserYatraDataRow, ColourZonesConfig, ZoneColour } from '../../types/api'
import { ACCENT, ACCENT_GRADIENT, SURFACE_PANEL, BORDER } from '../../theme/tokens'

const glass: React.CSSProperties = {
  background: SURFACE_PANEL,
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: `1px solid ${BORDER}`,
  boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
}

const SELECTED_YATRA_KEY = 'selected_yatra'

function todayStr(): string {
  return new Date().toISOString().split('T')[0]
}

// ── Value display ──────────────────────────────────────────────────────────

function valueToNumber(val: unknown): number | null {
  if (val === null || val === undefined) return null
  if (typeof val === 'number') return val
  if (typeof val === 'object') {
    const v = val as Record<string, unknown>
    if ('Bool' in v) return (v.Bool as boolean) ? 1 : 0
    if ('Int' in v) return v.Int as number
    if ('Duration' in v) return v.Duration as number
    if ('Time' in v) {
      const t = v.Time as { h: number; m: number }
      return t.h * 60 + t.m
    }
  }
  return null
}

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return '—'
  if (typeof val === 'object') {
    const v = val as Record<string, unknown>
    if ('Bool' in v) return (v.Bool as boolean) ? '✓' : '✗'
    if ('Int' in v) return String(v.Int)
    if ('Duration' in v) {
      const min = v.Duration as number
      if (min === 0) return '—'
      if (min < 60) return `${min}m`
      const h = Math.floor(min / 60), m = min % 60
      return m === 0 ? `${h}h` : `${h}h ${m}m`
    }
    if ('Time' in v) {
      const t = v.Time as { h: number; m: number }
      return `${String(t.h).padStart(2, '0')}:${String(t.m).padStart(2, '0')}`
    }
    if ('Text' in v) return (v.Text as string) || '—'
  }
  return String(val)
}

// ── Colour zones ───────────────────────────────────────────────────────────

function zoneToBackground(zone: ZoneColour): string {
  switch (zone) {
    case 'MutedRed':  return 'rgba(220,38,38,0.12)'
    case 'Red':       return 'rgba(220,38,38,0.30)'
    case 'Yellow':    return 'rgba(234,179,8,0.30)'
    case 'Green':     return 'rgba(22,163,74,0.30)'
    case 'DarkGreen': return 'rgba(15,118,55,0.45)'
    default:          return 'transparent'
  }
}

function findZone(val: unknown, cfg: ColourZonesConfig): ZoneColour {
  const num = valueToNumber(val)
  if (num === null) return cfg.no_value_colour

  for (const bound of cfg.bounds) {
    const toNum = valueToNumber(bound.to)
    if (toNum === null) continue
    if (num <= toNum) return bound.colour
  }

  return cfg.best_colour ?? (cfg.better_direction === 'Higher' ? 'Green' : 'Red')
}

function cellBackground(val: unknown, colourZones: ColourZonesConfig | null | undefined): string {
  if (!colourZones) return 'transparent'
  return zoneToBackground(findZone(val, colourZones))
}

// ── Stability heatmap ──────────────────────────────────────────────────────

function heatmapBackground(score: number): string {
  if (score === 0) return 'transparent'
  if (score <= 50)  return 'rgba(220,38,38,0.15)'
  if (score <= 70)  return 'rgba(220,38,38,0.32)'
  if (score <= 95)  return 'rgba(234,179,8,0.35)'
  if (score <= 105) return 'rgba(22,163,74,0.35)'
  return 'rgba(15,118,55,0.50)'
}

// ── Trend arrow ────────────────────────────────────────────────────────────

function trendSymbol(arrow: UserYatraDataRow['trend_arrow']): string {
  if (arrow === 'Up')   return '↗'
  if (arrow === 'Down') return '↘'
  if (arrow === 'Flat') return '→'
  return '—'
}

function trendColor(arrow: UserYatraDataRow['trend_arrow']): string {
  if (arrow === 'Up')   return '#16a34a'
  if (arrow === 'Down') return '#dc2626'
  return 'rgba(242,244,246,0.7)'
}

// ── Component ─────────────────────────────────────────────────────────────

export function YatrasPage({ embedded = false }: { embedded?: boolean } = {}) {
  const { t } = useTranslation()
  const qc = useQueryClient()

  const dateStr = todayStr()
  const isToday = true

  const [selectedId, setSelectedId] = useState<string | null>(
    () => localStorage.getItem(SELECTED_YATRA_KEY),
  )
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [legendVisible, setLegendVisible] = useState<boolean>(
    () => localStorage.getItem('yatra-legend-shown') !== 'false'
  )

  function dismissLegend() {
    setLegendVisible(false)
    localStorage.setItem('yatra-legend-shown', 'false')
  }

  const yatraListQuery = useQuery({
    queryKey: ['yatras'],
    queryFn: yatrasApi.getYatras,
  })
  const yatras = yatraListQuery.data ?? []

  const selectedYatra = yatras.find(y => y.id === selectedId) ?? yatras[0] ?? null

  useEffect(() => {
    if (selectedYatra && selectedYatra.id !== selectedId) {
      setSelectedId(selectedYatra.id)
      localStorage.setItem(SELECTED_YATRA_KEY, selectedYatra.id)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYatra?.id])

  const dataQuery = useQuery({
    queryKey: ['yatra-data', selectedYatra?.id, dateStr],
    queryFn: () => yatrasApi.getYatraData(selectedYatra!.id, dateStr),
    enabled: !!selectedYatra,
  })

  const createMutation = useMutation({
    mutationFn: yatrasApi.createYatra,
    onSuccess: (newYatra) => {
      qc.invalidateQueries({ queryKey: ['yatras'] })
      setSelectedId(newYatra.id)
      localStorage.setItem(SELECTED_YATRA_KEY, newYatra.id)
      setShowCreate(false)
      setNewName('')
    },
  })

  const handleCreate = () => {
    setNewName('')
    setShowCreate(true)
  }

  // The mobile bottom-nav center "+" asks us (a separately-mounted page) to
  // open the create-yatra modal. Guard against a fresh mount re-firing.
  const yatraCreateNonce = useUiStore((s) => s.yatraCreateNonce)
  const lastYatraNonce = useRef(yatraCreateNonce)
  useEffect(() => {
    if (yatraCreateNonce !== lastYatraNonce.current) {
      lastYatraNonce.current = yatraCreateNonce
      setNewName('')
      setShowCreate(true)
    }
  }, [yatraCreateNonce])

  const submitCreate = () => {
    const n = newName.trim()
    if (n) createMutation.mutate(n)
  }

  const handleSelect = (id: string) => {
    setSelectedId(id)
    localStorage.setItem(SELECTED_YATRA_KEY, id)
  }

  const data = dataQuery.data
  const showStability = selectedYatra?.show_stability_metrics ?? false

  // Heatmap: 15 values, drop last if today (incomplete), else drop first
  const heatmapDays = data
    ? (isToday
        ? data.stability_heatmap_days.slice(0, 14)
        : data.stability_heatmap_days.slice(1))
    : []

  function heatmapScores(row: UserYatraDataRow): number[] {
    const raw = isToday
      ? row.stability_heatmap.slice(0, 14)
      : row.stability_heatmap.slice(1)
    return raw
  }

  return (
    <>
      <div className={embedded ? 'flex flex-col gap-3' : 'px-4 py-4 pb-28 sm:pb-8 max-w-lg sm:max-w-2xl mx-auto flex flex-col gap-3'}>

        {/* Yatra selector header */}
        <div className="rounded-2xl px-4 py-3 flex items-center gap-3" style={glass}>
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: ACCENT_GRADIENT,
              boxShadow: '0 4px 12px rgba(245,158,11,0.28)',
            }}
          >
            <FaUsers className="w-4 h-4 text-white" />
          </div>

          {yatras.length > 0 ? (
            <select
              value={selectedYatra?.id ?? ''}
              onChange={e => handleSelect(e.target.value)}
              className="flex-1 text-sm font-semibold text-base-content bg-transparent border-none outline-none cursor-pointer"
            >
              {yatras.map(y => (
                <option key={y.id} value={y.id}>{y.name}</option>
              ))}
            </select>
          ) : (
            <span className="flex-1 text-sm text-base-content/70">{t('yatras.noYet')}</span>
          )}

          {selectedYatra && (
            <Link
              to={`/yatra/${selectedYatra.id}/settings`}
              aria-label="Yatra settings"
              className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0"
              style={{ color: ACCENT, background: 'rgba(245,158,11,0.08)' }}
            >
              <FaCog className="w-3.5 h-3.5" />
            </Link>
          )}

          <button
            type="button"
            onClick={() => qc.invalidateQueries({ queryKey: ['yatra-data', selectedYatra?.id, dateStr] })}
            aria-label={t('yatras.refresh')}
            className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0"
            style={{ color: ACCENT, background: 'rgba(245,158,11,0.08)', border: 'none', cursor: 'pointer' }}
          >
            <LuRefreshCw className={`w-3.5 h-3.5 ${dataQuery.isFetching ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={handleCreate}
            aria-label="Create yatra"
            className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0"
            style={{ color: ACCENT, background: 'rgba(245,158,11,0.08)', border: 'none' }}
          >
            <FaPlus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Loading */}
        {(yatraListQuery.isLoading || dataQuery.isLoading) && (
          <div className="flex justify-center py-10"><Spinner /></div>
        )}

        {/* Empty state */}
        {!yatraListQuery.isLoading && yatras.length === 0 && (
          <div className="flex flex-col items-center py-16 gap-4">
            <div
              className="w-16 h-16 rounded-3xl flex items-center justify-center"
              style={{ background: 'rgba(245,158,11,0.08)' }}
            >
              <FaUsers className="w-7 h-7" style={{ color: ACCENT }} />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-base-content">{t('yatras.noYet')}</p>
              <p className="text-xs text-base-content/70 mt-1">{t('yatras.createCircle')}</p>
            </div>
            <button
              onClick={handleCreate}
              className="px-6 h-11 rounded-full text-sm font-semibold flex items-center gap-2 border-none cursor-pointer"
              style={{
                background: ACCENT_GRADIENT,
                color: 'white',
                boxShadow: '0 4px 20px rgba(245,158,11,0.35)',
              }}
            >
              {t('yatras.createButton')}
            </button>
          </div>
        )}

        {/* Color-zone legend */}
        {data && legendVisible && (
          <div className="flex items-center gap-2 px-1">
            {[
              { label: t('yatras.low'),  bg: 'rgba(220,38,38,0.15)',  text: '#dc2626' },
              { label: t('yatras.mid'),  bg: 'rgba(234,179,8,0.35)',  text: '#854d0e' },
              { label: t('yatras.high'), bg: 'rgba(22,163,74,0.35)',  text: '#166534' },
            ].map(z => (
              <span
                key={z.label}
                className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: z.bg, color: z.text }}
              >
                {z.label}
              </span>
            ))}
            <button
              onClick={dismissLegend}
              className="ml-auto w-5 h-5 flex items-center justify-center rounded-full text-base-content/70 hover:text-base-content/70"
              style={{ background: 'rgba(255,255,255,0.06)', border: 'none', cursor: 'pointer' }}
              aria-label="Dismiss legend"
            >
              <LuX className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Main data grid */}
        {data && !dataQuery.isLoading && (
          <div className="rounded-2xl overflow-hidden" style={glass}>
            <div className="overflow-x-auto">
              <table className="text-sm w-full" style={{ tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: '35%' }} />
                  {showStability && <col style={{ width: `${65 / (data.practices.length + 1)}%` }} />}
                  {data.practices.map(p => (
                    <col key={p.id} style={{ width: `${65 / (data.practices.length + (showStability ? 1 : 0))}%` }} />
                  ))}
                </colgroup>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'rgba(242,244,246,0.7)' }}>
                      Sadhaka
                    </th>
                    {showStability && (
                      <th className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide" style={{ color: 'rgba(242,244,246,0.7)' }}>
                        7d
                      </th>
                    )}
                    {data.practices.map(p => (
                      <th
                        key={p.id}
                        className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide"
                        style={{ color: 'rgba(242,244,246,0.7)' }}
                      >
                        <span className="block max-w-[80px] mx-auto truncate" title={p.practice}>
                          {p.practice}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.data.length === 0 && (
                    <tr>
                      <td
                        colSpan={data.practices.length + (showStability ? 2 : 1)}
                        className="px-4 py-10 text-center text-sm text-base-content/70"
                      >
                        {t('yatras.noEntries')}
                      </td>
                    </tr>
                  )}
                  {data.data.map((row, i) => (
                    <tr
                      key={row.user_id}
                      style={{ borderTop: i > 0 ? '1px solid rgba(255,255,255,0.06)' : undefined }}
                    >
                      <td className="px-4 py-3 font-semibold text-base-content whitespace-nowrap">
                        {row.user_name}
                      </td>
                      {showStability && (
                        <td
                          className="px-3 py-3 text-center font-bold text-base"
                          style={{ color: trendColor(row.trend_arrow) }}
                        >
                          {trendSymbol(row.trend_arrow)}
                        </td>
                      )}
                      {row.row.map((val, j) => (
                        <td
                          key={j}
                          className="px-3 py-3 text-center"
                          style={{
                            color: '#f2f4f6',
                            background: cellBackground(val, data.practices[j]?.colour_zones),
                          }}
                        >
                          {val !== undefined && val !== null ? formatValue(val) : (
                            <span style={{ color: 'rgba(255,255,255,0.20)' }}>—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Stability heatmap */}
        {data && showStability && heatmapDays.length > 0 && (
          <div className="rounded-2xl overflow-hidden" style={glass}>
            <div
              className="px-4 py-3"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}
            >
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'rgba(242,244,246,0.7)' }}>
                {t('yatras.stability')}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="text-xs" style={{ minWidth: 'max-content', width: '100%' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <th className="px-4 py-1.5 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'rgba(242,244,246,0.7)', width: '35%' }}>
                      {t('yatras.stability')}
                    </th>
                    {heatmapDays.map((day, i) => (
                      <th
                        key={i}
                        className="py-1.5 text-center text-[10px] font-medium"
                        style={{ color: 'rgba(242,244,246,0.7)' }}
                      >
                        {day}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((row, i) => (
                    <tr
                      key={row.user_id}
                      style={{ borderTop: i > 0 ? '1px solid rgba(255,255,255,0.06)' : undefined }}
                    >
                      <td className="px-4 py-2 font-semibold text-base-content whitespace-nowrap">
                        {row.user_name}
                      </td>
                      {heatmapScores(row).map((score, j) => (
                        <td
                          key={j}
                          className="px-2 py-2 text-center w-8"
                          style={{
                            background: heatmapBackground(score),
                            color: score > 0 ? '#f2f4f6' : '#d1d5db',
                            fontWeight: score > 0 ? 600 : 400,
                          }}
                        >
                          {score > 0 ? score : '·'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Statistics */}
        {data && data.statistics.length > 0 && (
          <div className="rounded-2xl px-4 py-4 flex flex-col gap-1" style={glass}>
            <span className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'rgba(242,244,246,0.7)' }}>
              {t('yatras.statistics')}
            </span>
            {data.statistics.map((stat, i) => (
              <div
                key={i}
                className="flex justify-between items-center py-1.5"
                style={{ borderTop: i > 0 ? '1px solid rgba(255,255,255,0.06)' : undefined }}
              >
                <span className="text-sm text-base-content/70">{stat.label}</span>
                <span className="text-sm font-bold text-base-content">
                  {stat.value !== null ? formatValue(stat.value) : '—'}
                </span>
              </div>
            ))}
          </div>
        )}

      </div>

      {/* FAB — Create yatra */}
      {!embedded && (
        <button
          onClick={handleCreate}
          aria-label="Create yatra"
          className="fixed sm:bottom-6 right-4 z-30 w-14 h-14 rounded-full hidden sm:flex items-center justify-center border-none cursor-pointer"
          style={{
            background: ACCENT_GRADIENT,
            boxShadow: '0 4px 24px rgba(245,158,11,0.45)',
          }}
        >
          <FaPlus className="w-5 h-5 text-white" />
        </button>
      )}

      {/* Create yatra modal */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)' }}
          onClick={() => {
            if (newName.trim().length > 0) {
              if (!window.confirm(t('yatras.discardName'))) return
            }
            setShowCreate(false)
            setNewName('')
          }}
        >
          <div
            className="w-full max-w-sm rounded-3xl p-6 flex flex-col gap-4"
            style={{
              background: 'rgba(255,255,255,0.06)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              boxShadow: '0 24px 48px rgba(0,0,0,0.18)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Icon + title */}
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: ACCENT_GRADIENT, boxShadow: '0 4px 12px rgba(245,158,11,0.30)' }}
              >
                <FaUsers className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-base font-bold font-serif text-base-content leading-tight">{t('yatras.newTitle')}</p>
                <p className="text-xs text-base-content/70">{t('yatras.newSubtitle')}</p>
              </div>
            </div>

            {/* Input */}
            <input
              autoFocus
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') submitCreate()
                if (e.key === 'Escape') {
                  if (newName.trim().length > 0) {
                    if (!window.confirm(t('yatras.discardName'))) return
                  }
                  setShowCreate(false)
                  setNewName('')
                }
              }}
              placeholder={t('yatras.namePlaceholder')}
              aria-label={t('yatras.namePlaceholder')}
              className="w-full rounded-2xl px-4 h-12 text-sm font-semibold text-base-content outline-none"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1.5px solid rgba(245,158,11,0.30)',
                color: '#f2f4f6',
              }}
            />

            {/* Buttons */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  if (newName.trim().length > 0) {
                    if (!window.confirm(t('yatras.discardName'))) return
                  }
                  setShowCreate(false)
                  setNewName('')
                }}
                className="flex-1 h-11 rounded-full text-sm font-semibold"
                style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.60)', border: 'none' }}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={submitCreate}
                disabled={!newName.trim() || createMutation.isPending}
                className="flex-1 h-11 rounded-full text-sm font-semibold flex items-center justify-center gap-2"
                style={{
                  background: ACCENT_GRADIENT,
                  color: 'white',
                  border: 'none',
                  opacity: !newName.trim() || createMutation.isPending ? 0.5 : 1,
                }}
              >
                {createMutation.isPending && <span className="loading loading-spinner loading-xs" />}
                {t('yatras.createButton')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
