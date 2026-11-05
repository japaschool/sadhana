import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useOverview } from './useOverview'
import type { MarkedPeriod } from '../../../api/markedPeriods'
import { addDays, toDateStr } from '../../today/date'
import { entries, FOUR, practice } from './fixtures'

vi.mock('../../../api/charts', () => ({ chartsApi: { getReports: vi.fn(), getReportData: vi.fn() } }))
vi.mock('../../../api/practices', () => ({ practicesApi: { getUserPractices: vi.fn() } }))
const markedPeriods = vi.fn()
vi.mock('../../../api/markedPeriods', () => ({ useMarkedPeriods: () => markedPeriods() }))
import { chartsApi } from '../../../api/charts'
import { practicesApi } from '../../../api/practices'

const charts = vi.mocked(chartsApi)
const practices = vi.mocked(practicesApi)

const SLEEP_REPORT = (bedtime: string, wake: string) => ({
  id: 'r1', name: 'Sleep',
  definition: { Panels: { version: 1, template: { Sleep: { bedtime, wake, nap: null, min: null, max: null } }, required: [], panels: [] } },
})
const OTHER = [practice('a', 'Alpha', 'Time'), practice('b', 'Beta', 'Time'), practice('rounds', 'Rounds', 'Int')]

function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  return renderHook(() => useOverview(), { wrapper })
}
const load = async (r: ReturnType<typeof setup>) => { await waitFor(() => expect(r.result.current.isLoading).toBe(false)) }
const hasSleep = (r: ReturnType<typeof setup>) => r.result.current.rows.some((x) => x.key === 'sleep')

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  markedPeriods.mockReturnValue({ periods: [], isLoading: false, isError: false })
  charts.getReports.mockResolvedValue([])
  charts.getReportData.mockResolvedValue([])
})

describe('useOverview', () => {
  it('uses_sleep_report_practices', async () => {
    practices.getUserPractices.mockResolvedValue(OTHER)
    charts.getReports.mockResolvedValue([SLEEP_REPORT('a', 'b')])
    const r = setup(); await load(r)
    expect(hasSleep(r)).toBe(true)
    expect(r.result.current.askSleep).toBe(false)
  })

  it('asks_when_no_match', async () => {
    practices.getUserPractices.mockResolvedValue(OTHER)
    const r = setup(); await load(r)
    expect(hasSleep(r)).toBe(false)
    expect(r.result.current.askSleep).toBe(true)
    expect(r.result.current.timePractices.map((p) => p.id)).toEqual(['a', 'b'])
  })

  it('stored_choice_wins', async () => {
    practices.getUserPractices.mockResolvedValue([...OTHER, practice('c', 'Gamma', 'Time')])
    charts.getReports.mockResolvedValue([SLEEP_REPORT('a', 'b')])
    localStorage.setItem('sadhana.insights', JSON.stringify({ sleep: { bedtime: 'b', wake: 'c', nap: null } }))
    const r = setup(); await load(r)
    expect(hasSleep(r)).toBe(true)
    expect(r.result.current.askSleep).toBe(false)
    expect(r.result.current.prefs.sleep).toEqual({ bedtime: 'b', wake: 'c', nap: null })
  })

  it('stale_choice_asks_again', async () => {
    practices.getUserPractices.mockResolvedValue(OTHER)
    localStorage.setItem('sadhana.insights', JSON.stringify({ sleep: { bedtime: 'gone', wake: 'b', nap: null } }))
    const r = setup(); await load(r)
    expect(hasSleep(r)).toBe(false)
    expect(r.result.current.askSleep).toBe(true)
  })

  it('stale_choice_ignores_report_and_default_names', async () => {
    practices.getUserPractices.mockResolvedValue(FOUR)
    charts.getReports.mockResolvedValue([SLEEP_REPORT('bed', 'wake')])
    localStorage.setItem('sadhana.insights', JSON.stringify({ sleep: { bedtime: 'gone', wake: 'wake', nap: null } }))
    const r = setup(); await load(r)
    expect(hasSleep(r)).toBe(false)
    expect(r.result.current.askSleep).toBe(true)
  })

  it('inactive_nap_is_dropped', async () => {
    practices.getUserPractices.mockResolvedValue([...OTHER, practice('n', 'Nap', 'Time', { is_active: false })])
    charts.getReportData.mockResolvedValue(entries({
      '2026-11-01': { Alpha: { Time: { h: 22, m: 0 } } },
      '2026-11-02': { Beta: { Time: { h: 4, m: 0 } }, Nap: { Time: { h: 1, m: 0 } } },
    }))
    localStorage.setItem('sadhana.insights', JSON.stringify({ sleep: { bedtime: 'a', wake: 'b', nap: 'n' } }))
    const r = setup(); await load(r)
    expect(hasSleep(r)).toBe(true)
    expect(r.result.current.askSleep).toBe(false)
    expect(r.result.current.series.get('sleep')!.get('2026-11-02')).toBe(360)
    expect(r.result.current.sleep).toEqual({ bedtime: 'a', wake: 'b', nap: null })
  })

  it('skip_hides_sleep_without_asking', async () => {
    practices.getUserPractices.mockResolvedValue(FOUR)
    localStorage.setItem('sadhana.insights', JSON.stringify({ sleep: 'skip' }))
    const r = setup(); await load(r)
    expect(hasSleep(r)).toBe(false)
    expect(r.result.current.askSleep).toBe(false)
  })

  it('no_time_practices_no_sleep_no_ask', async () => {
    practices.getUserPractices.mockResolvedValue([practice('rounds', 'Rounds', 'Int'), practice('a', 'Alpha', 'Time')])
    const r = setup(); await load(r)
    expect(hasSleep(r)).toBe(false)
    expect(r.result.current.askSleep).toBe(false)
  })

  it('suggestion_off_by_pref', async () => {
    practices.getUserPractices.mockResolvedValue(FOUR)
    localStorage.setItem('sadhana.insights', JSON.stringify({ suggest: false }))
    const r = setup(); await load(r)
    expect(r.result.current.suggestion).toBeNull()
  })

  describe('while marked periods are not known', () => {
    const day = (offset: number) => toDateStr(addDays(new Date(), offset))
    const open: MarkedPeriod = { id: 'p1', name: 'Night shifts', start_date: day(-40), end_date: null, exclude_from_usual: true }
    const shifted = () => {
      const days: Record<string, Record<string, unknown>> = {}
      for (let i = 60; i >= 0; i--) {
        const out = i <= 10
        days[day(-i)] = { 'Кругов за день': out ? 40 : 16 + (i % 3), 'Кругов до 7': out ? 20 : 8, 'Отбой': { Time: { h: 21, m: 45 } }, 'Подъём': { Time: { h: 4, m: 20 } } }
      }
      return entries(days)
    }

    it('suggestion_and_open_period_wait_for_them', async () => {
      practices.getUserPractices.mockResolvedValue(FOUR)
      charts.getReportData.mockResolvedValue(shifted())
      const known = setup(); await load(known)
      expect(known.result.current.suggestion).not.toBeNull()
      markedPeriods.mockReturnValue({ periods: [open], isLoading: false, isError: false })
      const asked = setup(); await load(asked)
      expect(asked.result.current.openPeriod?.id).toBe('p1')

      for (const state of [{ isLoading: true, isError: false }, { isLoading: false, isError: true }]) {
        markedPeriods.mockReturnValue({ periods: [open], ...state })
        const r = setup(); await load(r)
        expect(r.result.current.openPeriod).toBeNull()
        markedPeriods.mockReturnValue({ periods: [], ...state })
        const s = setup(); await load(s)
        expect(s.result.current.suggestion).toBeNull()
      }
    })
  })
})
