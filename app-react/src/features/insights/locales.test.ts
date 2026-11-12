import { describe, it, expect } from 'vitest'
import { durationPanels, gapsPanels, japaPanels, sleepPanels } from './panels/templates'

type Dict = { insights?: Record<string, string> & { overview?: Record<string, string> }; reportPanels?: Record<string, string>; templateForm?: Record<string, string> }
const files = import.meta.glob<Dict>('../../../public/locales/*/translation.json', { eager: true, import: 'default' })

const KEYS = [
  'title', 'reports', 'range', 'range7d', 'range30d', 'range90d', 'range1y', 'range2y', 'range3y', 'range5y', 'rangeall',
  'rangeLong2y', 'rangeLong3y', 'rangeLong5y', 'rangeLongall', 'moreRanges',
  'endingToday', 'endingOn', 'resetEnd', 'dailyAverage', 'average',
  'vsPrev7d', 'vsPrev30d', 'vsPrev90d', 'vsPrev1y', 'vsPrev2y', 'vsPrev3y', 'vsPrev5y', 'vsLastYear', 'noData', 'loadFailed',
  'legend', 'newChart', 'editReport', 'deleteReport', 'date', 'days_one', 'days_other',
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

describe('insights.overview.* translations', () => {
  it('has the same keys in en, ru and uk, plural forms aside', () => {
    const base = (d: Dict) => [...new Set(Object.keys(d.insights?.overview ?? {}).map((k) => k.replace(/_(one|few|many|other)$/, '')))].sort()
    const dicts = Object.values(files)
    expect(base(dicts[0]).length).toBeGreaterThan(40)
    for (const d of dicts) expect(base(d)).toEqual(base(dicts[0]))
  })
})

describe('insights marked-period screens translations', () => {
  const nested = (d: Dict, ns: string) => (d.insights as unknown as Record<string, Record<string, string>>)[ns]
  const base = (o: Record<string, string>) => [...new Set(Object.keys(o).map((k) => k.replace(/_(one|few|many|other)$/, '')))].sort()

  it('has the same keys in en, ru and uk for periods, period, yearMap and rhythm', () => {
    const dicts = Object.values(files)
    for (const ns of ['periods', 'period', 'yearMap', 'rhythm']) {
      const keys = base(nested(dicts[0], ns))
      expect(keys.length, ns).toBeGreaterThan(5)
      for (const d of dicts) expect(base(nested(d, ns)), ns).toEqual(keys)
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
    walk(gapsPanels({ event: 'a', rows: ['b'], sleep: { bedtime: 'c', wake: 'd', nap: null } }))
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
  const TRADITIONAL = /japa|джап|rounds|круг|кола|(?<![\p{L}])кіл(?![\p{L}])/iu
  it('catches a standalone Ukrainian кіл but not Кількість', () => {
    expect('Середнє кіл').toMatch(TRADITIONAL)
    expect('Усього кіл').toMatch(TRADITIONAL)
    expect('Кількість').not.toMatch(TRADITIONAL)
  })
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
