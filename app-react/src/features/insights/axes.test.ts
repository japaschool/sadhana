import { describe, expect, it } from 'vitest'
import { assignAxes, axisUse, landing } from './axes'

const auto = (dataType: 'Int' | 'Duration' | 'Time' | 'Bool') => ({ dataType, yAxis: null })

describe('assignAxes', () => {
  it('gives each type the first free axis and shares it within a type', () => {
    expect(assignAxes([auto('Duration'), auto('Duration'), auto('Time'), auto('Int')])).toEqual(['Y', 'Y', 'Y2', 'Y3'])
  })
  it('keeps manual axes and works around them', () => {
    expect(assignAxes([auto('Duration'), { dataType: 'Time', yAxis: 'Y' }])).toEqual(['Y2', 'Y'])
  })
  it('says where a new series lands', () => {
    const s = [auto('Duration'), auto('Time')]
    expect(landing(s, 'Time')).toEqual({ axis: 'Y2', shared: true })
    expect(landing(s, 'Int')).toEqual({ axis: 'Y3', shared: false })
  })
  it('lists the axes other series hold', () => {
    expect([...axisUse([auto('Duration'), auto('Time')], 1)]).toEqual([['Y', 'Duration']])
  })
})
