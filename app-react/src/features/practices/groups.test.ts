import { describe, it, expect } from 'vitest'
import { groupPractices, todaySections, layoutOf, moveToGroupEnd } from './groups'
import type { PracticeGroup } from '../../types/api'
import type { UserPractice } from '../../types/api'

const def: PracticeGroup = { id: null, name: 'Practices', is_default: true }
const m: PracticeGroup = { id: 'm', name: 'Morning', is_default: false }
const e: PracticeGroup = { id: 'e', name: 'Empty', is_default: false }
const p = (id: string, group_id?: string | null, is_active = true): UserPractice =>
  ({ id, practice: id, data_type: 'Int', is_active, group_id })
const A = p('A', null)
const B = p('B', 'm')
const shape = (s: { group: PracticeGroup; practices: UserPractice[] }[]) =>
  s.map((x) => [x.group.id, x.practices.map((y) => y.id)])

describe('groups', () => {
  it('puts practices under their groups in group order', () => {
    expect(shape(groupPractices([m, def], [A, B]))).toEqual([['m', ['B']], [null, ['A']]])
  })
  it('unknown group falls back to default', () => {
    expect(shape(groupPractices([m, def], [A, p('B', 'gone')]))).toEqual([['m', []], [null, ['A', 'B']]])
  })
  it('adds a missing default group first', () => {
    const s = groupPractices([], [A, p('B')])
    expect(shape(s)).toEqual([[null, ['A', 'B']]])
    expect(s[0].group.is_default).toBe(true)
  })
  it('keeps empty groups', () => {
    expect(shape(groupPractices([def, e], [A]))).toEqual([[null, ['A']], ['e', []]])
  })
  it('todaySections drops groups with no active practices', () => {
    expect(shape(todaySections([m, def], [A, p('B', 'm', false)]))).toEqual([[null, ['A']]])
  })
  it('layoutOf flattens in section order', () => {
    expect(layoutOf(groupPractices([m, def], [A, B]))).toEqual({
      groups: ['m', null],
      practices: [{ id: 'B', group_id: 'm' }, { id: 'A', group_id: null }],
    })
  })
  it('moveToGroupEnd moves a practice to the end of another group', () => {
    const s = groupPractices([m, def], [A, B, p('C', 'm')])
    expect(shape(moveToGroupEnd(s, 'B', null))).toEqual([['m', ['C']], [null, ['A', 'B']]])
  })
})
