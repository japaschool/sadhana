import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { yatrasApi } from '../../api/yatras'
import { TopBar } from '../../components/layout/TopBar'
import { Spinner } from '../../components/ui/Spinner'
import { ACCENT, ACCENT_GRADIENT, BORDER } from '../../theme/tokens'
import type {
  YatraPractice, PracticeDataType,
  ColourZonesConfig, ColourBound, ZoneColour, PracticeValue,
  DailyScoreConfig,
} from '../../types/api'

// ── Constants ─────────────────────────────────────────────────────────────────

const COLOUR_ZONE_TYPES: PracticeDataType[] = ['Int', 'Duration', 'Time']
const DAILY_SCORE_TYPES: PracticeDataType[] = ['Int', 'Duration', 'Time']
const ZONE_COLOURS: ZoneColour[] = ['Neutral', 'Red', 'Yellow', 'Green']

const ZONE_BG: Record<ZoneColour, string> = {
  Neutral:   'rgba(156,163,175,0.25)',
  MutedRed:  'rgba(220,38,38,0.12)',
  Red:       'rgba(220,38,38,0.32)',
  Yellow:    'rgba(234,179,8,0.35)',
  Green:     'rgba(22,163,74,0.30)',
  DarkGreen: 'rgba(15,118,55,0.45)',
}

const ZONE_T_KEY: Record<ZoneColour, string> = {
  Neutral:   'yatras.zoneNeutral',
  MutedRed:  'yatras.zoneMutedRed',
  Red:       'yatras.zoneRed',
  Yellow:    'yatras.zoneYellow',
  Green:     'yatras.zoneGreen',
  DarkGreen: 'yatras.zoneDarkGreen',
}

const glass: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: `1px solid ${BORDER}`,
  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
}

// ── Value helpers ──────────────────────────────────────────────────────────────

function toStr(val: PracticeValue | null, dt: PracticeDataType): string {
  if (!val) return ''
  if (dt === 'Int' && 'Int' in val) return String(val.Int)
  if (dt === 'Duration' && 'Duration' in val) {
    const min = val.Duration
    if (min < 60) return `${min}m`
    const h = Math.floor(min / 60), m = min % 60
    return m === 0 ? `${h}h` : `${h}h ${m}m`
  }
  if (dt === 'Time' && 'Time' in val) {
    const { h, m } = val.Time
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }
  return ''
}

function fromStr(s: string, dt: PracticeDataType): PracticeValue | null {
  const t = s.trim()
  if (!t) return null
  if (dt === 'Int') {
    const n = parseInt(t)
    return isNaN(n) ? null : { Int: n }
  }
  if (dt === 'Duration') {
    const m = t.match(/^(?:(\d+)h\s*)?(?:(\d+)m?)?$/)
    if (!m || (!m[1] && !m[2])) return null
    const total = parseInt(m[1] || '0') * 60 + parseInt(m[2] || '0')
    return total > 0 ? { Duration: total } : null
  }
  if (dt === 'Time') {
    const m = t.match(/^(\d{1,2}):(\d{2})$/)
    if (!m) return null
    return { Time: { h: parseInt(m[1]), m: parseInt(m[2]) } }
  }
  return null
}

// ── Preview cell generation ───────────────────────────────────────────────────

function midpoint(a: PracticeValue, b: PracticeValue): PracticeValue | null {
  if ('Int' in a && 'Int' in b) return { Int: Math.round((a.Int + b.Int) / 2) }
  if ('Duration' in a && 'Duration' in b) return { Duration: Math.round((a.Duration + b.Duration) / 2) }
  if ('Time' in a && 'Time' in b) {
    const mid = Math.round((a.Time.h * 60 + a.Time.m + b.Time.h * 60 + b.Time.m) / 2)
    return { Time: { h: Math.floor(mid / 60), m: mid % 60 } }
  }
  return null
}

function justAbove(v: PracticeValue): PracticeValue | null {
  if ('Int' in v) return { Int: v.Int + 1 }
  if ('Duration' in v) return { Duration: v.Duration + 1 }
  if ('Time' in v) {
    const t = v.Time.h * 60 + v.Time.m + 1
    return { Time: { h: Math.floor(t / 60), m: t % 60 } }
  }
  return null
}

function buildPreview(cfg: ColourZonesConfig, dt: PracticeDataType): Array<{ label: string; colour: ZoneColour }> {
  const concrete = cfg.bounds.filter(b => b.to !== null)
  if (concrete.length === 0) return []

  const first = concrete[0].to!
  let prev: PracticeValue = 'Int' in first ? { Int: 0 } : 'Duration' in first ? { Duration: 0 } : { Time: { h: 0, m: 1 } }

  const cells: Array<{ label: string; colour: ZoneColour }> = []
  for (const b of concrete) {
    const mid = midpoint(prev, b.to!)
    if (mid) cells.push({ label: toStr(mid, dt), colour: b.colour })
    prev = b.to!
  }

  const above = justAbove(prev)
  const finalColour: ZoneColour = cfg.best_colour ?? (cfg.better_direction === 'Higher' ? 'Green' : 'Red')
  if (above) cells.push({ label: toStr(above, dt), colour: finalColour })

  return cells
}

// ── Default bounds for zone count ─────────────────────────────────────────────

function makeBounds(count: number): ColourBound[] {
  if (count === 3) return [{ to: null, colour: 'Red' }, { to: null, colour: 'Yellow' }]
  if (count === 2) return [{ to: null, colour: 'Red' }]
  return []
}

// ── Input placeholder by type ─────────────────────────────────────────────────

function placeholder(dt: PracticeDataType): string {
  if (dt === 'Int') return 'e.g. 10'
  if (dt === 'Duration') return 'e.g. 30m or 1h'
  if (dt === 'Time') return 'HH:MM'
  return ''
}

// ── Component ─────────────────────────────────────────────────────────────────

export function YatraPracticeEditPage() {
  const { t } = useTranslation()
  const { id: yatraId, practice_id } = useParams<{ id: string; practice_id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [name, setName] = useState('')
  const [zones, setZones] = useState<ColourZonesConfig>({
    better_direction: 'Higher',
    bounds: [],
    no_value_colour: 'Neutral',
  })
  const [dailyScore, setDailyScore] = useState<DailyScoreConfig>({
    better_direction: 'Higher',
    mandatory_threshold: null,
    bonus_rules: [],
  })

  // ── Load ──────────────────────────────────────────────────────────────────

  const practiceQuery = useQuery({
    queryKey: ['yatra-practice', yatraId, practice_id],
    queryFn: () => yatrasApi.getYatraPractice(yatraId!, practice_id!),
  })

  useEffect(() => {
    const p = practiceQuery.data
    if (!p) return
    setName(p.practice)
    if (p.colour_zones) {
      setZones(p.colour_zones)
    }
    if (p.daily_score_config) setDailyScore(p.daily_score_config)
  }, [practiceQuery.data])

  // ── Save ──────────────────────────────────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: () => {
      const p: YatraPractice = {
        ...practiceQuery.data!,
        practice: name,
        colour_zones: zones.bounds.length > 0 ? zones : null,
        daily_score_config: (dailyScore.mandatory_threshold !== null || dailyScore.bonus_rules.length > 0) ? dailyScore : null,
      }
      return yatrasApi.updateYatraPractice(yatraId!, p)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['yatra-practices', yatraId] })
      navigate(`/yatra/${yatraId}/admin/settings`)
    },
  })

  // ── Derived ───────────────────────────────────────────────────────────────

  const p = practiceQuery.data
  const dt = p?.data_type ?? 'Int'
  const supportsZones = COLOUR_ZONE_TYPES.includes(dt)
  const zonesEnabled = zones.bounds.length > 0
  const numZones = zones.bounds.length + 1  // bounds = n-1 dividers
  const preview = zonesEnabled ? buildPreview(zones, dt) : []
  const bonusThreshold = dailyScore.bonus_rules[0]?.threshold ?? null

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleZoneCount(value: string) {
    const count = parseInt(value)
    const bounds = makeBounds(count)
    if (count > 0) {
      bounds[0].colour = zones.better_direction === 'Higher' ? 'Red' : 'Green'
    }
    setZones(prev => ({ ...prev, bounds }))
  }

  function handleBetterDirection(dir: string) {
    setZones(prev => {
      const updated = { ...prev, better_direction: dir as 'Higher' | 'Lower' }
      if (updated.bounds.length > 0) {
        updated.bounds = updated.bounds.map((b, i) =>
          i === 0 ? { ...b, colour: dir === 'Higher' ? 'Red' : 'Green' } : b
        )
      }
      return updated
    })
  }

  function handleBoundValue(idx: number, raw: string) {
    setZones(prev => {
      const bounds = prev.bounds.map((b, i) =>
        i === idx ? { ...b, to: fromStr(raw, dt) } : b
      )
      return { ...prev, bounds }
    })
  }

  function handleDailyScoreMandatory(raw: string) {
    setDailyScore(prev => ({ ...prev, mandatory_threshold: fromStr(raw, dt) }))
  }

  function handleDailyScoreBonus(raw: string) {
    const v = fromStr(raw, dt)
    setDailyScore(prev => ({
      ...prev,
      bonus_rules: v ? [{ threshold: v, points: 1 }] : [],
    }))
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (practiceQuery.isLoading) return (
    <>
      <TopBar showClose title={t('practice.edit')} />
      <div className="flex justify-center pt-20"><Spinner /></div>
    </>
  )

  return (
    <>
      <TopBar showClose title={p?.practice ?? t('practice.edit')} />

      <form
        onSubmit={e => { e.preventDefault(); saveMutation.mutate() }}
        className="px-4 py-4 pb-28 sm:pb-8 max-w-lg sm:max-w-2xl mx-auto flex flex-col gap-3"
      >

        {/* Name */}
        <div className="rounded-2xl px-4 py-3.5" style={glass}>
          <label htmlFor="practice-name" className="text-xs text-base-content/70 block mb-1">{t('practice.name')}</label>
          <input
            id="practice-name"
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            className="w-full text-sm font-semibold text-base-content bg-transparent outline-none"
            placeholder={t('practice.name')}
          />
        </div>

        {/* Data type (read-only) */}
        <div className="rounded-2xl px-4 py-3.5" style={glass}>
          <label className="text-xs text-base-content/70 block mb-1">{t('practice.type')}</label>
          <p className="text-sm font-semibold text-base-content">{t(`practice.type${dt}`)}</p>
        </div>

        {/* Colour zones section */}
        {supportsZones && (
          <div className="rounded-2xl overflow-hidden" style={glass}>
            {/* Header */}
            <div className="px-4 py-3 border-b border-white/[0.06]">
              <p className="text-xs font-semibold uppercase tracking-widest text-base-content/70">{t('yatras.colourZones')}</p>
              <p className="text-xs text-base-content/70 mt-0.5">{t('yatras.colourZonesDesc')}</p>
            </div>

            <div className="px-4 py-3 flex flex-col gap-3">

              {/* Number of zones */}
              <div>
                <label htmlFor="zone-count" className="text-xs text-base-content/70 block mb-1">{t('yatras.numZones')}</label>
                <select
                  id="zone-count"
                  value={zonesEnabled ? numZones : 0}
                  onChange={e => handleZoneCount(e.target.value)}
                  className="w-full text-sm text-base-content rounded-xl px-3 h-10 outline-none cursor-pointer"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1.5px solid rgba(255,255,255,0.10)' }}
                >
                  <option value={0}>{t('yatras.zonesDisabled')}</option>
                  <option value={2}>{t('yatras.zones2')}</option>
                  <option value={3}>{t('yatras.zones3')}</option>
                </select>
              </div>

              {zonesEnabled && (
                <>
                  {/* Better direction */}
                  <div>
                    <label htmlFor="better-direction" className="text-xs text-base-content/70 block mb-1">{t('yatras.betterWhen')}</label>
                    <select
                      id="better-direction"
                      value={zones.better_direction}
                      onChange={e => handleBetterDirection(e.target.value)}
                      className="w-full text-sm text-base-content rounded-xl px-3 h-10 outline-none cursor-pointer"
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1.5px solid rgba(255,255,255,0.10)' }}
                    >
                      <option value="Higher">{t('yatras.higherBetter')}</option>
                      <option value="Lower">{t('yatras.lowerBetter')}</option>
                    </select>
                  </div>

                  {/* Bound inputs */}
                  {zones.bounds.map((bound, idx) => (
                    <div key={idx}>
                      <label htmlFor={`zone-bound-${idx}`} className="text-xs block mb-1" style={{ color: ACCENT }}>
                        {t('yatras.upTo', { colour: t(ZONE_T_KEY[bound.colour]) })}
                      </label>
                      <input
                        id={`zone-bound-${idx}`}
                        type={dt === 'Int' ? 'number' : 'text'}
                        value={toStr(bound.to, dt)}
                        onChange={e => handleBoundValue(idx, e.target.value)}
                        placeholder={placeholder(dt)}
                        className="w-full text-sm text-base-content rounded-xl px-3 h-10 outline-none"
                        style={{
                          background: ZONE_BG[bound.colour],
                          border: `1.5px solid ${ZONE_BG[bound.colour]}`,
                        }}
                        min={dt === 'Int' ? 0 : undefined}
                      />
                    </div>
                  ))}

                  {/* No value colour */}
                  <div>
                    <label htmlFor="no-value-colour" className="text-xs text-base-content/70 block mb-1">{t('yatras.whenNoValue')}</label>
                    <select
                      id="no-value-colour"
                      value={zones.no_value_colour}
                      onChange={e => setZones(prev => ({ ...prev, no_value_colour: e.target.value as ZoneColour }))}
                      className="w-full text-sm text-base-content rounded-xl px-3 h-10 outline-none cursor-pointer"
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1.5px solid rgba(255,255,255,0.10)' }}
                    >
                      {ZONE_COLOURS.map(zc => (
                        <option key={zc} value={zc}>{t(ZONE_T_KEY[zc])}</option>
                      ))}
                    </select>
                  </div>

                  {/* Preview */}
                  {preview.length > 0 && (
                    <div>
                      <label className="text-xs text-base-content/70 block mb-1.5">{t('yatras.zonePreview')}</label>
                      <div className="flex gap-1.5">
                        {preview.map((cell, i) => (
                          <div
                            key={i}
                            className="flex-1 rounded-xl py-2 text-center text-xs font-semibold text-white"
                            style={{ background: ZONE_BG[cell.colour] }}
                          >
                            {cell.label}
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-base-content/70 mt-1">{t('yatras.sampleValues')}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Daily Score section */}
        {DAILY_SCORE_TYPES.includes(dt) && (
          <div className="rounded-2xl overflow-hidden" style={glass}>
            <div className="px-4 py-3 border-b border-white/[0.06]">
              <p className="text-xs font-semibold uppercase tracking-widest text-base-content/70">{t('yatras.dailyScore')}</p>
              <p className="text-xs text-base-content/70 mt-0.5">{t('yatras.dailyScoreDesc')}</p>
            </div>
            <div className="px-4 py-3 flex flex-col gap-3">

              {/* Better direction */}
              <div>
                <label htmlFor="ds-better" className="text-xs text-base-content/70 block mb-1">{t('yatras.betterWhen')}</label>
                <select
                  id="ds-better"
                  value={dailyScore.better_direction}
                  onChange={e => setDailyScore(prev => ({ ...prev, better_direction: e.target.value as 'Higher' | 'Lower' }))}
                  className="w-full text-sm text-base-content rounded-xl px-3 h-10 outline-none cursor-pointer"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1.5px solid rgba(255,255,255,0.10)' }}
                >
                  <option value="Higher">{t('yatras.higherBetter')}</option>
                  <option value="Lower">{t('yatras.lowerBetter')}</option>
                </select>
              </div>

              {/* Mandatory threshold */}
              <div>
                <label htmlFor="ds-mandatory" className="text-xs text-base-content/70 block mb-1">{t('yatras.mandatoryValue')}</label>
                <input
                  id="ds-mandatory"
                  type={dt === 'Int' ? 'number' : 'text'}
                  inputMode="numeric"
                  value={toStr(dailyScore.mandatory_threshold, dt)}
                  onChange={e => handleDailyScoreMandatory(e.target.value)}
                  placeholder={placeholder(dt)}
                  className="w-full text-sm text-base-content rounded-xl px-3 h-10 outline-none"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1.5px solid rgba(255,255,255,0.10)' }}
                  min={dt === 'Int' ? 0 : undefined}
                />
                <p className="text-xs text-base-content/70 mt-1">{t('yatras.mandatoryDesc')}</p>
              </div>

              {/* Bonus threshold */}
              <div>
                <label htmlFor="ds-bonus" className="text-xs text-base-content/70 block mb-1">{t('yatras.bonusValue')}</label>
                <input
                  id="ds-bonus"
                  type={dt === 'Int' ? 'number' : 'text'}
                  inputMode="numeric"
                  value={toStr(bonusThreshold, dt)}
                  onChange={e => handleDailyScoreBonus(e.target.value)}
                  placeholder={placeholder(dt)}
                  className="w-full text-sm text-base-content rounded-xl px-3 h-10 outline-none"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1.5px solid rgba(255,255,255,0.10)' }}
                  min={dt === 'Int' ? 0 : undefined}
                />
                <p className="text-xs text-base-content/70 mt-1">{t('yatras.bonusDesc')}</p>
              </div>

            </div>
          </div>
        )}

        {/* Save */}
        <button
          type="submit"
          disabled={saveMutation.isPending || !name.trim()}
          className="w-full h-12 rounded-full text-sm font-semibold flex items-center justify-center gap-2"
          style={{
            background: ACCENT_GRADIENT,
            color: 'white',
            border: 'none',
            boxShadow: '0 4px 20px rgba(245,158,11,0.35)',
            opacity: saveMutation.isPending ? 0.7 : 1,
          }}
        >
          {saveMutation.isPending && <span className="loading loading-spinner loading-xs" />}
          {t('common.save')}
        </button>

        {saveMutation.isError && (
          <p className="text-sm text-red-600 text-center">
            {(saveMutation.error as Error)?.message ?? t('common.failedSave')}
          </p>
        )}
      </form>
    </>
  )
}
