import i18n from 'i18next'
import { describe, expect, it } from 'vitest'
import type { Panel } from '../../api/charts'
import { makeLookup, resolve, windowDays } from '../insights/panels/panelLogic'
import { exampleDay, exampleReport, exampleSummary } from './examples'
import type { GuideKind } from './guideLogic'

const KINDS: GuideKind[] = ['sleep', 'count', 'time', 'days']
const TODAY = '2026-11-02'
const t = i18n.t.bind(i18n)

describe('exampleDay', () => {
  it.each([['2026-11-01', '2026-10-28'], ['2026-11-27', '2026-10-28'], ['2026-01-02', '2025-12-28'], ['2026-03-01', '2026-02-28']])('days on %s stands on %s', (today, day) => {
    expect(exampleDay('days', today)).toBe(day)
  })
  it('keeps a date already late in the month, and the other kinds', () => {
    expect(exampleDay('days', '2026-11-28')).toBe('2026-11-28')
    expect(exampleDay('sleep', '2026-11-01')).toBe('2026-11-01')
  })
  it('gives days a well filled month on the first', () => {
    const { entries, practices } = exampleReport('days', exampleDay('days', '2026-11-01'), t)
    const done = entries.filter((e) => e.practice === practices[0].practice && e.cob_date.startsWith('2026-10') && e.value).length
    expect(done).toBeGreaterThan(10)
  })
})

describe('example reports', () => {
  it.each(KINDS)('%s builds from fixed data, the same each time', (kind) => {
    const a = exampleReport(kind, TODAY, t)
    expect(a.entries.length).toBeGreaterThan(0)
    expect(exampleReport(kind, TODAY, t)).toEqual(a)
  })

  it.each(KINDS)('%s ends today and names its practices from the language', (kind) => {
    const { entries, practices } = exampleReport(kind, TODAY, t)
    expect(windowDays(entries).at(-1)).toBe(TODAY)
    expect(practices.length).toBeGreaterThan(0)
    for (const p of practices) expect(p.practice).not.toMatch(/^guide\./)
    if (kind === 'time') expect(practices.map((p) => p.practice)).toEqual([t('guide.suggest.time1'), t('guide.suggest.time2'), t('guide.suggest.time3')])
  })

  it.each(['sleep', 'count', 'time'] as const)('%s has missed days and none that are all perfect', (kind) => {
    const { definition, entries, practices } = exampleReport(kind, TODAY, t)
    const l = makeLookup(entries, undefined, practices)
    const chart = definition.panels.find((p): p is Extract<Panel, { kind: 'Chart' }> => p.kind === 'Chart' && !!p.target)!
    const days = windowDays(entries)
    const totals = days.map((d) => resolve(chart.target!.of, d, l))
    const nums = totals.map((v) => (Array.isArray(v) ? v[1] - v[0] : v))
    expect(nums.some((v) => v === null || v === 0)).toBe(true)
    const { min, max } = chart.target!
    const miss = nums.filter((v) => v !== null && ((min !== null && v < min) || (max !== null && v > max)))
    expect(miss.length).toBeGreaterThan(0)
    expect(nums.filter((v) => v !== null && !miss.includes(v)).length).toBeGreaterThan(0)
  })

  it('days has days not done in each practice', () => {
    const { definition, entries, practices } = exampleReport('days', TODAY, t)
    const l = makeLookup(entries, undefined, practices)
    expect(definition.panels).toHaveLength(3)
    for (const p of practices) {
      const done = windowDays(entries).filter((d) => l.value(p.id, d) !== null).length
      expect(done).toBeGreaterThan(0)
      expect(done).toBeLessThan(windowDays(entries).length)
    }
  })

  it.each(KINDS)('%s has a summary that says it is an example', (kind) => {
    const s = exampleSummary(kind, TODAY, t)
    expect(s).toContain(t('guide.example.band'))
    expect(s).not.toMatch(/\{\{|guide\./)
  })
})

describe('example reports with the choices applied', () => {
  const chart = (kind: GuideKind, a: Parameters<typeof exampleReport>[3]) => exampleReport(kind, TODAY, t, a).definition.panels.find((p) => p.kind === 'Chart')
  const stats = (kind: GuideKind, a: Parameters<typeof exampleReport>[3]) => exampleReport(kind, TODAY, t, a).definition.panels.flatMap((p) => (p.kind === 'Stats' ? p.stats : []))

  it('uses their names, and the example names for blank ones', () => {
    const r = exampleReport('sleep', TODAY, t, { bedtime: 'Lights out', wake: '', nap: null, min: null, max: 600 })
    expect(r.practices.map((p) => p.practice)).toEqual(['Lights out', t('reportPanels.wakeUp')])
    expect(exampleReport('days', TODAY, t, { names: ['Stretching', ' ', 'Stretching', 'Walk'] }).practices.map((p) => p.practice)).toEqual(['Stretching', 'Walk'])
    expect(exampleReport('time', TODAY, t, { names: [], goal: null }).practices).toHaveLength(3)
  })

  it('an empty count target draws no target line and no days-on-target figure; a typed one draws it', () => {
    const none = { count: 'Pages', target: null, early: null, how: null }
    const c = chart('count', none)
    expect(c && 'target' in c && c.target).toBeNull()
    expect(JSON.stringify(stats('count', none))).not.toContain('daysOnTarget')
    const c25 = chart('count', { ...none, target: 25 })
    expect(c25 && 'target' in c25 && c25.target?.min).toBe(25)
    expect(JSON.stringify(stats('count', { ...none, target: 25 }))).toContain('daysOnTarget')
  })

  it('a cleared goal and unticked extras leave them out; more names than the example has still draw', () => {
    expect(exampleReport('count', TODAY, t, { count: 'A', target: 1, early: null, how: null }).practices).toHaveLength(1)
    const c = chart('time', { names: ['a', 'b', 'c', 'd', 'e'], goal: null })
    expect(c && 'series' in c && c.series).toHaveLength(5)
    expect(c && 'target' in c && c.target?.min).toBeNull()
  })
})
