import { describe, it, expect } from 'vitest'

type Dict = { insights?: Record<string, string> }
const files = import.meta.glob<Dict>('../../../public/locales/*/translation.json', { eager: true, import: 'default' })

const KEYS = [
  'title', 'reports', 'range', 'range7d', 'range30d', 'range90d', 'range1y',
  'endingToday', 'endingOn', 'resetEnd', 'dailyAverage', 'average',
  'vsPrev7d', 'vsPrev30d', 'vsPrev90d', 'vsPrev1y', 'noData', 'loadFailed',
  'legend', 'tickMin', 'newChart', 'editReport', 'deleteReport',
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
