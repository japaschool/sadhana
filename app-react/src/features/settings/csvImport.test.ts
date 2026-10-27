import { describe, expect, it } from 'vitest'
import type { UserPractice } from '../../types/api'
import { parseCsv, parseValue, readCsv, toDays } from './csvImport'

const practice = (practice: string, data_type: UserPractice['data_type']): UserPractice => ({ id: practice, practice, data_type, is_active: true })
const PRACTICES = [practice('Japa rounds', 'Int'), practice('Wake-up time', 'Time'), practice('Mangala arati', 'Bool'), practice('Reading', 'Duration')]

describe('parseCsv', () => {
  it('reads quotes, escaped quotes, commas in quotes, CRLF, a BOM, and drops blank lines', () => {
    expect(parseCsv('\uFEFFa,"b, c","say ""hi"""\r\n\r\n1,2,3\n')).toEqual([['a', 'b, c', 'say "hi"'], ['1', '2', '3']])
  })
})

describe('parseValue', () => {
  it('parses each type and rejects what it cannot read', () => {
    expect(parseValue('Int', '12')).toEqual({ Int: 12 })
    expect(parseValue('Int', '16 rounds')).toBeUndefined()
    expect(parseValue('Bool', 'TRUE')).toEqual({ Bool: true })
    expect(parseValue('Bool', '✓')).toEqual({ Bool: true })
    expect(parseValue('Bool', 'yes')).toBeUndefined()
    expect(parseValue('Time', '04:30')).toEqual({ Time: { h: 4, m: 30 } })
    expect(parseValue('Time', '25:00')).toBeUndefined()
    expect(parseValue('Duration', '45')).toEqual({ Duration: 45 })
    expect(parseValue('Duration', '1h 30m')).toEqual({ Duration: 90 })
    expect(parseValue('Duration', '1:30')).toEqual({ Duration: 90 })
    expect(parseValue('Duration', 'long')).toBeUndefined()
  })
})

describe('toDays', () => {
  it('matches columns by practice name; an empty cell clears; unmatched columns are skipped', () => {
    const file = readCsv('date,Japa rounds,Kirtan,Mangala arati\n2024-10-01,16,30,true\n2024-10-02,"12",,', PRACTICES)
    expect(file.columns).toEqual([{ name: 'Japa rounds', type: 'Int' }, { name: 'Kirtan', type: null }, { name: 'Mangala arati', type: 'Bool' }])
    expect(toDays(file)).toEqual({
      errors: [],
      days: [
        { date: '2024-10-01', entries: [{ practice: 'Japa rounds', value: { Int: 16 } }, { practice: 'Mangala arati', value: { Bool: true } }] },
        { date: '2024-10-02', entries: [{ practice: 'Japa rounds', value: { Int: 12 } }, { practice: 'Mangala arati', value: null }] },
      ],
    })
  })

  it('reports each failing row by its line in the file', () => {
    const file = readCsv('date,Japa rounds,Mangala arati\n2024-13-01,1,\n2024-10-02,2,yes\n2024-10-03,3,false', PRACTICES)
    expect(toDays(file).errors).toEqual([
      { line: 2, error: { kind: 'date', value: '2024-13-01' } },
      { line: 3, error: { kind: 'Bool', value: 'yes', column: 'Mangala arati' } },
    ])
  })
})
