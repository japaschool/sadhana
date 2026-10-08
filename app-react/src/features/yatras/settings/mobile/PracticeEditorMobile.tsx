import { useState } from 'react'
import type { ReactNode } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import type { BetterDirection, PracticeValue, YatraPractice, ZoneColour } from '../../../../types/api'
import { SegmentedControl } from '../../../../ui/primitives/SegmentedControl'
import { typeTime } from '../../../today/values'
import { ZONE_BG } from '../../yatrasLogic'
import { useDebouncedCommit } from '../useDebouncedCommit'
import { useYatraAdmin } from '../useYatraAdmin'
import type { FieldError, ScoredType } from '../zones'
import {
  aboveColour, barGeometry, bonusOf, checkBounds, checkScore, formatValue, greenStart, isScored, paletteZones, parseValue, scoreConfig, zoneCount, zoneSamples,
} from '../zones'
import { AdminPage, BTN, CARD, FIELD, HINT, SECTION_TITLE } from './AdminPage'
import { AutosaveText } from './fields'
import { DeletePracticeSheet } from './PracticeSheets'
import { RangeBar } from './RangeBar'
import { practiceNameError, zoneKey } from './summaries'
import { TypeChip } from './TypeChip'

const EMPTY_COLOURS: ZoneColour[] = ['Neutral', 'Red', 'Yellow', 'Green']
const PLACEHOLDER: Record<ScoredType, string> = { Int: '', Duration: '90', Time: 'HH:MM' }
const LABEL = 'text-[13px] font-bold text-ui-muted'

export function PracticeEditorMobile() {
  const { t } = useTranslation()
  const { id = '', practice_id = '' } = useParams()
  const navigate = useNavigate()
  const a = useYatraAdmin(id)
  const [deleting, setDeleting] = useState(false)
  const p = a.practices.find((x) => x.id === practice_id)
  const back = `/yatra/${id}/admin/practices`
  return (
    <AdminPage admin={a} title={p?.practice ?? ''} back={{ to: back, label: t('yatraSettings.practices') }}>
      {() => !p ? <Navigate to={back} replace /> : (
        <>
          <section className={`${CARD} flex flex-col gap-4 p-4`}>
            <AutosaveText id="practice-name" label={t('yatraSettings.name')} value={p.practice}
              validate={(v) => practiceNameError(t, v, a.practices.filter((x) => x.id !== p.id))}
              onCommit={(v) => a.savePractice({ ...p, practice: v.trim() }, t('yatraSettings.renamed'))} />
            <div className="flex flex-col gap-1.5">
              <span className={LABEL}>{t('yatraSettings.type')}</span>
              <div className="flex flex-wrap items-center gap-2">
                <TypeChip type={p.data_type} />
                <span className={HINT}>{t('yatraSettings.typeSet')}</span>
              </div>
            </div>
          </section>
          {isScored(p.data_type) ? (
            <>
              <ColoursAndScore p={p} dt={p.data_type} save={(next) => a.savePractice(next, t('common.saved'))} />
              <p className="flex items-center gap-1.5 px-1.5 text-xs font-semibold text-ui-muted">
                <span className="h-[7px] w-[7px] rounded-full bg-ui-good" />{t('yatraSettings.savedAsYouEdit')}
              </p>
            </>
          ) : (
            <section className={`${CARD} flex flex-col gap-1.5 p-4`}>
              <h2 className={SECTION_TITLE}>{t('yatraSettings.noZonesTitle')}</h2>
              <p className={HINT}>{t(p.data_type === 'Bool' ? 'yatraSettings.noZonesBool' : 'yatraSettings.noZonesText')}</p>
            </section>
          )}
          <button type="button" onClick={() => setDeleting(true)} className={`${BTN} border border-ui-control bg-ui-surface text-ui-danger`}>
            {t('yatraSettings.deletePractice')}
          </button>
          {deleting && (
            <DeletePracticeSheet practice={p} statCount={a.statCount(p.id)} busy={a.deletePractice.isPending} onClose={() => setDeleting(false)}
              onConfirm={() => a.deletePractice.mutate(p, { onSuccess: () => navigate(back, { replace: true }), onSettled: () => setDeleting(false) })} />
          )}
        </>
      )}
    </AdminPage>
  )
}

interface Drafts { bounds: string[]; done: string; bonus: string }

/** As typed in the field, like the Log: durations in plain minutes, times as hh:mm. */
const editText = (v: PracticeValue | null | undefined, dt: ScoredType) =>
  dt === 'Duration' ? (v && 'Duration' in v ? String(v.Duration) : '') : formatValue(v, dt)

const draftsOf = (p: YatraPractice, dt: ScoredType): Drafts => ({
  bounds: (p.colour_zones?.bounds ?? []).map((b) => editText(b.to, dt)),
  done: editText(p.daily_score?.mandatory_threshold, dt),
  bonus: editText(bonusOf(p.daily_score), dt),
})

/** A missing field and null are the same config. */
const sameConfig = (x: YatraPractice, y: YatraPractice) =>
  JSON.stringify([x.colour_zones ?? null, x.daily_score ?? null]) === JSON.stringify([y.colour_zones ?? null, y.daily_score ?? null])

function errorText(e: FieldError, dt: ScoredType, t: TFunction): string {
  if (e.kind === 'format') return t(`yatraSettings.format${dt}`)
  if (e.kind === 'needsDone') return t('yatraSettings.bonusNeedsDone')
  if (e.kind === 'order') return t('yatraSettings.mustBeAbove', { value: formatValue(e.than, dt), colour: t(zoneKey(e.colour)) })
  return t(e.dir === 'Higher' ? 'yatraSettings.bonusAtLeast' : 'yatraSettings.bonusAtMost', { value: formatValue(e.done, dt) })
}

function ColoursAndScore({ p, dt, save }: { p: YatraPractice; dt: ScoredType; save: (next: YatraPractice) => void }) {
  const { t } = useTranslation()
  const count = zoneCount(p.colour_zones)
  const zones = count ? p.colour_zones! : null
  const score = p.daily_score ?? null
  const [dirChoice, setDirChoice] = useState<BetterDirection | null>(null)
  const scoreDir = score?.better_direction ?? dirChoice ?? zones?.better_direction ?? 'Higher'
  const follows = !!zones && scoreDir === zones.better_direction

  const [drafts, setDrafts] = useState(() => draftsOf(p, dt))
  const [editing, setEditing] = useState(false)
  // Errors wait for a pause in typing (or leaving the field), so they aren't announced on every keystroke.
  const [settled, setSettled] = useState(true)
  const [seen, setSeen] = useState(p)
  // Follow saves, Undo and refetches, but never rewrite the field being typed in.
  if (p !== seen) {
    setSeen(p)
    if (!editing) setDrafts(draftsOf(p, dt))
    // A new colour count brings new bound fields, even while one keeps focus.
    else if (drafts.bounds.length !== (p.colour_zones?.bounds.length ?? 0)) setDrafts((d) => ({ ...d, bounds: draftsOf(p, dt).bounds }))
  }

  const bounds = checkBounds(drafts.bounds, zones?.bounds.map((b) => b.colour) ?? [], dt)
  const thresholds = checkScore(drafts.done, drafts.bonus, scoreDir, dt)

  /** The saved practice with every valid draft applied; invalid drafts keep what's saved. */
  const fromDrafts = (): YatraPractice => ({
    ...p,
    colour_zones: zones && bounds.ok ? { ...zones, bounds: zones.bounds.map((b, i) => ({ ...b, to: bounds.values[i] })) } : p.colour_zones,
    daily_score: thresholds.ok ? scoreConfig(scoreDir, thresholds.values[0], thresholds.values[1]) : p.daily_score,
  })
  const { schedule, flush } = useDebouncedCommit(() => {
    setSettled(true)
    const next = fromDrafts()
    if (!sameConfig(next, p)) save(next)
  })
  // Immediate changes build on the drafts too; the pending debounced commit then finds nothing new.
  const saveNow = (change: (base: YatraPractice) => YatraPractice) => save(change(fromDrafts()))

  const setCount = (c: string) => saveNow((b) => ({
    ...b, colour_zones: c === '0' ? null : paletteZones(Number(c) as 2 | 3, b.colour_zones?.better_direction ?? scoreDir, b.colour_zones),
  }))
  const setZoneDir = (d: BetterDirection) => saveNow((b) => {
    const sc = b.daily_score
    // The score follows the colours unless its thresholds would then be the wrong way round.
    const move = follows && sc && checkScore(formatValue(sc.mandatory_threshold, dt), formatValue(bonusOf(sc), dt), d, dt).ok
    return { ...b, colour_zones: paletteZones(count as 2 | 3, d, b.colour_zones), daily_score: move ? { ...sc, better_direction: d } : sc }
  })
  const setEmpty = (c: ZoneColour) => saveNow((b) => ({ ...b, colour_zones: { ...b.colour_zones!, no_value_colour: c } }))
  function setScoreDir(choice: string) {
    const d = (choice === 'same' ? zones!.better_direction : choice) as BetterDirection
    if (score) saveNow((b) => ({ ...b, daily_score: b.daily_score ? { ...b.daily_score, better_direction: d } : b.daily_score }))
    else setDirChoice(d)
  }
  const green = zones && follows ? greenStart(zones, dt) : null
  function doneAtGreen() {
    const text = editText(green, dt)
    setDrafts((d) => ({ ...d, done: text }))
    // Past the bonus, it stays a draft and the bonus field says why.
    if (checkScore(text, drafts.bonus, scoreDir, dt).ok) saveNow((b) => ({ ...b, daily_score: scoreConfig(scoreDir, green, bonusOf(b.daily_score)) }))
  }

  const tidy = (text: string) => {
    const v = parseValue(text, dt)
    return v && v !== 'invalid' ? editText(v, dt) : text
  }
  const field = (key: 'done' | 'bonus' | number) => ({
    value: typeof key === 'number' ? drafts.bounds[key] ?? '' : drafts[key],
    onFocus: () => setEditing(true),
    onBlur: () => {
      setEditing(false)
      // Show what was typed the way it's stored, e.g. a half-typed 05 → 05:00.
      setDrafts((d) => (typeof key === 'number' ? { ...d, bounds: d.bounds.map((x, j) => (j === key ? tidy(x) : x)) } : { ...d, [key]: tidy(d[key]) }))
      flush()
      setSettled(true)
    },
    onChange: (v: string) => {
      setSettled(false)
      setDrafts((d) => (typeof key === 'number' ? { ...d, bounds: d.bounds.map((x, j) => (j === key ? v : x)) } : { ...d, [key]: v }))
      schedule()
    },
  })

  const bar = barGeometry(p.colour_zones, p.daily_score, dt)
  const lastBound = zones && [...zones.bounds].reverse().find((b) => b.to)
  const op = scoreDir === 'Higher' ? '≥' : '≤'
  const savedDone = formatValue(score?.mandatory_threshold, dt)
  const savedBonus = formatValue(bonusOf(score), dt)
  const summary = savedDone && savedBonus ? t('yatraSettings.scoreDoneBonus', { op, done: savedDone, bonus: savedBonus })
    : savedDone ? t('yatraSettings.scoreDone', { op, done: savedDone })
    : savedBonus ? t('yatraSettings.scoreBonus', { op, bonus: savedBonus })
    : t('yatraSettings.scoreNone')
  const dirOptions = [{ value: 'Higher', label: t('yatraSettings.higher') }, { value: 'Lower', label: t('yatraSettings.lower') }]

  return (
    <>
      <section className={`${CARD} flex flex-col gap-4 p-4`}>
        <div className="flex flex-col gap-0.5">
          <h2 className={SECTION_TITLE}>{t('yatraSettings.coloursTitle')}</h2>
          <p className={HINT}>{t('yatraSettings.coloursHint')}</p>
        </div>
        <SegmentedControl label={t('yatraSettings.colours')} value={String(count)} onChange={setCount} options={[
          { value: '0', label: t('yatraSettings.coloursOff') },
          { value: '2', label: t('yatraSettings.colours2') },
          { value: '3', label: t('yatraSettings.colours3') },
        ]} />
        {zones && (
          <>
            <Row label={t('yatraSettings.betterWhen')}>
              <SegmentedControl label={t('yatraSettings.betterWhen')} value={zones.better_direction} options={dirOptions}
                onChange={(d) => setZoneDir(d as BetterDirection)} />
            </Row>
            <RangeBar bar={bar} dt={dt} />
            <div className="grid grid-cols-2 gap-2.5">
              {zones.bounds.map((b, i) => (
                <ValueField key={i} id={`bound-${i}`} dt={dt} {...field(i)} error={settled && bounds.errors[i] && errorText(bounds.errors[i]!, dt, t)}
                  label={<><Swatch colour={b.colour} />{t('yatraSettings.upTo', { colour: t(zoneKey(b.colour)) })}</>} />
              ))}
            </div>
            {lastBound && (
              <p className="text-sm font-semibold text-ui-ink2">
                {t('yatraSettings.aboveBest', { value: formatValue(lastBound.to, dt), colour: t(zoneKey(aboveColour(zones))) })}
              </p>
            )}
            {settled && !bounds.ok && <p className="text-xs font-semibold text-ui-danger">{t('yatraSettings.notSavedYet')}</p>}
            <div className="flex flex-col gap-2">
              <span className={LABEL}>{t('yatraSettings.emptyCell')}</span>
              <div className="overflow-x-auto">
                <SegmentedControl label={t('yatraSettings.emptyCell')} value={zones.no_value_colour} onChange={(c) => setEmpty(c as ZoneColour)}
                  options={EMPTY_COLOURS.map((c) => ({ value: c, label: t(zoneKey(c)) }))} />
              </div>
            </div>
            {bar && bar.segments.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className={LABEL}>{t('yatraSettings.inTable')}</span>
                <div className="flex gap-1.5">
                  {[...zoneSamples(bar, zones, dt).map((s) => ({ text: formatValue(s.value, dt), colour: s.colour })),
                    { text: t('yatraSettings.emptySample'), colour: zones.no_value_colour }].map((c, i) => (
                    <span key={i} className={`flex h-10 min-w-0 flex-1 items-center justify-center rounded-[10px] font-ui-mono text-[13px] font-semibold text-ui-ink ${ZONE_BG[c.colour] || 'bg-ui-chip'}`}>
                      {c.text}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </section>

      <section className={`${CARD} flex flex-col gap-4 p-4`}>
        <div className="flex flex-col gap-0.5">
          <h2 className={SECTION_TITLE}>{t('yatraSettings.scoreTitle')}</h2>
          <p className={HINT}>{t('yatraSettings.scoreHint')}</p>
        </div>
        {!zones && <RangeBar bar={bar} dt={dt} />}
        <p className="text-sm font-semibold text-ui-ink2">{summary}</p>
        <Row label={t('yatraSettings.betterWhen')}>
          <SegmentedControl label={t('yatraSettings.scoreBetterWhen')} value={follows ? 'same' : scoreDir} onChange={setScoreDir}
            options={zones ? [{ value: 'same', label: t('yatraSettings.sameAsColours') }, ...dirOptions] : dirOptions} />
        </Row>
        <div className="grid grid-cols-2 gap-2.5">
          <ValueField id="score-done" dt={dt} label={t('yatraSettings.doneAt')} {...field('done')}
            error={settled && thresholds.errors[0] && errorText(thresholds.errors[0]!, dt, t)} />
          <ValueField id="score-bonus" dt={dt} label={t('yatraSettings.bonusAt')} {...field('bonus')}
            error={settled && thresholds.errors[1] && errorText(thresholds.errors[1]!, dt, t)} />
        </div>
        {green && editText(green, dt) !== drafts.done && (
          <button type="button" onClick={doneAtGreen} className="self-start rounded-full bg-ui-accent-soft px-3 py-1.5 text-[13px] font-bold text-ui-accent">
            {t('yatraSettings.doneWhereGreen', { colour: t(zoneKey('Green')) })}
          </button>
        )}
        <p className={HINT}>{t('yatraSettings.bonusNote')}</p>
      </section>
    </>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-2.5 gap-y-2">
      <span className="text-sm font-bold text-ui-ink">{label}</span>
      {children}
    </div>
  )
}

function Swatch({ colour }: { colour: ZoneColour }) {
  return <span aria-hidden className={`h-3 w-3 shrink-0 rounded ${ZONE_BG[colour] || 'bg-ui-chip'}`} />
}

function ValueField({ id, label, dt, value, error, onChange, onFocus, onBlur }: {
  id: string; label: ReactNode; dt: ScoredType; value: string; error?: string | null | false
  onChange: (v: string) => void; onFocus: () => void; onBlur: () => void
}) {
  const [focused, setFocused] = useState(false)
  // Like the Log: a duration is typed in plain minutes, and reads "90 min" at rest.
  const shown = dt === 'Duration' && !focused && /^\d+$/.test(value) ? formatValue({ Duration: Number(value) }, dt) : value
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="flex items-center gap-1.5 text-xs font-bold leading-[1.35] text-ui-muted">{label}</label>
      <input id={id} value={shown} inputMode="numeric" autoComplete="off" placeholder={PLACEHOLDER[dt]} aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`${FIELD} font-ui-mono`}
        onFocus={() => { setFocused(true); onFocus() }}
        onBlur={() => { setFocused(false); onBlur() }}
        onChange={(e) => onChange(dt === 'Time' ? typeTime(e.target.value, value) : e.target.value.replace(/\D/g, ''))} />
      {error && <p id={`${id}-error`} role="alert" className="text-xs font-semibold text-ui-danger">{error}</p>}
    </div>
  )
}
