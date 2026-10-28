import { describe, expect, it } from 'vitest'
import type { PracticeGroup, UserPractice } from '../../types/api'
import type { Section } from './groups'
import { dropGroup, dropPractice, flatItems } from './dragLayout'

const DEF: PracticeGroup = { id: null, name: '', is_default: true }
const AM: PracticeGroup = { id: 'g1', name: 'Morning', is_default: false }
const PM: PracticeGroup = { id: 'g2', name: 'Evening', is_default: false }
const p = (id: string, group_id: string | null = null): UserPractice => ({ id, practice: id, data_type: 'Int', is_active: true, group_id })

const SECTIONS: Section[] = [
  { group: AM, practices: [p('a', 'g1'), p('b', 'g1')] },
  { group: DEF, practices: [p('c'), p('d')] },
  { group: PM, practices: [] },
]
const shape = (ss: Section[]) => ss.map((s) => [s.group.id, ...s.practices.map((x) => `${x.id}:${x.group_id}`)])

describe('dragLayout', () => {
  it('lists headers, practices and empty drop zones in order', () => {
    expect(flatItems(SECTIONS, false)).toEqual(['hdr:g1', 'p:a', 'p:b', 'hdr:default', 'p:c', 'p:d', 'hdr:g2', 'empty:g2'])
  })

  it('dropping a practice on another group\'s row moves it into that group, at that position', () => {
    expect(shape(dropPractice(SECTIONS, 'p:a', 'p:c'))).toEqual([['g1', 'b:g1'], [null, 'c:null', 'a:null', 'd:null'], ['g2']])
    expect(shape(dropPractice(SECTIONS, 'p:d', 'p:b'))).toEqual([['g1', 'a:g1', 'd:g1', 'b:g1'], [null, 'c:null'], ['g2']])
  })

  it('dropping on an empty group\'s drop zone moves it there', () => {
    expect(shape(dropPractice(SECTIONS, 'p:a', 'empty:g2'))).toEqual([['g1', 'b:g1'], [null, 'c:null', 'd:null'], ['g2', 'a:g2']])
  })

  it('dropping above the first header lands first in the first group', () => {
    expect(shape(dropPractice(SECTIONS, 'p:c', 'hdr:g1'))).toEqual([['g1', 'c:g1', 'a:g1', 'b:g1'], [null, 'd:null'], ['g2']])
  })

  it('dropGroup reorders groups, including the default', () => {
    expect(dropGroup(SECTIONS, 'hdr:default', 'hdr:g1').map((s) => s.group.id)).toEqual([null, 'g1', 'g2'])
    expect(dropGroup(SECTIONS, 'hdr:g1', 'hdr:g2').map((s) => s.group.id)).toEqual([null, 'g2', 'g1'])
  })

  it('flatItems collapsed lists headers only', () => {
    expect(flatItems(SECTIONS, true)).toEqual(['hdr:g1', 'hdr:default', 'hdr:g2'])
  })
})
