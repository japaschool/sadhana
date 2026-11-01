import { describe, it, expect, vi } from 'vitest'
import { sortReports, REPORTS_KEY, isPanels } from './useReports'
import type { Report } from '../../api/charts'

vi.mock('../../api/charts', () => ({ chartsApi: { getReports: vi.fn() } }))

const r = (name: string, definition: Report['definition'] = { Grid: { practices: [] } }): Report => ({ id: name, name, definition })
const PANELS = { Panels: { version: 1, template: null, required: [], panels: [] } }

describe('sortReports', () => {
  it('sorts across report types by name', () => {
    const list = [r('Zen'), r('Ambient', PANELS), r('Mid', { Graph: { bar_layout: 'Grouped', traces: [] } })]
    expect(sortReports(list, 'en').map((x) => x.name)).toEqual(['Ambient', 'Mid', 'Zen'])
  })

  it('uses the language’s collation', () => {
    const names = (l: string) => sortReports(['Яма', 'Ель', 'Ёлка'].map((n) => r(n)), l).map((x) => x.name)
    expect(names('ru')).toEqual(['Ёлка', 'Ель', 'Яма'])
  })

  it('ignores case', () => {
    expect(sortReports([r('Zen'), r('ambient')], 'en').map((x) => x.name)).toEqual(['ambient', 'Zen'])
  })

  it('leaves the input unmutated', () => {
    const list = [r('b'), r('a')]
    sortReports(list, 'en')
    expect(list.map((x) => x.name)).toEqual(['b', 'a'])
  })
})

describe('REPORTS_KEY', () => {
  // An older build reads ['reports'] from the shared IndexedDB cache and tracesFor throws on a Panels row.
  it('is not the key older builds read', () => {
    expect(REPORTS_KEY).not.toEqual(['reports'])
    expect(REPORTS_KEY[0]).toBe('reports')
  })
})

describe('isPanels', () => {
  it('tells panels reports apart', () => {
    expect(isPanels(r('p', PANELS))).toBe(true)
    expect(isPanels(r('g'))).toBe(false)
    expect(isPanels(null)).toBe(false)
  })
})
