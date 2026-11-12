import type { ChartPanel, DaysTemplate, DurationTemplate, GapsTemplate, GoalsTemplate, JapaTemplate, Label, Panel, PanelsReport, Report, Scope, SleepRows, SleepTemplate, Source, Stat, Target } from '../../../api/charts'
import type { PracticeDataType, UserPractice } from '../../../types/api'

const key = (k: string): Label => ({ Key: `reportPanels.${k}` })
const scope: Scope = { today: true, missing_zero: false }
/** Today out, a missing day counts as 0: what Insights' own averages do. */
const past: Scope = { today: false, missing_zero: true }

const term = (sign: number, practice: string, day_offset: number, optional = false) =>
  ({ sign, practice, day_offset, optional })

/** A night's sleep plus an optional nap, as the Sleep template totals it. */
export function sleepSource(s: SleepRows): Source {
  const terms = [term(1, s.wake, 0), term(-1, s.bedtime, -1)]
  return { Calc: { terms: s.nap ? [...terms, term(1, s.nap, 0, true)] : terms } }
}

/** Builds the Panels report of the Sleep template from its settings. */
export function sleepPanels(t: SleepTemplate): PanelsReport {
  const night: Source = { Calc: { terms: [term(1, t.wake, 0), term(-1, t.bedtime, -1)] } }
  const total = sleepSource(t)
  const range: Source = { Range: { from: { practice: t.bedtime, day_offset: -1 }, to: { practice: t.wake, day_offset: 0 } } }
  const limited = t.min !== null || t.max !== null

  const stats: Stat[] = [
    {
      label: key('avgSleep'),
      value: { Average: { of: total, pick: null, format: 'Duration', scope } },
      under: t.nap
        ? { label: key('nightOnly'), value: { Average: { of: night, pick: null, format: 'Duration', scope } }, under: null }
        : null,
    },
    { label: key('avgBedtime'), value: { Average: { of: range, pick: 'From', format: 'NoonClock', scope } }, under: null },
    { label: key('avgWake'), value: { Average: { of: range, pick: 'To', format: 'NoonClock', scope } }, under: null },
    limited
      ? { label: key('nightsInRange'), value: { OnTarget: { of: total, min: t.min, max: t.max, scope } }, under: null }
      : { label: key('nightsLogged'), value: { Logged: { of: total, scope } }, under: null },
  ]

  const times: ChartPanel = {
    title: key('sleepTimes'),
    series: [{ label: key('sleep'), mark: 'Range', source: range, axis: 'Left', only_with: null }],
    bar_layout: 'Grouped',
    format: 'NoonClock',
    reversed: false,
    target: { min: t.min, max: t.max, of: total, lines: false, colour: true, label: null } satisfies Target,
    lines: [
      { of: range, pick: 'From', dashed: false, label: key('avgBedtime') },
      { of: range, pick: 'To', dashed: true, label: key('avgWake') },
    ],
  }

  const duration: ChartPanel = {
    title: key('sleepDuration'),
    series: [
      { label: key('night'), mark: 'Bar', source: night, axis: 'Left', only_with: null },
      ...(t.nap ? [{ label: key('nap'), mark: 'Bar' as const, source: { Practice: { practice: t.nap } }, axis: 'Left' as const, only_with: 0 }] : []),
    ],
    bar_layout: 'Stacked',
    format: 'Duration',
    reversed: false,
    target: { min: t.min, max: t.max, of: total, lines: true, colour: true, label: null },
    lines: [],
  }

  const panels: Panel[] = [{ kind: 'Stats', stats }, { kind: 'Chart', ...times }, { kind: 'Chart', ...duration }]
  return {
    version: 1,
    template: { Sleep: t },
    required: [
      { practice: t.bedtime, label: key('bedtime') },
      { practice: t.wake, label: key('wakeUp') },
    ],
    panels,
  }
}

const practice = (id: string): Source => ({ Practice: { practice: id } })

/**
 * Builds the Panels report of the Japa template from its settings: one chart, rounds as bars under the headline.
 * `quality` and `attunement`, which older reports may have, are no longer drawn.
 */
export function japaPanels(t: JapaTemplate): PanelsReport {
  const total = practice(t.total)
  const average = (label: string, id: string): Stat =>
    ({ label: key(label), value: { Average: { of: practice(id), pick: null, format: 'Count', scope: past } }, under: null })
  const stats: Stat[] = [
    ...(t.target === null ? [] : [{ label: key('daysOnTarget'), value: { OnTarget: { of: total, min: t.target, max: null, scope: past } }, under: null }]),
    ...(t.morning ? [average('avgMorning', t.morning)] : []),
  ]
  const chart: ChartPanel = {
    title: null,
    headline: true,
    series: [
      { label: null, mark: 'Bar', source: total, axis: 'Left', only_with: null },
      ...(t.morning ? [{ label: key('morningRounds'), mark: 'Bar' as const, source: practice(t.morning), axis: 'Left' as const, only_with: 0 }] : []),
    ],
    bar_layout: 'Overlaid',
    format: 'Count',
    reversed: false,
    target: { min: t.target, max: null, of: total, lines: t.target !== null, colour: true, label: key('target') },
    lines: [],
  }
  return {
    version: 1,
    template: { Japa: t },
    required: [{ practice: t.total, label: key('totalRounds') }],
    panels: [...(stats.length ? [{ kind: 'Stats' as const, stats }] : []), { kind: 'Chart', ...chart }],
  }
}

/** A saved Japa or Time spent report drawn as the template draws it now, so older ones pick up the current chart. */
export function current(def: PanelsReport): PanelsReport {
  const t = def.template
  return t && 'Japa' in t ? japaPanels(t.Japa) : t && 'Duration' in t ? durationPanels(t.Duration) : def
}

/** Builds the Panels report of the Duration template from its settings. */
export function durationPanels(t: DurationTemplate): PanelsReport {
  // Every term optional: a day with nothing logged totals 0, which is how a missing day counts here.
  const total: Source = { Calc: { terms: t.practices.map((id) => term(1, id, 0, true)) } }
  const several = t.practices.length > 1
  // The daily average heads the chart, so only days on goal is left as a stat.
  const stats: Stat[] = t.goal === null ? [] : [{ label: key('daysOnGoal'), value: { OnTarget: { of: total, min: t.goal, max: null, scope: past } }, under: null }]
  const chart: ChartPanel = {
    title: null,
    headline: true,
    series: t.practices.map((id) => ({ label: null, mark: 'Bar', source: practice(id), axis: 'Left', only_with: null })),
    bar_layout: several ? 'Stacked' : 'Grouped',
    format: 'Duration',
    reversed: false,
    // With several practices the colours name them, so only the line shows the goal.
    target: { min: t.goal, max: null, of: total, lines: t.goal !== null, colour: !several, label: key('goal') },
    lines: [],
  }
  return {
    version: 1,
    template: { Duration: t },
    required: t.practices.map((id) => ({ practice: id, label: key('dailyTotals') })),
    panels: [...(stats.length ? [{ kind: 'Stats' as const, stats }] : []), { kind: 'Chart', ...chart }],
  }
}

/** Builds the Panels report of the Days I did it template: one Month panel a practice, in order. */
export function daysPanels(t: DaysTemplate): PanelsReport {
  return {
    version: 1,
    template: { Days: t },
    required: t.practices.map((id) => ({ practice: id, label: key('done') })),
    panels: t.practices.map((id) => ({ kind: 'Month' as const, practice: id })),
  }
}

/** Builds the Days between events report: the gaps, then the rows on the days around them (calculated Sleep last). */
export function gapsPanels(t: GapsTemplate): PanelsReport {
  const rows = [
    ...t.rows.map((id) => ({ label: null, source: practice(id) })),
    ...(t.sleep ? [{ label: key('sleep'), source: sleepSource(t.sleep) }] : []),
  ]
  return {
    version: 1,
    template: { Gaps: t },
    required: [{ practice: t.event, label: key('event') }],
    panels: [{ kind: 'Gaps', event: t.event }, ...(rows.length ? [{ kind: 'Around' as const, event: t.event, rows }] : [])],
  }
}

/** Builds the Panels report of the Goals template: one Goals panel holding the goals. */
export function goalsPanels(t: GoalsTemplate): PanelsReport {
  return { version: 1, template: { Goals: t }, required: [], panels: [{ kind: 'Goals', goals: t.goals }] }
}

/** The word a report's own strings go by. */
export const templateSlug = (def: PanelsReport) => {
  const t = def.template
  return t && 'Duration' in t ? 'duration' : t && 'Japa' in t ? 'japa' : t && 'Days' in t ? 'days' : t && 'Gaps' in t ? 'gaps' : t && 'Goals' in t ? 'goals' : 'sleep'
}

export interface Slot { key: string; types: PracticeDataType[]; required: boolean; hints: string[]; many?: boolean }

export const SLEEP_SLOTS: Slot[] = [
  { key: 'bedtime', types: ['Time'], required: true, hints: ['bed', 'sleep', 'сон', 'сну', 'отбой', 'отбій', 'спать', 'спат', 'сп'] },
  { key: 'wake', types: ['Time'], required: true, hints: ['wake', 'rise', 'up', 'подъ', 'подй', 'просып', 'пробуд', 'підйом', 'підйо', 'встав'] },
  { key: 'nap', types: ['Duration'], required: false, hints: ['nap', 'siesta', 'day', 'дневн', 'днев', 'денн', 'дрем'] },
]

export const SLEEP_DEFAULTS = { min: 360, max: 540 }

export const JAPA_SLOTS: Slot[] = [
  { key: 'total', types: ['Int'], required: true, hints: ['total', 'всего', 'усього', 'за день', 'round', 'круг', 'кол', 'japa', 'джап'] },
  { key: 'morning', types: ['Int'], required: false, hints: ['morning', 'by 7', 'утр', 'ранк', 'ранн'] },
]

export const DURATION_SLOT: Slot = { key: 'practices', types: ['Duration'], required: true, hints: [], many: true }
/** The server's MAX_SERIES: one series a practice. */
export const MAX_PRACTICES = 12

export const DAYS_SLOT: Slot = { key: 'practices', types: ['Bool'], required: true, hints: [], many: true }
/** One Month panel a practice, and the server allows 8 panels. */
export const MAX_DAYS = 8

// ponytail: no hints, so no Use suggestion: no practice name says "event". Add hints if users ask.
export const GAPS_EVENT_SLOT: Slot = { key: 'event', types: ['Bool', 'Text'], required: true, hints: [] }
export const GAPS_ROWS_SLOT: Slot = { key: 'compare', types: ['Int', 'Duration', 'Time'], required: false, hints: [], many: true }
/** The server's MAX_AROUND_ROWS, calculated Sleep included. */
export const MAX_ROWS = 4

export const GOAL_SLOT: Slot = { key: 'goalPractice', types: ['Bool', 'Int', 'Duration'], required: true, hints: [] }
/** The server's cap on goals in one report. */
export const MAX_GOALS = 12

const typeFits = (slot: Slot, p: UserPractice) => slot.types.includes(p.data_type)

export const fits = (slot: Slot, p: UserPractice) => p.is_active && typeFits(slot, p)

/** A hint only: an active, same-type, untaken practice whose name contains the earliest possible of the slot's hints. */
export function suggestFor(slot: Slot, practices: UserPractice[], taken: Set<string>): UserPractice | null {
  const open = practices.filter((p) => fits(slot, p) && !taken.has(p.id))
  for (const h of slot.hints) {
    const hit = open.find((p) => p.practice.toLowerCase().includes(h))
    if (hit) return hit
  }
  return null
}

export function pickerGroups(slot: Slot, practices: UserPractice[]): { compatible: UserPractice[]; cant: { practice: UserPractice; reason: 'type' }[] } {
  const active = practices.filter((p) => p.is_active)
  return {
    compatible: active.filter((p) => typeFits(slot, p)),
    cant: active.filter((p) => !typeFits(slot, p)).map((practice) => ({ practice, reason: 'type' as const })),
  }
}

/** Calculated Sleep's practices: a Sleep report's, else a bedtime and a wake-up found by name; no nap. */
export function sleepRowsFor(reports: Report[], practices: UserPractice[]): SleepRows | null {
  const ok = (slot: Slot, id: string) => practices.some((p) => p.id === id && fits(slot, p))
  const named = [...reports].sort((a, b) => a.name.localeCompare(b.name))
  for (const r of named) {
    const t = 'Panels' in r.definition ? r.definition.Panels.template : null
    if (t && 'Sleep' in t && ok(SLEEP_SLOTS[0], t.Sleep.bedtime) && ok(SLEEP_SLOTS[1], t.Sleep.wake)) {
      return { bedtime: t.Sleep.bedtime, wake: t.Sleep.wake, nap: t.Sleep.nap && ok(SLEEP_SLOTS[2], t.Sleep.nap) ? t.Sleep.nap : null }
    }
  }
  const bed = suggestFor(SLEEP_SLOTS[0], practices, new Set())
  const wake = bed && suggestFor(SLEEP_SLOTS[1], practices, new Set([bed.id]))
  return bed && wake ? { bedtime: bed.id, wake: wake.id, nap: null } : null
}
