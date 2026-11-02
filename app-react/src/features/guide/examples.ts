import type { TFunction } from 'i18next'
import type { PanelsReport, ReportDataEntry, Stat } from '../../api/charts'
import type { PracticeDataType, UserPractice } from '../../types/api'
import { addDays, fromDateStr, toDateStr } from '../today/date'
import { formatDuration } from '../today/values'
import { makeLookup, monthCounts, statResult, windowDays } from '../insights/panels/panelLogic'
import { daysPanels, durationPanels, japaPanels, sleepPanels } from '../insights/panels/templates'
import type { GuideKind } from './guideLogic'

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

const time = (h: number) => { const m = Math.round(h * 60); return { Time: { h: Math.floor(m / 60) % 24, m: m % 60 } } }

type Row = { practice: UserPractice; values: unknown[] }
const P = (id: string, practice: string, data_type: PracticeDataType): UserPractice => ({ id: `example-${id}`, practice, data_type, is_active: true })

/** Every day of the window gets an entry per practice, null where nothing was logged, so a gap is drawn as a gap. */
function entriesOf(today: string, days: number, rows: Row[]): ReportDataEntry[] {
  const cobs = Array.from({ length: days }, (_, i) => toDateStr(addDays(fromDateStr(today), i - days + 1)))
  return rows.flatMap((r) => cobs.map((cob_date, i) => ({ cob_date, practice: r.practice.practice, value: r.values[i] ?? null })))
}

/**
 * A fixed example definition with its own data, built by the real report builders so it can't drift from them.
 * Nothing here is requested or saved: it works before anything exists.
 */
export function exampleReport(kind: GuideKind, todayCob: string, t: TFunction): { definition: PanelsReport; entries: ReportDataEntry[]; practices: UserPractice[] } {
  if (kind === 'sleep') {
    const ns = nights()
    const bed = P('bed', t('reportPanels.bedtime'), 'Time')
    const wake = P('wake', t('reportPanels.wakeUp'), 'Time')
    const nap = P('nap', t('reportPanels.nap'), 'Duration')
    return {
      definition: sleepPanels({ bedtime: bed.id, wake: wake.id, nap: nap.id, min: 360, max: 540 }),
      // The night ending on day i began the evening before.
      entries: entriesOf(todayCob, SLEEP_DAYS, [
        { practice: bed, values: ns.map((_, i) => (ns[i + 1] ? time(ns[i + 1]!.bed) : null)) },
        { practice: wake, values: ns.map((n) => (n ? time(n.wake) : null)) },
        { practice: nap, values: ns.map((n) => (n && n.nap ? { Duration: Math.round(n.nap * 60) } : null)) },
      ]),
      practices: [bed, wake, nap],
    }
  }
  if (kind === 'count') {
    const cs = counts()
    const total = P('count', t('guide.suggest.count3'), 'Int')
    const early = P('early', t('reportPanels.morningRounds'), 'Int')
    return {
      definition: japaPanels({ total: total.id, target: TARGET, morning: early.id, quality: null, attunement: null }),
      entries: entriesOf(todayCob, COUNT_DAYS, [
        { practice: total, values: cs.map((c) => (c ? { Int: c.v } : null)) },
        { practice: early, values: cs.map((c) => (c ? { Int: c.e } : null)) },
      ]),
      practices: [total, early],
    }
  }
  if (kind === 'time') {
    const ds = durations()
    const ps = [1, 2, 3].map((n) => P(`time${n}`, t(`guide.suggest.time${n}`), 'Duration'))
    return {
      definition: durationPanels({ practices: ps.map((p) => p.id), goal: GOAL }),
      entries: entriesOf(todayCob, COUNT_DAYS, ps.map((practice, j) => ({ practice, values: ds.map((d) => (d && d[j] ? { Duration: d[j] } : null)) }))),
      practices: ps,
    }
  }
  const ps = [5, 4, 3].map((n) => P(`days${n}`, t(`guide.suggest.days${n}`), 'Bool'))
  return {
    definition: daysPanels({ practices: ps.map((p) => p.id) }),
    entries: entriesOf(todayCob, 90, ps.map((practice, j) => {
      const R = rng(40 + j)
      return { practice, values: Array.from({ length: 90 }, () => (R() < DONE_RATES[j] ? { Bool: true } : null)) }
    })),
    practices: ps,
  }
}

/** What a screen reader gets in place of the picture: the same figures the report shows. */
export function exampleSummary(kind: GuideKind, todayCob: string, t: TFunction): string {
  const { definition, entries, practices } = exampleReport(kind, todayCob, t)
  const l = makeLookup(entries, undefined, practices)
  const days = windowDays(entries)
  const stats = definition.panels.flatMap((p): Stat[] => (p.kind === 'Stats' ? p.stats : []))
  const stat = (i: number) => statResult(stats[i].value, days, l, todayCob)
  const band = t('guide.example.band')
  const units = { h: t('today.unitH'), min: t('today.unitMin') }
  if (kind === 'days') {
    const month = todayCob.slice(0, 7)
    const list = practices.map((p) => `${p.practice}: ${monthCounts(p.id, month, todayCob, l).thisMonth}`).join('; ')
    return t('guide.example.summaryDays', { band, list })
  }
  const on = stat(kind === 'sleep' ? 3 : 1)
  const common = { band, on: on.value ?? 0, of: on.of ?? 0 }
  if (kind === 'sleep') return t('guide.example.summarySleep', { ...common, avg: formatDuration(stat(0).value ?? 0, units) })
  if (kind === 'count') return t('guide.example.summaryCount', { ...common, name: practices[0].practice, avg: stat(0).value ?? 0 })
  return t('guide.example.summaryTime', { ...common, names: practices.map((p) => p.practice).join(', '), avg: formatDuration(stat(0).value ?? 0, units) })
}
