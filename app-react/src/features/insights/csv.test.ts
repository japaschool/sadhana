import { describe, expect, it } from 'vitest'
import { toCSV } from './csv'
import { readCsv, toDays } from '../settings/csvImport'
import type { PracticeDataType, UserPractice } from '../../types/api'

const practice = (name: string, data_type: PracticeDataType) => ({ id: name, practice: name, data_type, is_active: true }) as UserPractice

describe('toCSV', () => {
  it('writes a column per practice that the import reads back', () => {
    const csv = toCSV([
      { cob_date: '2026-10-01', practice: 'Rounds', value: { Int: 16 } },
      { cob_date: '2026-10-01', practice: 'Wake up', value: { Time: { h: 4, m: 5 } } },
      { cob_date: '2026-10-01', practice: 'Reading', value: { Duration: 120 } },
      { cob_date: '2026-10-01', practice: 'Notes, "quoted"', value: { Text: 'a, b\nc' } },
      { cob_date: '2026-10-01', practice: 'Service', value: { Bool: true } },
      { cob_date: '2026-10-02', practice: 'Rounds', value: null },
      { cob_date: '2026-10-02', practice: 'Wake up', value: null },
      { cob_date: '2026-10-02', practice: 'Reading', value: { Duration: 45 } },
      { cob_date: '2026-10-02', practice: 'Notes, "quoted"', value: null },
      { cob_date: '2026-10-02', practice: 'Service', value: { Bool: false } },
    ])
    expect(csv.split('\n')[0]).toBe('date,Rounds,Wake up,Reading,"Notes, ""quoted""",Service')
    expect(csv.split('\n')[1]).toBe('2026-10-01,16,04:05,2:00,"a, b')

    const file = readCsv(csv, [practice('Rounds', 'Int'), practice('Wake up', 'Time'), practice('Reading', 'Duration'),
      practice('Notes, "quoted"', 'Text'), practice('Service', 'Bool')])
    const { days, errors } = toDays(file)
    expect(errors).toEqual([])
    expect(days).toEqual([
      { date: '2026-10-01', entries: [
        { practice: 'Rounds', value: { Int: 16 } },
        { practice: 'Wake up', value: { Time: { h: 4, m: 5 } } },
        { practice: 'Reading', value: { Duration: 120 } },
        { practice: 'Notes, "quoted"', value: { Text: 'a, b\nc' } },
        { practice: 'Service', value: { Bool: true } },
      ] },
      { date: '2026-10-02', entries: [
        { practice: 'Rounds', value: null },
        { practice: 'Wake up', value: null },
        { practice: 'Reading', value: { Duration: 45 } },
        { practice: 'Notes, "quoted"', value: null },
        { practice: 'Service', value: null },
      ] },
    ])
  })
})
