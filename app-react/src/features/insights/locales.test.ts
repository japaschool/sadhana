import { describe, it, expect } from 'vitest'
import { durationPanels, japaPanels, sleepPanels } from './panels/templates'

type Dict = { insights?: Record<string, string>; reportPanels?: Record<string, string>; templateForm?: Record<string, string> }
const files = import.meta.glob<Dict>('../../../public/locales/*/translation.json', { eager: true, import: 'default' })

const KEYS = [
  'title', 'reports', 'range', 'range7d', 'range30d', 'range90d', 'range1y', 'rangeall',
  'endingToday', 'endingOn', 'resetEnd', 'dailyAverage', 'average',
  'vsPrev7d', 'vsPrev30d', 'vsPrev90d', 'vsPrev1y', 'noData', 'loadFailed',
  'legend', 'tickMin', 'newChart', 'editReport', 'deleteReport', 'date', 'days_one', 'days_other',
]

describe('insights.* translations', () => {
  it('has every key in en, ru and uk', () => {
    const langs = Object.keys(files).map((p) => /locales\/(\w+)\//.exec(p)![1]).sort()
    expect(langs).toEqual(['en', 'ru', 'uk'])
    for (const [path, dict] of Object.entries(files)) {
      for (const k of KEYS) expect(dict.insights?.[k], `${path} insights.${k}`).toBeTruthy()
    }
  })
})

describe('reportPanels.* translations', () => {
  it('has every key sleepPanels emits in en, ru and uk', () => {
    const keys = new Set<string>()
    const walk = (x: unknown) => {
      if (Array.isArray(x)) x.forEach(walk)
      else if (x && typeof x === 'object') {
        for (const [k, v] of Object.entries(x)) {
          if (k === 'Key' && typeof v === 'string') keys.add(v)
          else walk(v)
        }
      }
    }
    const t = { bedtime: 'a', wake: 'b', min: 1, max: 2 }
    walk(sleepPanels({ ...t, nap: 'c' }))
    walk(sleepPanels({ ...t, nap: null, min: null, max: null }))
    walk(japaPanels({ total: 'a', target: 16, morning: 'b', quality: 'c', attunement: 'd' }))
    walk(durationPanels({ practices: ['a', 'b'], goal: 60 }))
    for (const k of ['reportPanels.target', 'reportPanels.goal']) { keys.add(`${k}Met`); keys.add(`${k}Line`) }
    keys.add('reportPanels.goalShort')
    keys.add('reportPanels.missed')
    expect(keys.size).toBeGreaterThan(5)
    for (const [path, dict] of Object.entries(files)) {
      for (const k of keys) {
        expect(k.startsWith('reportPanels.')).toBe(true)
        expect(dict.reportPanels?.[k.slice('reportPanels.'.length)], `${path} ${k}`).toBeTruthy()
      }
    }
  })
})

describe('templateForm.* translations', () => {
  it('has the same keys in en, ru and uk', () => {
    const dicts = Object.values(files)
    const keys = Object.keys(dicts[0].templateForm ?? {}).sort()
    expect(keys.length).toBeGreaterThan(30)
    for (const d of dicts) expect(Object.keys(d.templateForm ?? {}).sort()).toEqual(keys)
  })
})

describe('neutral report names', () => {
  // Daily count and Time spent aren't tied to one tradition. japaDesc names rounds as one example, on purpose.
  const TRADITIONAL = /japa|джап|rounds|круг|кола|кіл\b/i
  it('keeps japa and rounds out of the report copy', () => {
    for (const [path, dict] of Object.entries(files)) {
      for (const group of ['reportPanels', 'templateForm', 'chartSettings'] as const) {
        for (const [k, v] of Object.entries((dict as Record<string, Record<string, string>>)[group] ?? {})) {
          if (group === 'chartSettings' && k === 'japaDesc') continue
          expect(v, `${path} ${group}.${k}`).not.toMatch(TRADITIONAL)
        }
      }
    }
  })
})
