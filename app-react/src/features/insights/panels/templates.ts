import type { ChartPanel, JapaTemplate, Label, Panel, PanelsReport, Scope, SleepTemplate, Source, Stat, Target } from '../../../api/charts'
import type { PracticeDataType, UserPractice } from '../../../types/api'

const key = (k: string): Label => ({ Key: `reportPanels.${k}` })
const scope: Scope = { today: true, missing_zero: false }
/** Today out, a missing day counts as 0: what Insights' own averages do. */
const past: Scope = { today: false, missing_zero: true }

const term = (sign: number, practice: string, day_offset: number, optional = false) =>
  ({ sign, practice, day_offset, optional })

/** Builds the Panels report of the Sleep template from its settings. */
export function sleepPanels(t: SleepTemplate): PanelsReport {
  const night: Source = { Calc: { terms: [term(1, t.wake, 0), term(-1, t.bedtime, -1)] } }
  const total: Source = t.nap
    ? { Calc: { terms: [term(1, t.wake, 0), term(-1, t.bedtime, -1), term(1, t.nap, 0, true)] } }
    : night
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
    reversed: true,
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

/** Builds the Panels report of the Japa template from its settings. */
export function japaPanels(t: JapaTemplate): PanelsReport {
  const total = practice(t.total)
  const average = (label: string, id: string): Stat =>
    ({ label: key(label), value: { Average: { of: practice(id), pick: null, format: 'Count', scope: past } }, under: null })
  const stats: Stat[] = [
    average('avgRounds', t.total),
    { label: key('daysOnTarget'), value: { OnTarget: { of: total, min: t.target, max: null, scope: past } }, under: null },
    ...(t.morning ? [average('avgMorning', t.morning)] : []),
    ...(t.quality ? [average('avgQuality', t.quality)] : []),
    ...(t.attunement ? [{ label: key('attunementDays'), value: { CountTrue: { of: practice(t.attunement), scope: past } }, under: null }] : []),
  ]
  const rounds: ChartPanel = {
    title: key('rounds'),
    series: [
      { label: null, mark: 'Bar', source: total, axis: 'Left', only_with: null },
      ...(t.morning ? [{ label: key('morningRounds'), mark: 'Bar' as const, source: practice(t.morning), axis: 'Left' as const, only_with: 0 }] : []),
      ...(t.attunement ? [{ label: key('attunementDone'), mark: 'Dot' as const, source: practice(t.attunement), axis: 'Left' as const, only_with: 0 }] : []),
    ],
    bar_layout: 'Overlaid',
    format: 'Count',
    reversed: false,
    target: { min: t.target, max: null, of: total, lines: true, colour: true, label: key('target') },
    lines: [],
  }
  const quality: ChartPanel | null = t.quality ? {
    title: key('japaQuality'),
    series: [{ label: null, mark: 'Line', source: practice(t.quality), axis: 'Left', only_with: null }],
    bar_layout: 'Grouped',
    format: 'Count',
    reversed: false,
    target: null,
    lines: [],
  } : null
  return {
    version: 1,
    template: { Japa: t },
    required: [{ practice: t.total, label: key('totalRounds') }],
    panels: [{ kind: 'Stats', stats }, { kind: 'Chart', ...rounds }, ...(quality ? [{ kind: 'Chart' as const, ...quality }] : [])],
  }
}

/** The word a report's own strings go by. */
export const templateSlug = (def: PanelsReport) => (def.template && 'Japa' in def.template ? 'japa' : 'sleep')

export interface Slot { key: string; types: PracticeDataType[]; required: boolean; hints: string[] }

export const SLEEP_SLOTS: Slot[] = [
  { key: 'bedtime', types: ['Time'], required: true, hints: ['bed', 'sleep', 'сон', 'сну', 'отбой', 'отбій', 'спать', 'спат', 'сп'] },
  { key: 'wake', types: ['Time'], required: true, hints: ['wake', 'rise', 'up', 'подъ', 'подй', 'просып', 'пробуд', 'підйом', 'підйо', 'встав'] },
  { key: 'nap', types: ['Duration'], required: false, hints: ['nap', 'siesta', 'day', 'дневн', 'днев', 'денн', 'дрем'] },
]

export const SLEEP_DEFAULTS = { min: 360, max: 540 }

export const JAPA_SLOTS: Slot[] = [
  { key: 'total', types: ['Int'], required: true, hints: ['japa', 'round', 'джап', 'круг', 'кол'] },
  { key: 'morning', types: ['Int'], required: false, hints: ['morning', 'утр', 'ранк', 'ранн'] },
  { key: 'quality', types: ['Int', 'Text'], required: false, hints: ['quality', 'качеств', 'якіст'] },
  { key: 'attunement', types: ['Bool'], required: false, hints: ['attun', 'настр', 'налаш'] },
]

/** A dropdown whose every option is a number, so its values can be charted. */
export function numericVariants(p: UserPractice): boolean {
  const options = (p.dropdown_variants ?? '').split(/[,\n]/).map((v) => v.trim()).filter(Boolean)
  return options.length > 0 && options.every((v) => Number.isFinite(Number(v)))
}

const typeFits = (slot: Slot, p: UserPractice) => slot.types.includes(p.data_type) && (p.data_type !== 'Text' || numericVariants(p))

export const fits = (slot: Slot, p: UserPractice) => p.is_active && typeFits(slot, p)

/** A hint only: the first active, same-type, untaken practice whose name contains one of the slot's hints. */
export function suggestFor(slot: Slot, practices: UserPractice[], taken: Set<string>): UserPractice | null {
  return practices.find((p) => fits(slot, p) && !taken.has(p.id)
    && slot.hints.some((h) => p.practice.toLowerCase().includes(h))) ?? null
}

export function pickerGroups(slot: Slot, practices: UserPractice[]): { compatible: UserPractice[]; cant: { practice: UserPractice; reason: 'type' }[] } {
  const active = practices.filter((p) => p.is_active)
  return {
    compatible: active.filter((p) => typeFits(slot, p)),
    cant: active.filter((p) => !typeFits(slot, p)).map((practice) => ({ practice, reason: 'type' as const })),
  }
}
