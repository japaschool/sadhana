import i18n from 'i18next'
import { describe, expect, it } from 'vitest'
import type { Panel } from '../../api/charts'
import { makeLookup, resolve, windowDays } from '../insights/panels/panelLogic'
import { exampleReport, exampleSummary } from './examples'
import type { GuideKind } from './guideLogic'

const KINDS: GuideKind[] = ['sleep', 'count', 'time', 'days']
const TODAY = '2026-11-02'
const t = i18n.t.bind(i18n)

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
