import type { TFunction } from 'i18next'
import type { PanelsReport, ReportDataEntry, Stat } from '../../api/charts'
import type { PracticeDataType, UserPractice } from '../../types/api'
import { addDays, fromDateStr, toDateStr } from '../today/date'
import { formatDuration } from '../today/values'
import { gapEvents, gapFigures } from '../insights/panels/gapLogic'
import { makeLookup, monthCounts, statResult, windowDays } from '../insights/panels/panelLogic'
import { daysPanels, durationPanels, gapsPanels, goalsPanels, japaPanels, sleepPanels } from '../insights/panels/templates'
import type { Choices, GuideGoal, GuideKind } from './guideLogic'

/** Same numbers every run (mulberry32), so tests and screenshots agree. */
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const SLEEP_DAYS = 30
const COUNT_DAYS = 28
const GOAL = 90
const TARGET = 20

type Night = { bed: number; wake: number; nap: number }
/** A month of nights, believable and uneven: four missing, one short, one long, one late. */
function nights(): (Night | null)[] {
  const R = rng(11)
  const miss = new Set([5, 13, 14, 24])
  return Array.from({ length: SLEEP_DAYS }, (_, i) => {
    if (miss.has(i)) { R(); R(); R(); return null }
    let bed = 21.8 + R() * 1.5
    let wake = 4.3 + R() * 1.5
    const nap = R() < 0.25 ? 0.35 + R() * 0.5 : 0
    if (i === 9) { bed = 23.8; wake = 4.6 }
    if (i === 17) { bed = 21.9; wake = 7.4 }
    if (i === 21) { bed = 23.4; wake = 4.4 }
    return { bed, wake, nap }
  })
}

type Count = { v: number; e: number }
function counts(): (Count | null)[] {
  const R = rng(5)
  const miss = new Set([3, 11, 12, 22])
  return Array.from({ length: COUNT_DAYS }, (_, i) => {
    let v = Math.round(11 + R() * 9)
    let e = Math.round(v * (0.5 + R() * 0.35))
    if (miss.has(i)) return null
    if (i === 7) { v = 6; e = 6 }
    if (i === 17) { v = 24; e = 16 }
    return { v: Math.round(v * 1.25), e: Math.round(Math.min(e, v) * 1.25) }
  })
}

function durations(): ([number, number, number] | null)[] {
  const R = rng(3)
  const miss = new Set([6, 15, 16])
  return Array.from({ length: COUNT_DAYS }, (_, i) => {
    if (miss.has(i)) return null
    return [Math.round(20 + R() * 45), R() < 0.8 ? Math.round(10 + R() * 25) : 0, R() < 0.45 ? Math.round(20 + R() * 35) : 0]
  })
}

/** Share of days done, a month-plus of each. */
const DONE_RATES = [0.65, 0.45, 0.1]

const GAP_DAYS = 90
/** An event every 4 to 11 days, and what's counted dips that day and the next. */
function gapDays(): { event: boolean[]; count: (number | null)[] } {
  const R = rng(21)
  const event = Array.from({ length: GAP_DAYS }, () => false)
  for (let i = 2 + Math.floor(R() * 4); i < GAP_DAYS; i += 4 + Math.floor(R() * 8)) event[i] = true
  const count = event.map((_, i) => (R() < 0.08 ? null : Math.round((event[i] || event[i - 1] ? 6 : 14) + R() * 8)))
  return { event, count }
}

/** A year, so a monthly goal has its 12 squares too. */
const GOAL_DAYS = 366
const EXAMPLE_GOALS = (t: TFunction): GuideGoal[] => [
  { name: t('guide.suggest.days5'), type: 'Bool', direction: 'AtLeast', amount: 4, period: 'Week', counts: 'Total' },
  { name: t('guide.suggest.time1'), type: 'Duration', direction: 'AtLeast', amount: 180, period: 'Week', counts: 'Total' },
]
/** Believable values of a practice's type: most days logged, some not. */
function goalValues(type: PracticeDataType, j: number): unknown[] {
  const R = rng(60 + j)
  return Array.from({ length: GOAL_DAYS }, () => {
    if (R() > 0.62) return null
    if (type === 'Bool') return { Bool: true }
    if (type === 'Int') return { Int: Math.round(5 + R() * 20) }
    return { Duration: Math.round(15 + R() * 45) }
  })
}

const time = (h: number) => { const m = Math.round(h * 60); return { Time: { h: Math.floor(m / 60) % 24, m: m % 60 } } }

type Row = { practice: UserPractice; values: unknown[] }
const P = (id: string, practice: string, data_type: PracticeDataType): UserPractice => ({ id: `example-${id}`, practice, data_type, is_active: true })

/** Every day of the window gets an entry per practice, null where nothing was logged, so a gap is drawn as a gap. */
function entriesOf(today: string, days: number, rows: Row[]): ReportDataEntry[] {
  const cobs = Array.from({ length: days }, (_, i) => toDateStr(addDays(fromDateStr(today), i - days + 1)))
  return rows.flatMap((r) => cobs.map((cob_date, i) => ({ cob_date, practice: r.practice.practice, value: r.values[i] ?? null })))
}

/** The example with a person's choices applied: their names, target, goal and aim. Blank names keep the example's. */
export type Applied = NonNullable<Choices[GuideKind]>

const named = (name: string | null | undefined, fallback: string) => name?.trim() || fallback
const unique = (names: string[]) => [...new Set(names.map((n) => n.trim()).filter(Boolean))]

/**
 * A fixed example definition with its own data, built by the real report builders so it can't drift from them.
 * Nothing here is requested or saved: it works before anything exists. `applied` swaps in the choices made so far.
 */
export function exampleReport(kind: GuideKind, todayCob: string, t: TFunction, applied?: Applied): { definition: PanelsReport; entries: ReportDataEntry[]; practices: UserPractice[] } {
  if (kind === 'sleep') {
    const a = applied as Choices['sleep']
    const ns = nights()
    const bed = P('bed', named(a?.bedtime, t('reportPanels.bedtime')), 'Time')
    const wake = P('wake', named(a?.wake, t('reportPanels.wakeUp')), 'Time')
    const nap = !a || a.nap !== null ? P('nap', named(a?.nap, t('reportPanels.nap')), 'Duration') : null
    return {
      definition: sleepPanels({ bedtime: bed.id, wake: wake.id, nap: nap?.id ?? null, min: a ? a.min : 360, max: a ? a.max : 540 }),
      // The night ending on day i began the evening before.
      entries: entriesOf(todayCob, SLEEP_DAYS, [
        { practice: bed, values: ns.map((_, i) => (ns[i + 1] ? time(ns[i + 1]!.bed) : null)) },
        { practice: wake, values: ns.map((n) => (n ? time(n.wake) : null)) },
        ...(nap ? [{ practice: nap, values: ns.map((n) => (n && n.nap ? { Duration: Math.round(n.nap * 60) } : null)) }] : []),
      ]),
      practices: nap ? [bed, wake, nap] : [bed, wake],
    }
  }
  if (kind === 'count') {
    const a = applied as Choices['count']
    const cs = counts()
    const total = P('count', named(a?.count, t('guide.suggest.count3')), 'Int')
    const early = !a || a.early !== null ? P('early', named(a?.early, t('reportPanels.morningRounds')), 'Int') : null
    const def = japaPanels({ total: total.id, target: a ? (a.target ?? TARGET) : TARGET, morning: early?.id ?? null, quality: null, attunement: null })
    // No target yet: no line and no days-on-target figure, rather than one from a number nobody chose.
    if (a && a.target === null) {
      for (const p of def.panels) {
        if (p.kind === 'Chart') p.target = null
        if (p.kind === 'Stats') p.stats = p.stats.filter((s) => !('Key' in s.label && s.label.Key.endsWith('daysOnTarget')))
      }
    }
    return {
      definition: def,
      entries: entriesOf(todayCob, COUNT_DAYS, [
        { practice: total, values: cs.map((c) => (c ? { Int: c.v } : null)) },
        ...(early ? [{ practice: early, values: cs.map((c) => (c ? { Int: c.e } : null)) }] : []),
      ]),
      practices: early ? [total, early] : [total],
    }
  }
  if (kind === 'time') {
    const a = applied as Choices['time']
    const ds = durations()
    const names = unique(a?.names ?? [])
    const ps = (names.length ? names : [1, 2, 3].map((n) => t(`guide.suggest.time${n}`))).map((name, j) => P(`time${j + 1}`, name, 'Duration'))
    return {
      definition: durationPanels({ practices: ps.map((p) => p.id), goal: a ? a.goal : GOAL }),
      entries: entriesOf(todayCob, COUNT_DAYS, ps.map((practice, j) => ({ practice, values: ds.map((d) => (d && d[j % 3] ? { Duration: d[j % 3] } : null)) }))),
      practices: ps,
    }
  }
  if (kind === 'gaps') {
    const a = applied as Choices['gaps']
    const g = gapDays()
    // ponytail: the preview takes the event's name; its rows stay the example's count, as their types aren't known here.
    const event = P('event', named(a?.event, t('guide.suggest.gaps1')), 'Bool')
    const row = !a || a.rows.length || a.sleep ? P('row', t('guide.suggest.count3'), 'Int') : null
    return {
      definition: gapsPanels({ event: event.id, rows: row ? [row.id] : [], sleep: null }),
      entries: entriesOf(todayCob, GAP_DAYS, [
        { practice: event, values: g.event.map((on) => (on ? { Bool: true } : null)) },
        ...(row ? [{ practice: row, values: g.count.map((v) => (v === null ? null : { Int: v })) }] : []),
      ]),
      practices: row ? [event, row] : [event],
    }
  }
  if (kind === 'goals') {
    const a = applied as Choices['goals']
    const mine = a?.goals.filter((g) => g.name.trim()) ?? []
    const goals = mine.length ? mine : EXAMPLE_GOALS(t)
    const ps = goals.map((g, j) => P(`goal${j + 1}`, g.name, g.type))
    return {
      definition: goalsPanels({ goals: goals.map((g, j) => ({ practice: ps[j].id, direction: g.direction, amount: g.amount ?? 1, period: g.period, counts: g.type === 'Duration' ? g.counts : 'Total' })) }),
      entries: entriesOf(todayCob, GOAL_DAYS, ps.map((practice, j) => ({ practice, values: goalValues(practice.data_type, j) }))),
      practices: ps,
    }
  }
  const a = applied as Choices['days']
  const names = unique(a?.names ?? [])
  const ps = (names.length ? names : [5, 4, 3].map((n) => t(`guide.suggest.days${n}`))).map((name, j) => P(`days${j + 1}`, name, 'Bool'))
  return {
    definition: daysPanels({ practices: ps.map((p) => p.id) }),
    entries: entriesOf(todayCob, 90, ps.map((practice, j) => {
      const R = rng(40 + (j % 3))
      return { practice, values: Array.from({ length: 90 }, () => (R() < DONE_RATES[j % 3] ? { Bool: true } : null)) }
    })),
    practices: ps,
  }
}

/** The day an example stands on. Days draws one month, nearly empty early on, so it shows the last month's 28th (every month has one) until this month's. */
export function exampleDay(kind: GuideKind, todayCob: string): string {
  const d = fromDateStr(todayCob)
  return kind !== 'days' || d.getDate() >= 28 ? todayCob : toDateStr(new Date(d.getFullYear(), d.getMonth() - 1, 28))
}

/** What a screen reader gets in place of the picture: the figures its charts draw. */
export function exampleSummary(kind: GuideKind, todayCob: string, t: TFunction): string {
  const { definition, entries, practices } = exampleReport(kind, todayCob, t)
  const l = makeLookup(entries, undefined, practices)
  const days = windowDays(entries)
  const stats = definition.panels.flatMap((p): Stat[] => (p.kind === 'Stats' ? p.stats : []))
  const stat = (i: number) => statResult(stats[i].value, days, l, todayCob)
  const band = t('guide.example.band')
  const units = { h: t('today.unitH'), min: t('today.unitMin') }
  if (kind === 'gaps') {
    const { typical } = gapFigures(gapEvents(practices[0].id, days, [], l))
    return t('guide.example.summaryGaps', { band, name: practices[0].practice, typical: typical ?? 0 })
  }
  if (kind === 'goals') return t('guide.example.summaryGoals', { band, list: practices.map((p) => p.practice).join(', ') })
  if (kind === 'days') {
    const month = todayCob.slice(0, 7)
    const list = practices.map((p) => `${p.practice}: ${monthCounts(p.id, month, todayCob, l).thisMonth}`).join('; ')
    return t('guide.example.summaryDays', { band, list })
  }
  const on = statResult(stats.find((s) => 'OnTarget' in s.value)!.value, days, l, todayCob)
  const common = { band, on: on.value ?? 0, of: on.of ?? 0 }
  if (kind === 'sleep') return t('guide.example.summarySleep', { ...common, avg: formatDuration(stat(0).value ?? 0, units) })
  // Count and time draw their average as the chart's headline, not as a stat.
  const chart = definition.panels.find((p) => p.kind === 'Chart')!
  const avg = statResult({
    Average: { of: chart.target?.of ?? chart.series[0].source, pick: null, format: chart.format, scope: { today: false, missing_zero: true } },
  }, days, l, todayCob).value ?? 0
  if (kind === 'count') return t('guide.example.summaryCount', { ...common, name: practices[0].practice, avg })
  return t('guide.example.summaryTime', { ...common, names: practices.map((p) => p.practice).join(', '), avg: formatDuration(avg, units) })
}
