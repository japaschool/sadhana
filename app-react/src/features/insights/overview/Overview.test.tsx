import { fireEvent, render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SleepRows } from '../../../api/charts'
import type { MarkedPeriod } from '../../../api/markedPeriods'
import type { UserPractice } from '../../../types/api'
import { setViewportWidth } from '../../../test/viewport'
import { addDays, fromDateStr, toDateStr } from '../../today/date'
import { entries, FOUR, TODAY } from './fixtures'
import { DEFAULT_PREFS, type InsightPrefs } from './prefs'
import { insightRows, loggedDays, rowSeries } from './series'
import type { Suggestion } from './suggest'
import { isRegular, meVsNormal } from './usual'

vi.mock('./useOverview', () => ({ useOverview: vi.fn() }))
const save = vi.fn()
vi.mock('../../../api/markedPeriods', () => ({
  useSavePeriod: () => ({ mutate: save, isPending: false }),
  useDeletePeriod: () => ({ mutate: vi.fn(), isPending: false }),
  useMarkedPeriods: () => ({ periods: [], isLoading: false }),
}))
vi.mock('../../../api/charts', () => ({ chartsApi: { getReports: vi.fn(async () => []), getReportData: vi.fn(async () => []), deleteReport: vi.fn() } }))
vi.mock('../../../api/practices', () => ({
  practicesApi: { getUserPractices: vi.fn(async () => []), getIncompleteDays: vi.fn(async () => []), getGroups: vi.fn(async () => []) },
}))
import { useOverview } from './useOverview'
import { OverviewMobile } from './OverviewMobile'
import { PeriodSheet } from './PeriodSheet'
import { InsightsMobileScreen } from '../mobile/InsightsMobile'
import { InsightsTabletScreen } from '../tablet/InsightsTablet'
import { InsightsDesktopScreen } from '../desktop/InsightsDesktop'

const T = (h: number, m: number) => ({ Time: { h, m } })
const day = (offset: number, from = TODAY) => toDateStr(addDays(fromDateStr(from), offset))
const SLEEP: SleepRows = { bedtime: 'bed', wake: 'wake', nap: null }

/** useOverview's result, computed from raw days by the real logic. */
function overview(days: Record<string, Record<string, unknown>>, opts: {
  todayCob?: string; practices?: UserPractice[]; sleep?: SleepRows | null; prefs?: Partial<InsightPrefs>
  suggestion?: Suggestion | null; askSleep?: boolean; periods?: MarkedPeriod[]; openPeriod?: MarkedPeriod | null
} = {}) {
  const todayCob = opts.todayCob ?? TODAY
  const practices = opts.practices ?? FOUR
  const sleep = opts.sleep === undefined ? SLEEP : opts.sleep
  const data = entries(days)
  const rows = insightRows(practices, sleep)
  const series = rowSeries(rows, data, practices, sleep, todayCob)
  const logged = loggedDays(data, todayCob)
  const periods = opts.periods ?? []
  const normal = meVsNormal(rows, series, periods, todayCob)
  const setPrefs = vi.fn()
  const value = {
    isLoading: false, isError: false, todayCob, rows, series, logged, normal,
    regular: isRegular(normal, logged, todayCob), suggestion: opts.suggestion ?? null, openPeriod: opts.openPeriod ?? null, periods,
    sleep, askSleep: opts.askSleep ?? false, timePractices: practices.filter((p) => p.data_type === 'Time'), practices,
    prefs: { ...DEFAULT_PREFS, ...opts.prefs }, setPrefs,
  }
  vi.mocked(useOverview).mockReturnValue(value as ReturnType<typeof useOverview>)
  return value
}

/** 60 steady days: wake 4:20, bed 21:45, 16 rounds, 8 before 7; the last 7 days `recent` overrides. */
function steady(recent: (offset: number) => Record<string, unknown> | null = () => null) {
  const days: Record<string, Record<string, unknown>> = {}
  for (let i = 60; i >= 1; i--) {
    const usual = { 'Отбой': T(21, 45 + (i % 3) - 1), 'Подъём': T(4, 20 + (i % 3) - 1), 'Кругов за день': 16 + (i % 3) - 1, 'Кругов до 7': 8 }
    const r = i <= 7 ? recent(i) : usual
    if (r) days[day(-i)] = r
  }
  return days
}

function wrap(children: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}><MemoryRouter>{children}</MemoryRouter></QueryClientProvider>)
}

beforeEach(() => { vi.clearAllMocks(); save.mockReset(); setViewportWidth(390) })
afterEach(() => localStorage.clear())

describe('Overview (mobile)', () => {
  it('regular_view_shows_rows_and_words', () => {
    overview(steady(() => ({ 'Отбой': T(21, 45), 'Подъём': T(3, 25), 'Кругов за день': 22, 'Кругов до 7': 8 })))
    wrap(<OverviewMobile />)
    const card = screen.getByRole('region', { name: 'Me vs my normal' })
    const wake = within(card).getByRole('group', { name: 'Подъём' })
    expect(wake).toHaveTextContent('03:25')
    expect(wake).toHaveTextContent('Usual 04:20 · 04:19–04:21')
    expect(wake).toHaveTextContent('Earlier')
    expect(within(card).getByRole('group', { name: 'Кругов за день' })).toHaveTextContent('Above usual')
    expect(within(card).getByRole('group', { name: 'Отбой' })).toHaveTextContent(/Usual$/)
    const sleep = within(card).getByRole('group', { name: /Sleep/ })
    expect(sleep).toHaveTextContent('calculated')
    expect(sleep).toHaveTextContent('5h 40m') // 21:45 → 3:25 each night of the last week
    expect(screen.getByRole('link', { name: /Year map/ })).toHaveAttribute('href', '/insights/year')
    expect(screen.getByRole('link', { name: /Rhythm fingerprint/ })).toHaveAttribute('href', '/insights/rhythm')
  })

  it('thin_week_shows_no_word', () => {
    // 2 logged days in the last week; the week before keeps 3+ days in the last 14.
    overview(steady((i) => (i === 2 || i === 5 ? { 'Отбой': T(21, 45), 'Подъём': T(4, 20), 'Кругов за день': 16, 'Кругов до 7': 8 } : null)))
    wrap(<OverviewMobile />)
    const rounds = screen.getByRole('group', { name: 'Кругов за день' })
    expect(rounds).toHaveTextContent('—')
    expect(rounds).toHaveTextContent('Not enough recent days · 2 of the last 7 days logged')
    for (const w of ['Usual', 'Above usual', 'Below usual', 'Earlier', 'Later']) {
      expect(within(rounds).queryByText(w)).toBeNull()
    }
    expect(rounds.querySelector('[data-dot="now"]')).toBeNull()
  })

  // Sep: 5 days; Oct 1–7 and today (Oct 31): 8 days, back after a gap.
  const sparse = () => {
    const days: Record<string, Record<string, unknown>> = {}
    const d = { 'Отбой': T(22, 40), 'Подъём': T(6, 10), 'Кругов за день': 8, 'Кругов до 7': 4 }
    for (const cob of ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05',
      '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07']) days[cob] = d
    days['2026-10-31'] = { 'Подъём': T(6, 10) }
    return days
  }

  it('less_regular_view_for_8_days', () => {
    const eight: Record<string, Record<string, unknown>> = {}
    for (let d = 10; d <= 17; d++) eight[`2026-10-${d}`] = { 'Отбой': T(22, 40), 'Подъём': T(6, 10), 'Кругов за день': 8, 'Кругов до 7': 4 }
    overview(eight, { todayCob: '2026-10-31' })
    wrap(<OverviewMobile />)
    expect(screen.queryByText(/Good to see you back/)).toBeNull() // last logged two weeks ago, not back yet
    const days = screen.getByRole('region', { name: 'Days practised' })
    expect(within(days).getByTestId('month-count')).toHaveTextContent('8')
    expect(days.querySelectorAll('[data-logged="true"]')).toHaveLength(8)
    const avg = screen.getByRole('region', { name: 'On days you practise' })
    expect(within(avg).getByRole('group', { name: 'Подъём' })).toHaveTextContent('06:10')
    expect(within(avg).getByRole('group', { name: 'Кругов за день' })).toHaveTextContent('8')
    expect(within(avg).getByRole('group', { name: /Sleep/ })).toHaveTextContent('7h 30m')
    expect(within(avg).getByText('Plain averages of the 8 days you logged')).toBeInTheDocument()
    expect(screen.getByText('Me vs my normal shows up once you’ve logged 14 days. 8 so far.')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Me vs my normal' })).toBeNull()
  })

  it('returning_user_with_a_usual_window_is_told_what_brings_the_comparison_back', () => {
    const days: Record<string, Record<string, unknown>> = {}
    for (let i = 60; i >= 15; i--) days[day(-i)] = { 'Подъём': T(6, 10), 'Кругов за день': 16 }
    overview(days)
    wrap(<OverviewMobile />)
    expect(screen.getByText('Me vs my normal comes back once you’ve logged 3 days in the last two weeks.')).toBeInTheDocument()
    expect(screen.queryByText(/so far/)).toBeNull()
  })

  it('days_practised_shows_last_months_count_beside_this_months', () => {
    overview(sparse(), { todayCob: '2026-10-31' })
    wrap(<OverviewMobile />)
    expect(within(screen.getByRole('region', { name: 'Days practised' })).getByText('5 last month')).toBeInTheDocument()
  })

  it('welcome_back_and_counts_of_past_days', () => {
    overview(sparse(), { todayCob: '2026-10-31' })
    wrap(<OverviewMobile />)
    expect(screen.getByText('Good to see you back. You’ve logged 8 days this month, 3 more than last month.')).toBeInTheDocument()
    // Today is left out of the averages and of the usual window.
    expect(screen.getByText('Plain averages of the 12 days you logged')).toBeInTheDocument()
    expect(screen.getByText('Me vs my normal shows up once you’ve logged 14 days. 12 so far.')).toBeInTheDocument()
  })

  it('streaks_hidden_by_default_shown_when_on', () => {
    overview(sparse(), { todayCob: '2026-10-31' })
    const { unmount } = wrap(<OverviewMobile />)
    expect(screen.queryByText('Current run')).toBeNull()
    unmount()
    overview(sparse(), { todayCob: '2026-10-31', prefs: { streaks: true } })
    wrap(<OverviewMobile />)
    expect(screen.getByText('Current run').parentElement).toHaveTextContent('1')
    expect(screen.getByText('Longest run this year').parentElement).toHaveTextContent('7')
  })

  const SUGGESTION = { start: '2026-10-25', rows: ['wake', 'bed'] }

  it('not_now_dismisses', () => {
    const ov = overview(steady(), { suggestion: SUGGESTION, prefs: { dismissed: ['2026-01-01'] } })
    wrap(<OverviewMobile />)
    expect(screen.getByText('Something changed around Oct 25. Want to name it?')).toBeInTheDocument()
    expect(screen.getByText('Подъём and Отбой all moved that week.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }))
    expect(ov.setPrefs).toHaveBeenCalledWith({ dismissed: ['2026-01-01', '2026-10-25'] })
  })

  it('mark_this_period_prefills_start', () => {
    overview(steady(), { suggestion: SUGGESTION })
    wrap(<OverviewMobile />)
    fireEvent.click(screen.getByRole('button', { name: 'Mark this period' }))
    const sheet = screen.getByRole('dialog', { name: 'New period' })
    expect(within(sheet).getByLabelText('Start')).toHaveValue('2026-10-25')
    expect(within(sheet).getByLabelText('End')).toHaveValue('')
    expect(within(sheet).getByText('Still going')).toBeInTheDocument()
    expect(within(sheet).getByRole('switch', { name: 'Leave out of my usual range' })).toHaveAttribute('aria-checked', 'true')
  })

  it('sleep_sheet_save_and_skip', () => {
    const ov = overview(steady(), { sleep: null, askSleep: true })
    const { unmount } = wrap(<OverviewMobile />)
    const sheet = screen.getByRole('dialog', { name: 'Which practices are your bedtime and wake-up?' })
    expect(within(sheet).getByRole('button', { name: 'Save' })).toBeDisabled() // nothing guessed
    fireEvent.change(within(sheet).getByLabelText('Bedtime'), { target: { value: 'wake' } })
    fireEvent.change(within(sheet).getByLabelText('Wake-up'), { target: { value: 'wake' } })
    expect(within(sheet).getByRole('button', { name: 'Save' })).toBeDisabled() // the same practice twice
    fireEvent.change(within(sheet).getByLabelText('Bedtime'), { target: { value: 'bed' } })
    fireEvent.change(within(sheet).getByLabelText('Wake-up'), { target: { value: 'wake' } })
    fireEvent.click(within(sheet).getByRole('button', { name: 'Save' }))
    expect(ov.setPrefs).toHaveBeenCalledWith({ sleep: { bedtime: 'bed', wake: 'wake', nap: null } })
    unmount()
    const ov2 = overview(steady(), { sleep: null, askSleep: true })
    wrap(<OverviewMobile />)
    fireEvent.click(screen.getByRole('button', { name: 'Skip for now' }))
    expect(ov2.setPrefs).toHaveBeenCalledWith({ sleep: 'skip' })
  })

  it('period_sheet_validates_name_and_dates', () => {
    wrap(<PeriodSheet onClose={() => {}} prefill={{ start_date: '2026-10-25' }} />)
    const saveBtn = screen.getByRole('button', { name: 'Save period' })
    expect(saveBtn).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '   ' } })
    expect(saveBtn).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: ' Retreat ' } })
    expect(saveBtn).toBeEnabled()
    fireEvent.change(screen.getByLabelText('End'), { target: { value: '2026-10-20' } })
    expect(saveBtn).toBeDisabled()
    fireEvent.change(screen.getByLabelText('End'), { target: { value: '2026-10-30' } })
    fireEvent.click(saveBtn)
    expect(save).toHaveBeenCalledWith(
      { id: undefined, form: { name: 'Retreat', start_date: '2026-10-25', end_date: '2026-10-30', exclude_from_usual: true } },
      expect.anything(),
    )
  })

  it('hollow_dot_for_a_recent_period', () => {
    const retreat: MarkedPeriod = { id: 'r', name: 'Retreat', start_date: day(-20), end_date: day(-10), exclude_from_usual: true }
    overview(steady(() => ({ 'Отбой': T(21, 45), 'Подъём': T(3, 25), 'Кругов за день': 22, 'Кругов до 7': 8 })), { periods: [retreat] })
    wrap(<OverviewMobile />)
    const wake = screen.getByRole('group', { name: 'Подъём' })
    expect(wake.querySelector('[data-dot="hollow"]')).not.toBeNull()
    expect(wake.querySelector('[data-dot="now"]')).not.toBeNull()
    expect(wake).toHaveTextContent('Earlier')
    expect(screen.getByRole('region', { name: 'Me vs my normal' })).toHaveTextContent('Retreat, Oct 16 – Oct 26')
  })

  const OPEN: MarkedPeriod = { id: 'p1', name: 'Autumn fast', start_date: '2026-09-01', end_date: null, exclude_from_usual: true }

  it('open_period_yes_and_ended_without_end', () => {
    save.mockImplementation((_v, o: { onSuccess: () => void }) => o.onSuccess())
    const ov = overview(steady(), { openPeriod: OPEN, prefs: { openAsked: { other: '2026-01-01' } } })
    wrap(<OverviewMobile />)
    expect(screen.getByText('Is Autumn fast still going?')).toBeInTheDocument()
    expect(screen.getByText('Started Sep 1, 65 days ago.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }))
    expect(ov.setPrefs).toHaveBeenLastCalledWith({ openAsked: { other: '2026-01-01', p1: TODAY } })
    ov.setPrefs.mockClear()
    fireEvent.click(screen.getByRole('button', { name: 'It ended on…' }))
    const sheet = screen.getByRole('dialog', { name: 'Autumn fast' })
    expect(within(sheet).getByLabelText('End')).toHaveFocus()
    fireEvent.click(within(sheet).getByRole('button', { name: 'Save period' }))
    expect(ov.setPrefs).toHaveBeenCalledWith({ openAsked: { other: '2026-01-01', p1: TODAY } })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('period_sheet_save_error_keeps_sheet_open', () => {
    save.mockImplementation((_v, o: { onError: () => void }) => o.onError())
    const onClose = vi.fn()
    wrap(<PeriodSheet onClose={onClose} period={OPEN} />)
    fireEvent.click(screen.getByRole('button', { name: 'Save period' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong')
    expect(screen.getByRole('dialog', { name: 'Autumn fast' })).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('opens_on_overview_and_switches_to_charts', async () => {
    overview(steady())
    wrap(<InsightsMobileScreen />)
    expect(screen.getByRole('radio', { name: 'Overview' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('region', { name: 'Me vs my normal' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: 'Charts' }))
    expect(await screen.findByRole('button', { name: /^All practices/ })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Me vs my normal' })).toBeNull()
  })
})

describe.each([['tablet', 834, InsightsTabletScreen], ['desktop', 1440, InsightsDesktopScreen]] as const)('Overview (%s)', (_name, width, Screen) => {
  it('opens_on_overview_with_columns_and_switches_to_charts', async () => {
    setViewportWidth(width)
    overview(steady(() => ({ 'Отбой': T(21, 45), 'Подъём': T(3, 25), 'Кругов за день': 22, 'Кругов до 7': 8 })), { suggestion: { start: '2026-10-25', rows: ['wake', 'bed'] } })
    wrap(<Screen />)
    expect(screen.getByRole('radio', { name: 'Overview' })).toHaveAttribute('aria-checked', 'true')
    const card = screen.getByRole('region', { name: 'Me vs my normal' })
    expect(within(card).getByRole('group', { name: 'Подъём' })).toHaveTextContent('03:25')
    expect(within(card).getByText('Now')).toBeInTheDocument() // the columns header
    expect(screen.getByText('Something changed around Oct 25. Want to name it?')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Year map/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: 'Charts' }))
    expect(await screen.findByRole('button', { name: /^All practices/ })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Me vs my normal' })).toBeNull()
  })

  it('less_regular_shows_days_practised', () => {
    setViewportWidth(width)
    overview({ [day(-3)]: { 'Подъём': T(6, 10) } })
    wrap(<Screen />)
    expect(screen.getByRole('region', { name: 'Days practised' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Me vs my normal' })).toBeNull()
  })
})
