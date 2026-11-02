import { describe, it, expect } from 'vitest'
import type { ChartPanel, JapaTemplate, Panel, SleepTemplate, Stat } from '../../../api/charts'
import type { UserPractice } from '../../../types/api'
import { DAYS_SLOT, daysPanels, DURATION_SLOT, durationPanels, MAX_DAYS, JAPA_SLOTS, japaPanels, numericVariants, pickerGroups, SLEEP_DEFAULTS, SLEEP_SLOTS, sleepPanels, suggestFor } from './templates'

const T: SleepTemplate = { bedtime: 'bed', wake: 'wake', nap: 'nap', min: 360, max: 540 }
const charts = (ps: Panel[]) => ps.filter((p): p is Extract<Panel, { kind: 'Chart' }> => p.kind === 'Chart') as (ChartPanel & { kind: 'Chart' })[]

const night = { Calc: { terms: [
  { sign: 1, practice: 'wake', day_offset: 0, optional: false },
  { sign: -1, practice: 'bed', day_offset: -1, optional: false },
] } }
const total = { Calc: { terms: [...night.Calc.terms, { sign: 1, practice: 'nap', day_offset: 0, optional: true }] } }

describe('sleepPanels', () => {
  it('lists required practices and the panel order', () => {
    const r = sleepPanels(T)
    expect(r.version).toBe(1)
    expect(r.template).toEqual({ Sleep: T })
    expect(r.required.map((x) => x.practice)).toEqual(['bed', 'wake'])
    expect(r.panels.map((p) => p.kind)).toEqual(['Stats', 'Chart', 'Chart'])
  })

  it('builds the times chart', () => {
    const [times] = charts(sleepPanels(T).panels)
    expect(times.series).toHaveLength(1)
    expect(times.series[0].mark).toBe('Range')
    expect(times.series[0].source).toEqual({ Range: { from: { practice: 'bed', day_offset: -1 }, to: { practice: 'wake', day_offset: 0 } } })
    expect(times.reversed).toBe(true)
    expect(times.format).toBe('NoonClock')
    expect(times.lines.map((l) => [l.pick, l.dashed, l.label])).toEqual([
      ['From', false, { Key: 'reportPanels.avgBedtime' }],
      ['To', true, { Key: 'reportPanels.avgWake' }],
    ])
    expect(times.target).toMatchObject({ min: 360, max: 540, of: total, colour: true, lines: false })
  })

  it('builds the duration chart', () => {
    const [, dur] = charts(sleepPanels(T).panels)
    expect(dur.series.map((s) => s.source)).toEqual([night, { Practice: { practice: 'nap' } }])
    expect(dur.series[1].only_with).toBe(0)
    expect(dur.bar_layout).toBe('Stacked')
    expect(dur.format).toBe('Duration')
    expect(dur.target).toMatchObject({ min: 360, max: 540, of: total, lines: true, colour: true })
  })

  it('drops the nap everywhere without one', () => {
    const r = sleepPanels({ ...T, nap: null })
    const [times, dur] = charts(r.panels)
    expect(dur.series).toHaveLength(1)
    expect(JSON.stringify(r)).not.toContain('reportPanels.nap')
    expect(times.target!.of).toEqual(night)
    expect(r.panels[0]).toMatchObject({ stats: [{ under: null }, {}, {}, {}] })
  })

  it('has stats with scope and the night-only average under sleep', () => {
    const scope = { today: true, missing_zero: false }
    const stats = (sleepPanels(T).panels[0] as Extract<Panel, { kind: 'Stats' }>).stats
    expect(stats).toHaveLength(4)
    expect(stats[0].value).toEqual({ Average: { of: total, pick: null, format: 'Duration', scope } })
    expect(stats[0].under!.value).toEqual({ Average: { of: night, pick: null, format: 'Duration', scope } })
    expect(stats[1].value).toMatchObject({ Average: { pick: 'From', format: 'NoonClock', scope } })
    expect(stats[2].value).toMatchObject({ Average: { pick: 'To', format: 'NoonClock', scope } })
    expect(stats[3].value).toEqual({ OnTarget: { of: total, min: 360, max: 540, scope } })
  })

  it('uses Logged and neutral bars with no limits', () => {
    const r = sleepPanels({ ...T, min: null, max: null })
    const stats = (r.panels[0] as Extract<Panel, { kind: 'Stats' }>).stats
    expect(stats[3].value).toEqual({ Logged: { of: total, scope: { today: true, missing_zero: false } } })
    for (const c of charts(r.panels)) expect(c.target).toMatchObject({ min: null, max: null })
  })

  it('keeps one limit only', () => {
    const stats = (sleepPanels({ ...T, min: 400, max: null }).panels[0] as Extract<Panel, { kind: 'Stats' }>).stats
    expect(stats[3].value).toMatchObject({ OnTarget: { min: 400, max: null } })
  })

  it('labels everything with keys', () => {
    const bad: unknown[] = []
    const walk = (x: unknown, k?: string) => {
      if (Array.isArray(x)) x.forEach((v) => walk(v))
      else if (x && typeof x === 'object') for (const [kk, v] of Object.entries(x)) walk(v, kk)
      else if (k === 'Text') bad.push(x)
    }
    walk(sleepPanels(T))
    walk(sleepPanels({ ...T, nap: null }))
    expect(bad).toEqual([])
    const r = sleepPanels(T)
    for (const q of r.required) expect(q.label).toHaveProperty('Key')
  })
})

const p = (id: string, practice: string, data_type: UserPractice['data_type'], is_active = true): UserPractice =>
  ({ id, practice, data_type, is_active })

describe('slots', () => {
  it('defines the three slots', () => {
    expect(SLEEP_SLOTS.map((s) => [s.key, s.types, s.required])).toEqual([
      ['bedtime', ['Time'], true], ['wake', ['Time'], true], ['nap', ['Duration'], false]])
    expect(SLEEP_DEFAULTS).toEqual({ min: 360, max: 540 })
  })
})

describe('suggestFor', () => {
  const [bedSlot, wakeSlot] = SLEEP_SLOTS
  it('matches hints in en, ru, uk', () => {
    expect(suggestFor(bedSlot, [p('1', 'Bedtime', 'Time')], new Set())?.id).toBe('1')
    expect(suggestFor(bedSlot, [p('1', 'Отбой', 'Time')], new Set())?.id).toBe('1')
    expect(suggestFor(bedSlot, [p('1', 'Лягаю спати', 'Time')], new Set())?.id).toBe('1')
    expect(suggestFor(wakeSlot, [p('1', 'Подъём', 'Time')], new Set())?.id).toBe('1')
  })
  it('skips hidden, taken, wrong type', () => {
    expect(suggestFor(bedSlot, [p('1', 'Bedtime', 'Time', false)], new Set())).toBeNull()
    expect(suggestFor(bedSlot, [p('1', 'Bedtime', 'Time')], new Set(['1']))).toBeNull()
    expect(suggestFor(bedSlot, [p('1', 'Bedtime', 'Int')], new Set())).toBeNull()
  })
  it('is null with no match', () => {
    expect(suggestFor(bedSlot, [p('1', 'Japa', 'Time')], new Set())).toBeNull()
  })
})

describe('pickerGroups', () => {
  it('splits compatible, cant and hidden', () => {
    const ps = [p('1', 'A', 'Time'), p('2', 'B', 'Int'), p('3', 'C', 'Time', false)]
    const g = pickerGroups(SLEEP_SLOTS[0], ps)
    expect(g.compatible.map((x) => x.id)).toEqual(['1'])
    expect(g.cant.map((x) => [x.practice.id, x.reason])).toEqual([['2', 'type']])
  })
})

const J: JapaTemplate = { total: 'tot', target: 16, morning: 'mor', quality: 'qua', attunement: 'att' }
const statsOf = (ps: Panel[]) => (ps[0] as Extract<Panel, { kind: 'Stats' }>).stats
const scopeOf = (s: Stat) => (Object.values(s.value)[0] as { scope: unknown }).scope

describe('japaPanels', () => {
  it('requires total rounds only', () => {
    const r = japaPanels(J)
    expect(r.template).toEqual({ Japa: J })
    expect(r.required.map((x) => x.practice)).toEqual(['tot'])
    expect(r.panels.map((p) => p.kind)).toEqual(['Stats', 'Chart', 'Chart'])
  })

  it('takes today out and counts a missing day as 0 in every stat', () => {
    const stats = statsOf(japaPanels(J).panels)
    expect(stats).toHaveLength(5)
    for (const s of stats) expect(scopeOf(s)).toEqual({ today: false, missing_zero: true })
  })

  it('draws total bars against the target, morning overlaid, attunement as a dot', () => {
    const [rounds] = charts(japaPanels(J).panels)
    expect(rounds.bar_layout).toBe('Overlaid')
    expect(rounds.format).toBe('Count')
    expect(rounds.series.map((s) => s.mark)).toEqual(['Bar', 'Bar', 'Dot'])
    expect(rounds.series[0].source).toEqual({ Practice: { practice: 'tot' } })
    expect(rounds.series[2].only_with).toBe(0)
    expect(rounds.target).toMatchObject({ min: 16, max: null, lines: true, colour: true, of: { Practice: { practice: 'tot' } } })
  })

  it('gives quality its own line chart', () => {
    const [, q] = charts(japaPanels(J).panels)
    expect(q.series).toHaveLength(1)
    expect(q.series[0].mark).toBe('Line')
    expect(q.target).toBeNull()
  })

  it('has one chart and two stats with only total and target', () => {
    const r = japaPanels({ ...J, morning: null, quality: null, attunement: null })
    expect(charts(r.panels)).toHaveLength(1)
    expect(charts(r.panels)[0].series).toHaveLength(1)
    expect(statsOf(r.panels)).toHaveLength(2)
  })
})

describe('numeric practices', () => {
  const dd = (dropdown_variants?: string) => ({ ...p('x', 'Quality', 'Text'), dropdown_variants })
  it('needs every dropdown variant to be a number', () => {
    expect(numericVariants(dd('1,2,3'))).toBe(true)
    expect(numericVariants(dd('1\n2, 3'))).toBe(true)
    expect(numericVariants(dd('1,good'))).toBe(false)
    expect(numericVariants(dd(''))).toBe(false)
    expect(numericVariants(dd())).toBe(false)
  })
  it('offers a numeric dropdown for quality, and refuses other text', () => {
    const quality = JAPA_SLOTS.find((s) => s.key === 'quality')!
    const { compatible, cant } = pickerGroups(quality, [p('i', 'Int', 'Int'), { ...dd('1,2'), id: 'n' }, { ...dd('a,b'), id: 't' }, p('b', 'Bool', 'Bool')])
    expect(compatible.map((p) => p.id)).toEqual(['i', 'n'])
    expect(cant.map((c) => c.practice.id)).toEqual(['t', 'b'])
  })
})

describe('durationPanels', () => {
  const ids = ['a', 'b', 'c']
  it('one practice with a goal: states and a goal line', () => {
    const r = durationPanels({ practices: ['a'], goal: 60 })
    const [c] = charts(r.panels)
    expect(r.template).toEqual({ Duration: { practices: ['a'], goal: 60 } })
    expect(c.series).toHaveLength(1)
    expect(c.target).toMatchObject({ min: 60, max: null, lines: true, colour: true })
  })
  it('several practices: stacked by practice, the goal only as a line', () => {
    const [c] = charts(durationPanels({ practices: ids, goal: 120 }).panels)
    expect(c.bar_layout).toBe('Stacked')
    expect(c.series.map((s) => s.source)).toEqual(ids.map((practice) => ({ Practice: { practice } })))
    expect(c.series.every((s) => s.label === null)).toBe(true)
    expect(c.target).toMatchObject({ lines: true, colour: false })
  })
  it('the daily total is optional on every term', () => {
    const [c] = charts(durationPanels({ practices: ids, goal: null }).panels)
    expect(c.target?.of).toEqual({ Calc: { terms: ids.map((practice) => ({ sign: 1, practice, day_offset: 0, optional: true })) } })
  })
  it('average per day; days on goal only with a goal', () => {
    const scope = { today: false, missing_zero: true }
    const withGoal = statsOf(durationPanels({ practices: ids, goal: 120 }).panels)
    expect(withGoal.map((s) => Object.keys(s.value)[0])).toEqual(['Average', 'OnTarget'])
    for (const s of withGoal) expect(scopeOf(s)).toEqual(scope)
    expect(statsOf(durationPanels({ practices: ids, goal: null }).panels)).toHaveLength(1)
  })
  it('requires each practice, under one label', () => {
    const r = durationPanels({ practices: ids, goal: null })
    expect(r.required.map((x) => x.practice)).toEqual(ids)
    expect(new Set(r.required.map((x) => JSON.stringify(x.label))).size).toBe(1)
  })
  it('a multi-select slot of Duration practices', () => {
    expect(DURATION_SLOT).toMatchObject({ many: true, types: ['Duration'], required: true })
  })
})

describe('suggestions for Japa', () => {
  const [total, , , attunement] = JAPA_SLOTS
  it('an earlier hint beats list order', () => {
    const ps = [p('q', 'Japa quality', 'Int'), p('m', 'Rounds in the morning', 'Int'), p('t', 'Total rounds', 'Int')]
    expect(suggestFor(total, ps, new Set())?.id).toBe('t')
  })
  it.each([
    ['en', 'Rounds by 7am', 'Total Rounds'],
    ['ru', 'Кругов до 7 утра', 'Кругов за день'],
    ['uk', 'Кругів до 7 ранку', 'Кругів за день'],
  ])('tells total from morning on the %s default practices', (_, morningName, totalName) => {
    const ps = [p('m', morningName, 'Int'), p('t', totalName, 'Int')]
    const [slot, morning] = JAPA_SLOTS
    expect(suggestFor(slot, ps, new Set())?.id).toBe('t')
    expect(suggestFor(morning, ps, new Set())?.id).toBe('m')
    expect(suggestFor(morning, ps, new Set(['t']))?.id).toBe('m')
  })
  it('knows attunement by its other name', () => {
    expect(suggestFor(attunement, [p('a', 'Japa affirmation', 'Bool')], new Set())?.id).toBe('a')
  })
})

describe('daysPanels', () => {
  it('one required practice and one Month panel each, in order, with no Stats', () => {
    const r = daysPanels({ practices: ['a', 'b', 'c'] })
    expect(r.version).toBe(1)
    expect(r.template).toEqual({ Days: { practices: ['a', 'b', 'c'] } })
    expect(r.required.map((x) => x.practice)).toEqual(['a', 'b', 'c'])
    expect(r.panels).toEqual([{ kind: 'Month', practice: 'a' }, { kind: 'Month', practice: 'b' }, { kind: 'Month', practice: 'c' }])
  })
  it('takes yes/no practices, several, up to 8', () => {
    expect(DAYS_SLOT).toMatchObject({ types: ['Bool'], many: true })
    expect(MAX_DAYS).toBe(8)
  })
})
