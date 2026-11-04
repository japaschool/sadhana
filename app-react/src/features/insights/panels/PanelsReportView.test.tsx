import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cloneElement, type ReactElement, type ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import i18n from 'i18next'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ru from '../../../../public/locales/ru/translation.json'
import uk from '../../../../public/locales/uk/translation.json'
import type { Panel, PanelsReport, Report, ReportDataEntry, SleepTemplate } from '../../../api/charts'
import type { PracticeDataType, UserPractice } from '../../../types/api'
import { setViewportWidth } from '../../../test/viewport'
import { addDays, fromDateStr, toDateStr } from '../../today/date'
import { InsightsMobileScreen } from '../mobile/InsightsMobile'
import { InsightsTabletScreen } from '../tablet/InsightsTablet'
import { SharedDesktop, SharedMobile, SharedTablet } from '../../shared/SharedReports'
import { PanelsReportView } from './PanelsReportView'
import { labelText } from './panelLogic'
import { durationPanels, japaPanels, sleepPanels } from './templates'

// Recharts measures its container, which jsdom can't: give it a fixed size.
vi.mock('recharts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('recharts')>()),
  ResponsiveContainer: ({ children }: { children: ReactElement<{ width: number; height: number }> }) =>
    cloneElement(children, { width: 600, height: 300 }),
}))
vi.mock('../../../api/charts', () => ({
  chartsApi: {
    getReports: vi.fn(), getReportData: vi.fn(), deleteReport: vi.fn(),
    getSharedUser: vi.fn(), getSharedReports: vi.fn(), getSharedPractices: vi.fn(), getSharedReportData: vi.fn(),
  },
}))
vi.mock('../../../api/practices', () => ({
  practicesApi: { getUserPractices: vi.fn(), getIncompleteDays: vi.fn(), getDiaryEntries: vi.fn(), saveDiaryEntry: vi.fn() },
}))
import { chartsApi } from '../../../api/charts'
import { practicesApi } from '../../../api/practices'

const P = (id: string, practice: string, data_type: PracticeDataType, is_active = true): UserPractice =>
  ({ id, practice, data_type, is_active })
const BED = P('11111111-aaaa', 'Bed time', 'Time')
const WAKE = P('22222222-bbbb', 'Wake-up time', 'Time')
const NAP = P('33333333-cccc', 'Siesta', 'Duration')
const PRACTICES = [BED, WAKE, NAP]
const TODAY = '2026-10-06'
const T = (h: number, m = 0) => ({ Time: { h, m } })
const e = (cob_date: string, practice: string, value: unknown): ReportDataEntry => ({ cob_date, practice, value })
const dayAt = (cob: string, n: number) => toDateStr(addDays(fromDateStr(cob), n))

/** 30 nights to today: wake 07:00; 23:00 bed (480m) but 02:00 (300m) on 7 nights; one night has no wake-up. */
function nights(days = 30) {
  const window: string[] = Array.from({ length: days }, (_, i) => dayAt(TODAY, i - days + 1))
  const SHORT = new Set([1, 2, 3, 4, 5, 6, 7])
  const entries: ReportDataEntry[] = []
  window.forEach((cob, i) => {
    entries.push(e(cob, WAKE.practice, i === 19 ? null : T(7)))
    entries.push(e(cob, BED.practice, SHORT.has(i + 1) ? T(2) : T(23)))
  })
  // Night 28 had a nap: 480 + 60 is still in range.
  entries.push(e(window[28], NAP.practice, { Duration: 60 }))
  return { entries, previous: [e(dayAt(window[0], -1), BED.practice, T(23))] }
}

const tmpl = (over: Partial<SleepTemplate> = {}): SleepTemplate =>
  ({ bedtime: BED.id, wake: WAKE.id, nap: NAP.id, min: 360, max: 540, ...over })
const report = (definition: PanelsReport): Report => ({ id: 'r1', name: 'My sleep', definition: { Panels: definition } })

function view(over: { def?: PanelsReport; practices?: UserPractice[]; formLink?: string | null; days?: number } = {}) {
  const def = over.def ?? sleepPanels(tmpl())
  const { entries, previous } = nights(over.days)
  return render(
    <MemoryRouter>
      <PanelsReportView report={report(def)} definition={def} entries={entries} previous={previous}
        practices={over.practices ?? PRACTICES} todayCob={TODAY} chartHeight={300}
        formLink={over.formLink === undefined ? '/settings/charts/r1' : over.formLink} />
    </MemoryRouter>,
  )
}

const legends = () => screen.getAllByRole('list', { name: 'Key' })

describe('PanelsReportView', () => {
  afterEach(async () => { await i18n.changeLanguage('en') })

  it('a Sleep report shows its figures', () => {
    view()
    expect(screen.getByText('Average sleep').parentElement).toHaveTextContent('7h 18m')
    expect(screen.getByText('Night alone: 7h 16m')).toBeInTheDocument()
    expect(screen.getAllByText('Average bedtime')[0].parentElement).toHaveTextContent('23:43')
    expect(screen.getAllByText('Average wake-up')[0].parentElement).toHaveTextContent('07:00')
    expect(screen.getByText('Nights in range').parentElement).toHaveTextContent('22 of 29')
  })

  it('draws a chart per panel, with no bar for the missing night', () => {
    const { container } = view()
    expect(screen.getByRole('heading', { name: 'Sleep times' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Hours slept' })).toBeInTheDocument()
    const charts = container.querySelectorAll('.recharts-surface')
    expect(charts).toHaveLength(2)
    expect(charts[0].querySelectorAll('.recharts-bar-rectangle path')).toHaveLength(29)
    // 29 nights plus the one nap, stacked.
    expect(charts[1].querySelectorAll('.recharts-bar-rectangle path')).toHaveLength(30)
  })

  it('states read from the total: under is outlined, in range solid, over striped through a per-chart pattern', () => {
    const def = sleepPanels(tmpl({ min: 400, max: 450 }))
    const { container } = view({ def })
    const [times, hours] = [...container.querySelectorAll('.recharts-surface')]
    const fills = (el: Element) => [...el.querySelectorAll('.recharts-bar-rectangle path')].map((p) => p.getAttribute('fill'))
    const a = fills(times)
    expect(a.filter((f) => f === 'var(--ui-state-under-fill)')).toHaveLength(7)
    const stripes = a.filter((f) => f?.startsWith('url(#stripes-'))
    expect(stripes).toHaveLength(22)
    expect(times.querySelector(`pattern[id="${stripes[0]!.slice(5, -1)}"]`)).not.toBeNull()
    expect(container.querySelector('.recharts-bar-rectangle path[stroke="var(--ui-state-under)"]')).not.toBeNull()
    // Two charts, and the preview can mount a report twice: the ids can't collide.
    expect(fills(hours).find((f) => f?.startsWith('url('))).not.toBe(stripes[0])
  })

  it('both limits null: Nights logged, one neutral colour, no state rows', () => {
    const { container } = view({ def: sleepPanels(tmpl({ min: null, max: null })) })
    expect(screen.getByText('Nights logged').parentElement).toHaveTextContent('29 of 30')
    expect(screen.queryByText('Nights in range')).toBeNull()
    expect(screen.getByText('No target set, so every night is one colour')).toBeInTheDocument()
    expect(screen.queryByText(/^In range/)).toBeNull()
    expect(screen.queryByText(/^Under/)).toBeNull()
    expect(screen.queryByText(/^Over/)).toBeNull()
    const fills = new Set([...container.querySelectorAll('.recharts-bar-rectangle path')].map((p) => p.getAttribute('fill')))
    expect([...fills]).toEqual(['var(--ui-state-none)'])
  })

  it('one limit: the legend has that state only', () => {
    view({ def: sleepPanels(tmpl({ max: null })) })
    expect(within(legends()[0]).getByText('6h or more')).toBeInTheDocument()
    expect(within(legends()[0]).getByText('Under 6h')).toBeInTheDocument()
    expect(screen.queryByText(/^Over/)).toBeNull()
  })

  it('both limits: the legend names the range and the average lines', () => {
    view()
    const key = within(legends()[0])
    expect(key.getByText('In range · 6h–9h')).toBeInTheDocument()
    expect(key.getByText('Under 6h')).toBeInTheDocument()
    expect(key.getByText('Over 9h')).toBeInTheDocument()
    expect(key.getByText('Average bedtime')).toBeInTheDocument()
    expect(key.getByText('Average wake-up')).toBeInTheDocument()
    expect(within(legends()[1]).getByText('Nap — on top')).toBeInTheDocument()
  })

  it('a line without a label has no legend row', () => {
    const def = sleepPanels(tmpl())
    for (const p of def.panels) if (p.kind === 'Chart') p.lines.forEach((l) => { l.label = null })
    view({ def })
    const key = within(legends()[0])
    expect(key.queryByText('Average bedtime')).toBeNull()
    expect(key.queryByText('Average wake-up')).toBeNull()
    expect(key.getByText('Under 6h')).toBeInTheDocument()
  })

  it('a long range drops outlines and stripes for solid colours', () => {
    const { container } = view({ days: 121, def: sleepPanels(tmpl({ min: 400, max: 450 })) })
    const bars = [...container.querySelectorAll('.recharts-bar-rectangle path')]
    const fills = new Set(bars.map((p) => p.getAttribute('fill')))
    expect(fills).toEqual(new Set(['var(--ui-state-under-solid)', 'var(--ui-state-over-solid)']))
    expect(container.querySelector('.recharts-bar-rectangle path[stroke="var(--ui-state-under)"]')).toBeNull()
  })

  it('a deleted required practice names the form label and links to the form, never an id', () => {
    const { container } = view({ practices: [BED, NAP] })
    expect(screen.getByText(/needs a practice for “Wake-up”/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Choose a practice' })).toHaveAttribute('href', '/settings/charts/r1')
    expect(container).not.toHaveTextContent(WAKE.id)
    expect(container.querySelector('.recharts-surface')).toBeNull()
  })

  it('a hidden required practice reads the same', () => {
    view({ practices: [BED, { ...WAKE, is_active: false }, NAP] })
    expect(screen.getByText(/needs a practice for “Wake-up”/)).toBeInTheDocument()
  })

  it('a required practice retyped away from Time reads as missing, with the form link', () => {
    view({ practices: [BED, { ...WAKE, data_type: 'Int' }, NAP] })
    expect(screen.getByText(/needs a practice for “Wake-up”/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Choose a practice' })).toHaveAttribute('href', '/settings/charts/r1')
  })

  it('a nap retyped to a number keeps the night total, in the averages too', () => {
    const def = sleepPanels(tmpl())
    const { entries, previous } = nights()
    const retyped = entries.map((x) => (x.practice === NAP.practice ? { ...x, value: { Int: 60 } } : x))
    render(
      <MemoryRouter>
        <PanelsReportView report={report(def)} definition={def} entries={retyped} previous={previous}
          practices={[BED, WAKE, { ...NAP, data_type: 'Int' }]} todayCob={TODAY} chartHeight={300} formLink="/f" />
      </MemoryRouter>,
    )
    expect(screen.queryByText(/needs a practice/)).toBeNull()
    expect(screen.getByText('Average sleep').parentElement).toHaveTextContent('7h 16m')
    expect(screen.getByText('Nights in range').parentElement).toHaveTextContent('22 of 29')
  })

  it('four across: a long duration drops a size, a short one keeps it', async () => {
    view()
    expect(screen.getByText('7h 18m')).toHaveClass('text-[26px]')
    cleanup()
    i18n.addResourceBundle('uk', 'translation', uk, true, true)
    await i18n.changeLanguage('uk')
    view()
    expect(screen.getByText('7 год 18 хв')).toHaveClass('text-[20px]')
  })

  it('no form link on shared pages', () => {
    view({ practices: [BED, NAP], formLink: null })
    expect(screen.getByText(/needs a practice for “Wake-up”/)).toBeInTheDocument()
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('a missing optional nap: no message and no nap row', () => {
    view({ practices: [BED, WAKE] })
    expect(screen.queryByText(/needs a practice/)).toBeNull()
    expect(screen.queryByText(/Nap/)).toBeNull()
    expect(screen.queryByText(/Night alone/)).not.toBeNull()
    expect(screen.getByRole('heading', { name: 'Hours slept' })).toBeInTheDocument()
  })

  it('no nap practice at all: no night-only line', () => {
    view({ def: sleepPanels(tmpl({ nap: null })) })
    expect(screen.queryByText(/Night alone/)).toBeNull()
  })

  it('no data in the window still renders', () => {
    const def = sleepPanels(tmpl())
    render(
      <MemoryRouter>
        <PanelsReportView report={report(def)} definition={def} entries={[]} previous={undefined}
          practices={PRACTICES} todayCob={TODAY} chartHeight={300} formLink={null} />
      </MemoryRouter>,
    )
    expect(screen.getByText('Average sleep').parentElement).toHaveTextContent('—')
    expect(screen.getByText('Nights in range').parentElement).toHaveTextContent('—')
    expect(screen.getByText('No data in this range')).toBeInTheDocument()
  })

  it('labels render in the active language', async () => {
    i18n.addResourceBundle('ru', 'translation', ru, true, true)
    await i18n.changeLanguage('ru')
    view()
    expect(screen.getAllByText('Средний отбой')).toHaveLength(2) // figure and legend
    expect(screen.getByText('Средний сон').parentElement).toHaveTextContent('7ч 18м')
    expect(screen.getByText('Ночей в норме').parentElement).toHaveTextContent('22 из 29')
  })

  it('labelText reads keys and literal text, with a fallback', () => {
    const t = i18n.t.bind(i18n) as Parameters<typeof labelText>[1]
    expect(labelText({ Key: 'reportPanels.nap' }, t)).toBe('Nap')
    expect(labelText({ Text: 'Mine' }, t)).toBe('Mine')
    expect(labelText(null, t, 'Total')).toBe('Total')
  })
})

describe('a Japa report', () => {
  afterEach(cleanup)
  const ROUNDS = P('r', 'Japa rounds', 'Int')
  const MORNING = P('m', 'Morning rounds', 'Int')
  const QUALITY = { ...P('q', 'Quality', 'Text'), dropdown_variants: '1,2,3,4,5' }
  const ATT = P('a', 'Attunement', 'Bool')
  const days = Array.from({ length: 7 }, (_, i) => dayAt(TODAY, i - 6))
  const entries = days.flatMap((d, i) => [
    e(d, ROUNDS.practice, { Int: i % 2 ? 16 : 8 }), e(d, MORNING.practice, { Int: 4 }),
    e(d, QUALITY.practice, { Text: String(i % 4) }), e(d, ATT.practice, { Bool: i === 2 }),
  ])
  // A week before: 8 rounds a day.
  const previous = days.map((d) => e(dayAt(d, -7), ROUNDS.practice, { Int: 8 }))
  const show = (def: PanelsReport, practices = [ROUNDS, MORNING, QUALITY, ATT], prev?: typeof previous) => render(
    <MemoryRouter>
      <PanelsReportView report={report(def)} definition={def} entries={entries} previous={prev} practices={practices} todayCob={TODAY} chartHeight={300} formLink="/f" range="7d" />
    </MemoryRouter>,
  )
  const full = japaPanels({ total: 'r', target: 16, morning: 'm', quality: 'q', attunement: 'a' })

  it('names the states, extras and target in the legend', () => {
    show(full)
    const legend = screen.getByRole('list', { name: 'Key' })
    expect(within(legend).getAllByRole('listitem').map((x) => x.textContent)).toEqual(['On target', 'Missed', 'Done in the morning', 'Target 16'])
  })

  it('states come from the target, and the morning bars stay out of them', () => {
    const { container } = show(full)
    expect(container.querySelectorAll('.recharts-bar-rectangle [fill="var(--ui-state-under-fill)"]').length).toBeGreaterThan(0)
    expect(container.querySelectorAll('rect[fill="var(--ui-ink)"]')).toHaveLength(7)
  })

  it('draws no dot for an older report’s done marker, nor its figure', () => {
    const { container } = show(full)
    expect(container.querySelectorAll('circle[data-mark="dot"]')).toHaveLength(0)
    expect(screen.queryByText('Days marked done')).not.toBeInTheDocument()
  })

  it('draws nothing for an older report’s quality', () => {
    const { container } = show(full)
    expect(screen.queryByRole('heading', { name: 'How it went' })).not.toBeInTheDocument()
    expect(container.querySelectorAll('.recharts-line-curve')).toHaveLength(0)
    expect(screen.queryByText('Average rating')).not.toBeInTheDocument()
  })

  it('heads the chart with the daily average and its change vs the previous window', () => {
    show(full, undefined, previous)
    expect(screen.queryByRole('heading', { name: 'Count' })).not.toBeInTheDocument()
    expect(screen.getByText(/^Daily average/)).toBeInTheDocument()
    // Today out, six days of 8/16 alternating: 72 / 6 = 12, vs 8 before.
    expect(screen.getByText(/^Daily average/).nextElementSibling).toHaveTextContent('12')
    expect(screen.getByText('+50% vs previous 7 days')).toBeInTheDocument()
  })

  it('draws a report saved with the older two charts as the one chart', () => {
    const old = full.panels.length
    const saved: PanelsReport = { ...full, panels: [...full.panels, { ...(full.panels[1] as Extract<Panel, { kind: 'Chart' }>), headline: false, title: { Text: 'How it went' } }] }
    show(saved)
    expect(old).toBe(2)
    expect(screen.queryByRole('heading', { name: 'How it went' })).not.toBeInTheDocument()
  })

  it('with total and target only, the legend has just the states and the line', () => {
    show(japaPanels({ total: 'r', target: 16, morning: null, quality: null, attunement: null }))
    expect(within(screen.getByRole('list', { name: 'Key' })).getAllByRole('listitem').map((x) => x.textContent)).toEqual(['On target', 'Missed', 'Target 16'])
  })

  it('two figures sit in one row on wide layouts', () => {
    show(full)
    expect((screen.getByText('Days on target').parentElement?.parentElement as HTMLElement).style.gridTemplateColumns).toBe('repeat(2, minmax(0, 1fr))')
  })
})

describe('a Duration report', () => {
  afterEach(cleanup)
  const A = P('a', 'Reading', 'Duration')
  const B = P('b', 'Listening', 'Duration')
  const days = Array.from({ length: 7 }, (_, i) => dayAt(TODAY, i - 6))
  const entries = days.flatMap((d, i) => [e(d, A.practice, { Duration: i % 2 ? 90 : 30 }), e(d, B.practice, { Duration: 90 })])
  const show = (def: PanelsReport, practices = [A, B]) => render(
    <MemoryRouter>
      <PanelsReportView report={report(def)} definition={def} entries={entries} previous={undefined} practices={practices} todayCob={TODAY} chartHeight={300} formLink="/f" />
    </MemoryRouter>,
  )
  const legend = () => within(screen.getByRole('list', { name: 'Key' })).getAllByRole('listitem').map((x) => x.textContent)

  it('one practice: goal met, missed and the line', () => {
    const { container } = show(durationPanels({ practices: ['a'], goal: 60 }))
    expect(legend()).toEqual(['Goal met', 'Missed', 'Goal 1h'])
    expect(container.querySelectorAll('.recharts-bar-rectangle [fill="var(--ui-state-under-fill)"]').length).toBeGreaterThan(0)
  })
  it('one practice, no goal: neutral bars and no legend', () => {
    const { container } = show(durationPanels({ practices: ['a'], goal: null }))
    expect(screen.queryByRole('list', { name: 'Key' })).not.toBeInTheDocument()
    expect(container.querySelectorAll('.recharts-bar-rectangle [fill="var(--ui-state-none)"]').length).toBeGreaterThan(0)
  })
  it('several practices: series colours, practice names and the goal', () => {
    const { container } = show(durationPanels({ practices: ['a', 'b'], goal: 120 }))
    expect(legend()).toEqual(['Reading', 'Listening', 'Goal 2h'])
    expect(container.querySelectorAll('.recharts-bar-rectangle [fill="var(--ui-chart-2)"]').length).toBeGreaterThan(0)
    expect(container.querySelectorAll('.recharts-bar-rectangle [fill="var(--ui-state-under-fill)"]')).toHaveLength(0)
  })
  it('the axis reaches the stack, not just its tallest part', () => {
    const { container } = show(durationPanels({ practices: ['a', 'b'], goal: null }))
    const ticks = [...container.querySelectorAll('.recharts-yAxis-tick-labels text')].map((x) => x.textContent)
    expect(ticks.at(-1)).toBe('3h')
  })
  it('a deleted practice: the other draws, the message shows once', () => {
    show(durationPanels({ practices: ['a', 'b', 'c', 'd'], goal: null }), [A, B])
    expect(screen.getByRole('heading', { name: 'This report needs a practice for “Daily totals”' })).toBeInTheDocument()
    expect(screen.getByText(/^Daily average/)).toBeInTheDocument()
  })
  it('heads the chart with the average of the daily total', () => {
    show(durationPanels({ practices: ['a', 'b'], goal: null }))
    // Today out: Reading 30/90 alternating plus Listening 90 = 6×60 + 6×90 over 6 days.
    expect(screen.getByText(/^Daily average/).nextElementSibling).toHaveTextContent('2h 30m')
  })
  it('tapping a practice in the key hides it from the chart, and tapping again brings it back', () => {
    const { container } = show(durationPanels({ practices: ['a', 'b'], goal: null }))
    const reading = screen.getByRole('button', { name: 'Reading' })
    const bars = () => container.querySelectorAll('.recharts-bar-rectangle').length
    const all = bars()
    fireEvent.click(reading)
    expect(reading).toHaveAttribute('aria-pressed', 'false')
    expect(bars()).toBe(all / 2)
    fireEvent.click(reading)
    expect(bars()).toBe(all)
  })
  it('one practice has nothing to tap', () => {
    show(durationPanels({ practices: ['a'], goal: 60 }))
    expect(screen.queryByRole('button', { name: 'Reading' })).toBeNull()
  })
})

describe('panels reports on each screen', () => {
  const PANELS = report(sleepPanels(tmpl()))
  const { entries, previous } = nights()
  const data = async (cob: string) => (cob === TODAY ? entries : previous)
  const charts = vi.mocked(chartsApi)
  const practices = vi.mocked(practicesApi)

  function renderAt(el: ReactNode, path = '/charts') {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={[path]}><Routes><Route path="/shared/:id" element={el} /><Route path="*" element={el} /></Routes></MemoryRouter>
      </QueryClientProvider>,
    )
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 6, 9))
    localStorage.setItem('insights-report', 'r1')
    practices.getUserPractices.mockResolvedValue(PRACTICES)
    practices.getIncompleteDays.mockResolvedValue([])
    charts.getReports.mockResolvedValue([PANELS])
    charts.getReportData.mockImplementation(data)
    charts.getSharedUser.mockResolvedValue({ id: 'u1', name: 'Alex das' })
    charts.getSharedReports.mockResolvedValue([PANELS])
    charts.getSharedPractices.mockResolvedValue(PRACTICES)
    charts.getSharedReportData.mockImplementation(async (_u, cob) => data(cob))
  })
  afterEach(() => { vi.useRealTimers(); localStorage.clear() })

  // The window's first night fills in when the previous window arrives.
  const figures = () => waitFor(() => expect(screen.getByText('Nights in range').parentElement).toHaveTextContent('22 of 29'))
  const hidesGeneric = () => {
    expect(screen.queryByRole('list', { name: 'Averages' })).toBeNull()
    expect(screen.queryByText(/^Daily average/)).toBeNull()
  }

  it('mobile', async () => {
    setViewportWidth(390)
    renderAt(<InsightsMobileScreen />)
    await figures()
    hidesGeneric()
  })

  it('tablet', async () => {
    setViewportWidth(834)
    renderAt(<InsightsTabletScreen />)
    await figures()
    hidesGeneric()
  })

  it('shared mobile: no CSV menu', async () => {
    setViewportWidth(390)
    renderAt(<SharedMobile />, '/shared/u1')
    await figures()
    hidesGeneric()
    expect(screen.queryByRole('button', { name: 'More' })).toBeNull()
  })

  it('shared tablet: no CSV or table', async () => {
    setViewportWidth(834)
    renderAt(<SharedTablet />, '/shared/u1')
    await figures()
    hidesGeneric()
    // The report list leaves too little width for four figures.
    expect(screen.getByText('Nights in range').parentElement?.parentElement).toHaveClass('grid-cols-2')
    expect(screen.queryByRole('button', { name: 'Download CSV' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Table' })).toBeNull()
  })

  it('shared desktop: no CSV or chart/table switch, and no form link', async () => {
    setViewportWidth(1440)
    charts.getSharedPractices.mockResolvedValue([BED, NAP])
    renderAt(<SharedDesktop />, '/shared/u1')
    expect(await screen.findByText(/needs a practice for “Wake-up”/)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Choose a practice' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Download CSV' })).toBeNull()
    expect(screen.queryByRole('radiogroup', { name: 'Table' })).toBeNull()
    hidesGeneric()
  })
})

describe('month panels', () => {
  const WALK = P('44444444-dddd', 'Walk', 'Bool')
  const JOURNAL = P('55555555-eeee', 'Journaling', 'Bool')
  const def: PanelsReport = { version: 1, template: null, required: [], panels: [
    { kind: 'Month', practice: WALK.id }, { kind: 'Month', practice: JOURNAL.id },
  ] }
  const b = (cob: string, practice: string, v: boolean) => e(cob, practice, { Bool: v })
  const show = (practices = [WALK, JOURNAL]) => render(
    <MemoryRouter>
      <PanelsReportView report={report(def)} definition={def} month="2026-10" todayCob={TODAY}
        entries={[b('2026-10-01', 'Walk', true), b('2026-10-02', 'Walk', true), b('2026-10-03', 'Walk', false), b('2026-09-30', 'Walk', true)]}
        previous={undefined} practices={practices} chartHeight={300} formLink={null} />
    </MemoryRouter>,
  )

  it('draws a section per practice with its counts and a described grid', () => {
    show()
    const walk = screen.getByRole('group', { name: 'Walk' })
    expect(within(walk).getByText('This month').parentElement).toHaveTextContent('2')
    expect(within(walk).getByText('Last month').parentElement).toHaveTextContent('1')
    expect(within(walk).getByText('Last 90 days').parentElement).toHaveTextContent('3')
    expect(within(walk).getByRole('img', { name: 'Walk: 2 days done in October 2026' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Journaling' })).toBeInTheDocument()
  })
  it('starts the week on Monday and rings today', () => {
    show()
    const grid = screen.getAllByRole('img', { name: /days done in/ })[0]
    expect(Array.from(grid.querySelectorAll('[data-weekday]')).map((x) => x.textContent).join('')).toBe('MTWTFSS')
    expect(grid.querySelector('[data-cob="2026-10-06"]')).toHaveAttribute('aria-current', 'date')
    expect(grid.querySelector('[data-cob="2026-10-07"]')).toHaveAttribute('data-future', 'true')
    expect(grid.querySelector('[data-cob="2026-10-01"]')).toHaveAttribute('data-done', 'true')
  })
  it('a false day and an empty day look the same', () => {
    show()
    const grid = screen.getAllByRole('img', { name: /days done in/ })[0]
    expect(grid.querySelector('[data-cob="2026-10-03"]')!.className).toBe(grid.querySelector('[data-cob="2026-10-04"]')!.className)
  })
  it('one legend closes the report, with no red', () => {
    show()
    expect(screen.getAllByRole('list', { name: 'Key' })).toHaveLength(1)
    expect(screen.getByText('Not marked done')).toBeInTheDocument()
    expect(document.body.innerHTML).not.toMatch(/danger|under/)
  })
  it('a hidden practice leaves its section and shows the missing card', () => {
    const r = { ...def, required: [{ practice: JOURNAL.id, label: { Text: 'Journaling' } }] }
    render(
      <MemoryRouter>
        <PanelsReportView report={report(r)} definition={r} month="2026-10" todayCob={TODAY} entries={[]} previous={undefined}
          practices={[WALK, { ...JOURNAL, is_active: false }]} chartHeight={300} formLink={null} />
      </MemoryRouter>,
    )
    expect(screen.queryByRole('group', { name: 'Journaling' })).toBeNull()
    expect(screen.getByText(/Journaling/)).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Walk' })).toBeInTheDocument()
  })
})

describe('a Days between events report', () => {
  afterEach(cleanup)
  const EV = P('44444444-dddd', 'Fasting', 'Bool')
  const KIND = { ...P('55555555-eeee', 'Kind', 'Text'), dropdown_variants: 'Fast, Feast' }
  const ROUNDS = P('66666666-ffff', 'Rounds', 'Int')
  const gapsDef = (event: string): PanelsReport => ({
    version: 1, template: null,
    required: [{ practice: event, label: { Key: 'reportPanels.event' } }],
    panels: [
      { kind: 'Gaps', event },
      { kind: 'Around', event, rows: [{ label: null, source: { Practice: { practice: ROUNDS.id } } }] },
    ],
  })
  /** 60 days to today; Rounds 16 a day, 10 on event days; `event(i)` gives day i's event value or null. */
  function gapsView(event: UserPractice, value: (i: number) => unknown, { year = false, length = 60 } = {}) {
    const all = Array.from({ length: 60 }, (_, i) => dayAt(TODAY, i - 59)).flatMap((cob, i) => {
      const v = value(i)
      return [e(cob, ROUNDS.practice, { Int: v === null ? 16 : 10 }), ...(v === null ? [] : [e(cob, event.practice, v)])]
    })
    const entries = all.filter((x) => x.cob_date > dayAt(TODAY, -length))
    const def = gapsDef(event.id)
    return render(
      <MemoryRouter>
        <PanelsReportView report={report(def)} definition={def} entries={entries} previous={[]}
          practices={[EV, KIND, ROUNDS]} todayCob={TODAY} chartHeight={300} formLink={null} yearEntries={year ? all : undefined} />
      </MemoryRouter>,
    )
  }

  it('12 events: the figures and a table of the days around them, each cell naming its usual', () => {
    gapsView(EV, (i) => (i % 5 === 2 ? { Bool: true } : null))
    for (const label of ['Typical gap', 'Longest gap', 'Latest gap']) expect(screen.getByText(label)).toBeInTheDocument()
    expect(screen.getAllByText('5 days').length).toBeGreaterThan(0)
    const table = screen.getByRole('table')
    expect(within(table).getAllByRole('columnheader').map((c) => c.textContent)).toEqual(
      expect.arrayContaining(['Day before', 'Same day', 'Next day', '2 days after', 'Usual']),
    )
    const same = within(table).getAllByRole('cell')[1]
    expect(same.textContent).toBe('10.0')
    expect(same.getAttribute('aria-label')).toMatch(/usual 14\.\d/)
  })

  it('draws a stem and a marker per event with a gap, over calendar time (16m16)', () => {
    const { container } = gapsView(EV, (i) => (i % 5 === 2 ? { Bool: true } : null))
    expect(screen.getByText('Days since the one before')).toBeInTheDocument()
    expect(screen.getByText('12 events')).toBeInTheDocument()
    // The first event has nothing before it in the window, so 11 gaps.
    expect(container.querySelectorAll('[data-mark="gap"]')).toHaveLength(11)
    expect(container.querySelectorAll('[data-mark="gap"] line')).toHaveLength(11)
  })

  it('a dropdown event draws one marker per event, never a stray one for the other option', () => {
    // Fast on 12 days, Feast on 3: 15 events, the first with no gap.
    const { container } = gapsView(KIND, (i) => (i % 5 === 2 ? { Text: 'Fast' } : i % 20 === 4 ? { Text: 'Feast' } : null))
    expect(container.querySelectorAll('[data-mark="gap"]')).toHaveLength(14)
  })

  it('a dropdown event with one option in the window still names it in the legend', () => {
    gapsView(KIND, (i) => (i % 5 === 2 ? { Text: 'Fast' } : null))
    expect(within(screen.getByRole('list', { name: 'Key' })).getByText('Fast')).toBeInTheDocument()
  })

  it('6 events: says how many more the table needs', () => {
    gapsView(EV, (i) => (i % 10 === 2 ? { Bool: true } : null))
    expect(screen.getByText('4 more events needed for this table')).toBeInTheDocument()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('a short window: the table reads the year, so it still has its 10 events', () => {
    gapsView(EV, (i) => (i % 5 === 2 ? { Bool: true } : null), { length: 10 })
    expect(screen.queryByRole('table')).toBeNull()
    cleanup()
    gapsView(EV, (i) => (i % 5 === 2 ? { Bool: true } : null), { length: 10, year: true })
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByText('2 events')).toBeInTheDocument() // the Gaps chart still covers only the window
  })

  it('a dropdown event: a switch picks the option the table shows', () => {
    // Fast on 12 days, Feast on 3.
    gapsView(KIND, (i) => (i % 5 === 2 ? { Text: 'Fast' } : i % 20 === 4 ? { Text: 'Feast' } : null))
    expect(screen.getByRole('radio', { name: 'All' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('table')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: 'Feast' }))
    expect(screen.getByText('7 more events needed for this table')).toBeInTheDocument()
  })

  it('a dropdown event whose switch is too wide: a menu picks the option instead', () => {
    const wide = vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(500)
    gapsView(KIND, (i) => (i % 5 === 2 ? { Text: 'Fast' } : i % 20 === 4 ? { Text: 'Feast' } : null))
    wide.mockRestore()
    expect(screen.queryByRole('radio', { name: 'Feast' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Option: All' }))
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Feast' }))
    expect(screen.getByText('7 more events needed for this table')).toBeInTheDocument()
  })

  it('All, the default, counts every option: 6 Fast and 4 Feast make the table', () => {
    gapsView(KIND, (i) => (i % 10 === 2 ? { Text: 'Fast' } : i % 15 === 4 ? { Text: 'Feast' } : null))
    expect(screen.getByRole('table')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: 'Fast' }))
    expect(screen.getByText('4 more events needed for this table')).toBeInTheDocument()
  })

  it('no events: says so', () => {
    gapsView(EV, () => null)
    expect(screen.getByText('No events in this range')).toBeInTheDocument()
  })
})
