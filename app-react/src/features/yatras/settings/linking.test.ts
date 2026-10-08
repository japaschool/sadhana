import { afterEach, describe, expect, it } from 'vitest'
import type { PracticeDataType, UserPractice, YatraUserPracticeItem } from '../../../types/api'
import { dismissLater, laterDismissed, pickerGroups, suggestions, unlinked, withLink, withLinks } from './linking'

const yp = (id: string, practice: string, data_type: PracticeDataType, user_practice: string | null = null): YatraUserPracticeItem =>
  ({ yatra_practice: { id, practice, data_type }, user_practice })
const up = (practice: string, data_type: PracticeDataType, is_active = true): UserPractice =>
  ({ id: practice, practice, data_type, is_active })

describe('suggestions', () => {
  it('prefers an exact name, then a shared word, same type and active only', () => {
    const items = [yp('a', 'Japa rounds', 'Int'), yp('b', 'Reading', 'Duration'), yp('c', 'Wake up', 'Time')]
    const mine = [up('Rounds of japa', 'Int'), up('japa rounds ', 'Int'), up('Book reading', 'Duration'), up('Wake up', 'Duration')]
    const s = suggestions(items, mine)
    expect(s.get('a')?.practice).toBe('japa rounds ')
    expect(s.get('b')?.practice).toBe('Book reading')
    expect(s.has('c')).toBe(false) // same name, wrong type
  })

  it('skips practices already linked in this yatra and rows already linked', () => {
    const items = [yp('a', 'Reading', 'Duration', 'Book reading'), yp('b', 'Book reading', 'Duration')]
    expect(suggestions(items, [up('Book reading', 'Duration')]).size).toBe(0)
  })

  it('skips inactive practices and words under 4 letters', () => {
    const items = [yp('a', 'Japa', 'Int'), yp('b', 'Go to bed', 'Time')]
    expect(suggestions(items, [up('Japa', 'Int', false), up('Bed at', 'Time')]).size).toBe(0)
  })

  it('pairs a plural with its singular', () => {
    expect(suggestions([yp('a', 'Hearing lectures', 'Duration')], [up('Lecture listening', 'Duration')]).get('a')?.practice).toBe('Lecture listening')
  })

  it('matches Cyrillic words', () => {
    expect(suggestions([yp('a', 'Чтение', 'Duration')], [up('Чтение книг', 'Duration')]).get('a')?.practice).toBe('Чтение книг')
  })

  it('suggests one user practice for one yatra practice only, first in order', () => {
    const items = [yp('a', 'Reading', 'Duration'), yp('b', 'Reading SB', 'Duration')]
    const s = suggestions(items, [up('Reading', 'Duration')])
    expect([...s.keys()]).toEqual(['a'])
  })
})

describe('link edits', () => {
  const items = [yp('a', 'Reading', 'Duration', 'Book reading'), yp('b', 'Lectures', 'Duration')]

  it('withLink moves a practice linked elsewhere', () => {
    expect(withLink(items, 'b', 'Book reading').map((i) => i.user_practice)).toEqual([null, 'Book reading'])
  })

  it('withLink(null) unlinks', () => {
    expect(withLink(items, 'a', null).map((i) => i.user_practice)).toEqual([null, null])
  })

  it('withLinks applies several and unlinked lists the rest', () => {
    const next = withLinks(items, new Map([['b', up('Lecture listening', 'Duration')]]))
    expect(next.map((i) => i.user_practice)).toEqual(['Book reading', 'Lecture listening'])
    expect(unlinked(items).map((p) => p.id)).toEqual(['b'])
  })
})

describe('pickerGroups', () => {
  it('groups suggested, compatible, linked elsewhere and can-not-link with reasons', () => {
    const items = [yp('a', 'Reading', 'Duration', 'Book reading'), yp('b', 'Hearing lectures', 'Duration')]
    const mine = [
      up('Lecture listening', 'Duration'), up('Kirtan time', 'Duration'), up('Book reading', 'Duration'),
      up('Wake-up time', 'Time'), up('Exercise', 'Duration', false),
    ]
    const g = pickerGroups(items, mine, 'b')
    expect(g.suggested?.practice).toBe('Lecture listening')
    expect(g.compatible.map((p) => p.practice)).toEqual(['Kirtan time'])
    expect(g.current).toBeNull()
    expect(g.linkedElsewhere.map((l) => [l.practice.practice, l.linkedTo.practice])).toEqual([['Book reading', 'Reading']])
    expect(g.cantLink.map((c) => [c.practice.practice, c.reason])).toEqual([['Wake-up time', 'type'], ['Exercise', 'inactive']])
  })

  it('reports the row\'s current practice separately', () => {
    const items = [yp('a', 'Reading', 'Duration', 'Book reading')]
    const g = pickerGroups(items, [up('Book reading', 'Duration')], 'a')
    expect(g.current?.practice).toBe('Book reading')
    expect(g.linkedElsewhere).toEqual([])
  })
})

describe('Later', () => {
  afterEach(() => localStorage.clear())
  it('stays dismissed for the same unlinked set, in any order, and comes back when it changes', () => {
    dismissLater('y1', ['b', 'a'])
    expect(laterDismissed('y1', ['a', 'b'])).toBe(true)
    expect(laterDismissed('y1', ['a'])).toBe(false)
    expect(laterDismissed('y2', ['a', 'b'])).toBe(false)
  })
})
