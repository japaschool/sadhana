import { describe, it, expect } from 'vitest'
import { sleepPanels } from './panels/templates'

type Dict = { insights?: Record<string, string>; reportPanels?: Record<string, string> }
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
    expect(keys.size).toBeGreaterThan(5)
    for (const [path, dict] of Object.entries(files)) {
      for (const k of keys) {
        expect(k.startsWith('reportPanels.')).toBe(true)
        expect(dict.reportPanels?.[k.slice('reportPanels.'.length)], `${path} ${k}`).toBeTruthy()
      }
    }
  })
})
