import { describe, expect, it } from 'vitest'
import { addDays, fromDateStr, toDateStr } from '../../today/date'
import { TODAY } from './fixtures'
import { monthCount, runs, welcomeBack } from './streaks'

const day = (offset: number) => toDateStr(addDays(fromDateStr(TODAY), offset))
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => day(from + i))

describe('runs', () => {
  it('current_run_survives_today_unlogged', () => {
    expect(runs(range(-5, -1), TODAY).current).toEqual({ start: day(-5), end: day(-1), length: 5 })
    expect(runs(range(-5, 0), TODAY).current?.length).toBe(6)
    expect(runs(range(-5, -2), TODAY).current).toBeNull()
  })

  it('longest_run_this_year', () => {
    const logged = [...range(-320, -250), ...range(-8, -1)] // the first is partly before Jan 1 (day -308)
    const longest = runs(logged, TODAY).longest!
    expect(longest).toEqual({ start: '2026-01-01', end: day(-250), length: 59 })
    expect(runs([], TODAY)).toEqual({ current: null, longest: null })
  })
})

describe('welcomeBack', () => {
  it('welcome_back_after_3_day_gap', () => {
    expect(welcomeBack([day(-5), day(-3), day(-2), day(0)], TODAY)).toBe(false)
    expect(welcomeBack([day(-5), day(-4), day(0)], TODAY)).toBe(true)
    expect(welcomeBack([day(-6), day(-5), day(-1)], TODAY)).toBe(true)
    expect(welcomeBack([day(-5), day(-3), day(0)], TODAY)).toBe(false)
    expect(welcomeBack([day(-5), day(-4)], TODAY)).toBe(false)
    expect(welcomeBack([day(0)], TODAY)).toBe(false)
  })
})

describe('monthCount', () => {
  it('counts_logged_days_in_month', () => {
    expect(monthCount(['2026-10-30', '2026-11-01', '2026-11-04'], '2026-11')).toBe(2)
  })
})
