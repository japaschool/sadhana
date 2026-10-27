import { describe, expect, it } from 'vitest'
import { assignAxes, axisUse, landing, withLandedAxes } from './axes'

const unset = (dataType: 'Int' | 'Duration' | 'Time' | 'Bool') => ({ dataType, yAxis: null })
const on = (dataType: 'Int' | 'Duration' | 'Time' | 'Bool', yAxis: string) => ({ dataType, yAxis })

describe('assignAxes', () => {
  it('puts an unset axis on Left, like the Yew chart', () => {
    expect(assignAxes([unset('Int'), on('Int', 'Y4'), unset('Time'), on('Bool', 'Y2')])).toEqual(['Y', 'Y4', 'Y', 'Y2'])
  })
  it('says where a new series lands', () => {
    const s = [unset('Duration'), on('Time', 'Y2')]
    expect(landing(s, 'Time')).toEqual({ axis: 'Y2', shared: true })
    expect(landing(s, 'Duration')).toEqual({ axis: 'Y', shared: true })
    expect(landing(s, 'Int')).toEqual({ axis: 'Y3', shared: false })
    expect(landing([], 'Int')).toEqual({ axis: 'Y', shared: false })
  })
  it('spreads types over axes when every series lands in turn', () => {
    expect(withLandedAxes([unset('Duration'), unset('Duration'), unset('Time'), unset('Int')]).map((s) => s.yAxis))
      .toEqual(['Y', 'Y', 'Y2', 'Y3'])
  })
  it('lists the axes other series hold', () => {
    expect([...axisUse([unset('Duration'), on('Time', 'Y2')], 1)]).toEqual([['Y', 'Duration']])
  })
})
