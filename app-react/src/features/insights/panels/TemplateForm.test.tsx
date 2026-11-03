import { act, cleanup as cleanupForm, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { Report } from '../../../api/charts'
import type { UserPractice } from '../../../types/api'
import { setViewportWidth } from '../../../test/viewport'
import { REPORTS_KEY } from '../useReports'
import { NewTemplateScreen } from './NewTemplateScreen'
import { draftOf, draftProblem, draftToDefinition, TemplateForm, type TemplateDraft } from './TemplateForm'
import { daysPanels, durationPanels, gapsPanels, japaPanels, sleepPanels } from './templates'

vi.mock('../../../api/charts', () => ({
  chartsApi: { getReports: vi.fn(), getReportData: vi.fn(), updateReport: vi.fn(), createReport: vi.fn(), deleteReport: vi.fn() },
}))
vi.mock('../../../api/practices', () => ({ practicesApi: { getUserPractices: vi.fn(), updateUserPractice: vi.fn(), getGroups: vi.fn() } }))
vi.mock('../useInsights', async (orig) => ({ ...await orig<typeof import('../useInsights')>(), writeStored: vi.fn() }))
import { chartsApi } from '../../../api/charts'
import { practicesApi } from '../../../api/practices'
import { writeStored } from '../useInsights'
const charts = vi.mocked(chartsApi)

const p = (id: string, practice: string, data_type: UserPractice['data_type'], is_active = true) => ({ id, practice, data_type, is_active }) as UserPractice
const PRACTICES = [
  p('bed', 'Bed time', 'Time'), p('wake', 'Wake-up time', 'Time'), p('nap', 'Nap', 'Duration'),
  p('japa', 'Japa rounds', 'Int'), p('old', 'Old evening time', 'Time', false),
]
type SleepDraft = Extract<TemplateDraft, { kind: 'Sleep' }>
const sleepDraft = (...a: Parameters<typeof draftOf>) => draftOf(...a) as SleepDraft
const DRAFT: SleepDraft = { kind: 'Sleep', bedtime: 'bed', wake: 'wake', nap: null, min: 360, max: 540 }

describe('draftProblem', () => {
  it('asks for both required practices', () => {
    expect(draftProblem({ ...DRAFT, bedtime: null })).toBe('required')
    expect(draftProblem({ ...DRAFT, wake: null })).toBe('required')
  })
  it('rejects min above max, allows them equal or cleared', () => {
    expect(draftProblem({ ...DRAFT, min: 541 })).toBe('minMax')
    expect(draftProblem({ ...DRAFT, min: 540 })).toBeNull()
    expect(draftProblem({ ...DRAFT, min: null })).toBeNull()
    expect(draftProblem({ ...DRAFT, nap: null, max: null })).toBeNull()
  })
})

describe('draftToDefinition', () => {
  it('builds the report, or nothing while there is a problem', () => {
    expect(draftToDefinition(DRAFT)).toEqual({ Panels: sleepPanels({ bedtime: 'bed', wake: 'wake', nap: null, min: 360, max: 540 }) })
    expect(draftToDefinition({ ...DRAFT, wake: null })).toBeNull()
    expect(draftToDefinition({ ...DRAFT, min: 600 })).toBeNull()
  })
})

describe('draftOf', () => {
  const def = sleepPanels({ bedtime: 'bed', wake: 'wake', nap: 'nap', min: 300, max: null })
  it('reads the template back', () => {
    expect(draftOf(def, PRACTICES)).toEqual({ kind: 'Sleep', bedtime: 'bed', wake: 'wake', nap: 'nap', min: 300, max: null })
  })
  it('a deleted or hidden required practice loads as missing', () => {
    expect(sleepDraft(def, PRACTICES.filter((x) => x.id !== 'wake')).wake).toBeNull()
    expect(sleepDraft(def, [PRACTICES[1], PRACTICES[2], { ...PRACTICES[0], is_active: false }]).bedtime).toBeNull()
  })
  it('a required practice retyped away from Time loads as missing', () => {
    expect(sleepDraft(def, [{ ...PRACTICES[0], data_type: 'Int' }, PRACTICES[1]]).bedtime).toBeNull()
  })
  it('the optional nap keeps its stale id, so limits still save', () => {
    const d = sleepDraft(def, PRACTICES.filter((x) => x.id !== 'nap'))
    expect(d.nap).toBe('nap')
    expect(draftProblem(d)).toBeNull()
  })
})

function Form({ start, flagMissing }: { start: TemplateDraft; flagMissing?: boolean }) {
  const [v, setV] = useState(start)
  return (
    <MemoryRouter>
      <TemplateForm value={v} onChange={setV} practices={PRACTICES} flagMissing={flagMissing} />
      <output data-testid="draft">{JSON.stringify(v)}</output>
    </MemoryRouter>
  )
}
const shown = () => JSON.parse(screen.getByTestId('draft').textContent!) as SleepDraft

describe('TemplateForm', () => {
  it('a stale nap reads as unset, never as an id', () => {
    render(<Form start={{ ...DRAFT, nap: 'gone-id' }} />)
    expect(screen.queryByText('gone-id')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Nap: Choose a practice' })).toBeInTheDocument()
  })

  it('the nap picker can clear it', () => {
    render(<Form start={{ ...DRAFT, nap: 'nap' }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Nap: Nap' }))
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Nap' })).getByRole('radio', { name: 'No nap' }))
    expect(shown().nap).toBeNull()
  })

  it('types limits digit by digit, the colon added for you', () => {
    render(<Form start={DRAFT} />)
    const max = screen.getByLabelText('Maximum sleep')
    expect(max).toHaveValue('09:00')
    fireEvent.change(max, { target: { value: '0830' } })
    expect(max).toHaveValue('08:30')
    fireEvent.blur(max)
    expect(shown().max).toBe(510)
    fireEvent.change(max, { target: { value: '07' } })
    expect(max).toHaveValue('07:')
    fireEvent.blur(max)
    expect(shown().max).toBe(420)
    fireEvent.change(max, { target: { value: 'soon' } })
    expect(max).toHaveValue('')
  })

  it('emptying a limit saves null', () => {
    render(<Form start={DRAFT} />)
    const min = screen.getByLabelText('Minimum sleep')
    fireEvent.change(min, { target: { value: '' } })
    fireEvent.blur(min)
    expect(shown().min).toBeNull()
  })

  it('flags a missing required slot only when asked', () => {
    const { unmount } = render(<Form start={{ ...DRAFT, wake: null }} />)
    expect(screen.queryByText(/deleted or hidden/i)).not.toBeInTheDocument()
    unmount()
    render(<Form start={{ ...DRAFT, wake: null }} flagMissing />)
    expect(screen.getByText(/deleted or hidden/i)).toBeInTheDocument()
  })
})

function renderNew(path = '/settings/charts/new/sleep') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 60_000 } } })
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/charts" element={<p>Insights page</p>} />
          <Route path="/settings/charts" element={<p>Charts list</p>} />
          <Route path="/settings/charts/new/:template" element={<NewTemplateScreen />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return qc
}
const create = () => screen.getByRole('button', { name: 'Create report' })

describe('NewTemplateScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setViewportWidth(390)
    vi.mocked(practicesApi.getUserPractices).mockResolvedValue(PRACTICES)
    charts.getReports.mockResolvedValue([])
    charts.getReportData.mockResolvedValue([])
    charts.createReport.mockResolvedValue('r9')
  })

  it('holds Create when the default name is taken, and says why until it changes', async () => {
    charts.getReports.mockResolvedValue([{ id: 'r1', name: 'Sleep', definition: { Grid: { practices: [], group_columns: true } } }])
    renderNew()
    fireEvent.click(await screen.findByRole('button', { name: 'Use Bed time' }))
    fireEvent.click(screen.getByRole('button', { name: 'Use Wake-up time' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('A report with this name already exists.')
    expect(create()).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Sleep times' } })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(create()).toBeEnabled()
  })

  it('suggests but fills nothing until Use is pressed', async () => {
    renderNew()
    expect(await screen.findByRole('button', { name: 'Use Bed time' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Use Wake-up time' })).toBeInTheDocument()
    expect(create()).toBeDisabled()
    expect(screen.getByText('Choose a bedtime and a wake-up practice to create the report.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Use Bed time' }))
    expect(screen.getByRole('button', { name: 'Bedtime: Bed time' })).toBeInTheDocument()
    expect(create()).toBeDisabled()
  })

  it('Create needs a name, a bedtime and a wake-up', async () => {
    renderNew()
    fireEvent.click(await screen.findByRole('button', { name: 'Use Bed time' }))
    fireEvent.click(screen.getByRole('button', { name: 'Use Wake-up time' }))
    expect(create()).toBeEnabled()
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '  ' } })
    expect(create()).toBeDisabled()
  })

  it('posts a Panels definition, lists it, remembers it and opens Insights', async () => {
    const qc = renderNew()
    fireEvent.click(await screen.findByRole('button', { name: 'Use Bed time' }))
    fireEvent.click(screen.getByRole('button', { name: 'Use Wake-up time' }))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: ' Rest ' } })
    fireEvent.click(create())
    expect(await screen.findByText('Insights page')).toBeInTheDocument()
    const definition = { Panels: sleepPanels({ bedtime: 'bed', wake: 'wake', nap: null, min: 360, max: 540 }) }
    expect(charts.createReport).toHaveBeenCalledWith('Rest', definition)
    expect(qc.getQueryData<Report[]>([...REPORTS_KEY])).toContainEqual({ id: 'r9', name: 'Rest', definition })
    expect(writeStored).toHaveBeenCalledWith('r9')
  })

  it('limits start at 6:00 and 9:00, and each can be cleared', async () => {
    renderNew()
    fireEvent.click(await screen.findByRole('button', { name: 'Use Bed time' }))
    fireEvent.click(screen.getByRole('button', { name: 'Use Wake-up time' }))
    expect(screen.getByLabelText('Minimum sleep')).toHaveValue('06:00')
    expect(screen.getByLabelText('Maximum sleep')).toHaveValue('09:00')
    fireEvent.click(screen.getByRole('button', { name: 'Clear Minimum sleep' }))
    fireEvent.click(screen.getByRole('button', { name: 'Clear Maximum sleep' }))
    expect(screen.getByLabelText('Minimum sleep')).toHaveAttribute('placeholder', 'No minimum')
    fireEvent.click(create())
    await screen.findByText('Insights page')
    const [, def] = charts.createReport.mock.calls[0]
    expect(def).toEqual({ Panels: sleepPanels({ bedtime: 'bed', wake: 'wake', nap: null, min: null, max: null }) })
  })

  it('min above max shows the error and blocks Create', async () => {
    renderNew()
    fireEvent.click(await screen.findByRole('button', { name: 'Use Bed time' }))
    fireEvent.click(screen.getByRole('button', { name: 'Use Wake-up time' }))
    const max = screen.getByLabelText('Maximum sleep')
    fireEvent.change(max, { target: { value: '0500' } })
    fireEvent.blur(max)
    expect(screen.getByRole('alert')).toHaveTextContent('can’t be above')
    expect(create()).toBeDisabled()
  })

  it('the picker lists active compatible practices and says why others can’t be used', async () => {
    renderNew()
    fireEvent.click(await screen.findByRole('button', { name: 'Bedtime: Choose a practice' }))
    const sheet = screen.getByRole('dialog', { name: 'Bedtime' })
    expect(within(sheet).getByRole('radio', { name: /Bed time/ })).toBeInTheDocument()
    expect(within(sheet).getByRole('radio', { name: /Wake-up time/ })).toBeInTheDocument()
    expect(within(sheet).queryByText('Old evening time')).not.toBeInTheDocument()
    expect(within(sheet).queryByRole('radio', { name: /Nap/ })).not.toBeInTheDocument()
    expect(within(sheet).getByText('Can’t be a bedtime')).toBeInTheDocument()
    expect(within(sheet).getByText('Duration · bedtime needs a time of day')).toBeInTheDocument()
    expect(within(sheet).getByText('Number · bedtime needs a time of day')).toBeInTheDocument()
    fireEvent.click(within(sheet).getByRole('radio', { name: /Wake-up time/ }))
    expect(screen.getByRole('button', { name: 'Bedtime: Wake-up time' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('says so when there is no time-of-day practice', async () => {
    vi.mocked(practicesApi.getUserPractices).mockResolvedValue([PRACTICES[2], PRACTICES[3]])
    renderNew()
    expect(await screen.findByText('Sleep reports need time-of-day practices')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Add a practice' })).toHaveAttribute('href', '/settings/practices/new')
    expect(screen.getAllByText('You have no time-of-day practice')).toHaveLength(2)
  })

  it('an unknown template goes back to the charts', async () => {
    renderNew('/settings/charts/new/nonsense')
    expect(await screen.findByText('Charts list')).toBeInTheDocument()
  })

  it('Cancel goes back without creating', async () => {
    renderNew()
    fireEvent.click(await screen.findByRole('link', { name: 'Cancel' }))
    expect(await screen.findByText('Charts list')).toBeInTheDocument()
    expect(charts.createReport).not.toHaveBeenCalled()
  })

  it.each([[800, 'tablet'], [1440, 'desktop']])('%i (%s): the preview follows the form', async (width) => {
    setViewportWidth(width)
    renderNew()
    const useBed = await screen.findByRole('button', { name: 'Use Bed time' })
    expect(screen.getByText(/appears once/)).toBeInTheDocument()
    await act(async () => { fireEvent.click(useBed) })
    fireEvent.click(screen.getByRole('button', { name: 'Use Wake-up time' }))
    await waitFor(() => expect(screen.getByRole('group', { name: 'Sleep' })).toBeInTheDocument())
  })
})

describe('the Japa template', () => {
  const JAPA: TemplateDraft = { kind: 'Japa', total: 'japa', target: 16, morning: null }
  const ALL = [
    ...PRACTICES, p('m', 'Morning rounds', 'Int'), p('b', 'Attunement', 'Bool'),
  ]
  function JapaForm({ start, flagMissing }: { start: TemplateDraft; flagMissing?: boolean }) {
    const [v, setV] = useState(start)
    return (
      <MemoryRouter>
        <TemplateForm value={v} onChange={setV} practices={ALL} flagMissing={flagMissing} />
        <output data-testid="draft">{JSON.stringify(v)}</output>
      </MemoryRouter>
    )
  }

  it('needs total rounds and a target', () => {
    expect(draftProblem(JAPA)).toBeNull()
    expect(draftProblem({ ...JAPA, total: null })).toBe('required')
    expect(draftProblem({ ...JAPA, target: null })).toBe('required')
    expect(draftToDefinition({ ...JAPA, target: null })).toBeNull()
  })

  it('builds the Japa report', () => {
    expect(draftToDefinition(JAPA)).toEqual({ Panels: japaPanels({ total: 'japa', target: 16, morning: null, quality: null, attunement: null }) })
  })

  it('drops an older report’s quality and done marker on save', () => {
    const def = japaPanels({ total: 'japa', target: 16, morning: null, quality: 'q', attunement: 'b' })
    expect(draftToDefinition(draftOf(def, ALL)!)!.Panels.template).toEqual({ Japa: { total: 'japa', target: 16, morning: null, quality: null, attunement: null } })
    render(<JapaForm start={JAPA} />)
    expect(screen.queryByText('Attunement')).not.toBeInTheDocument()
    expect(screen.queryByText('How it went')).not.toBeInTheDocument()
  })

  it('reads the template back, with a deleted total as missing and a deleted extra kept', () => {
    const def = japaPanels({ total: 'japa', target: 16, morning: 'gone', quality: null, attunement: null })
    expect(draftOf(def, ALL)).toMatchObject({ kind: 'Japa', total: 'japa', target: 16, morning: 'gone' })
    expect(draftOf(def, ALL.filter((x) => x.id !== 'japa'))).toMatchObject({ total: null })
  })

  it('takes a whole number of rounds and nothing else', () => {
    render(<JapaForm start={{ ...JAPA, target: null }} />)
    const target = screen.getByLabelText('Daily target')
    fireEvent.change(target, { target: { value: '1a6' } })
    expect(target).toHaveValue('16')
    fireEvent.blur(target)
    expect(shown()).toMatchObject({ target: 16 })
  })

  it('suggests total rounds, filling nothing until Use', () => {
    render(<JapaForm start={{ ...JAPA, total: null }} />)
    expect(shown()).toMatchObject({ total: null })
    fireEvent.click(screen.getByRole('button', { name: 'Use Japa rounds' }))
    expect(shown()).toMatchObject({ total: 'japa' })
  })

  it('says why a cleared target isn’t saved on a saved report', () => {
    render(<JapaForm start={{ ...JAPA, target: null }} flagMissing />)
    expect(screen.getByRole('alert')).toHaveTextContent('Set a target to save your changes.')
  })

  it('flags a deleted total on a saved report', () => {
    render(<JapaForm start={{ ...JAPA, total: null }} flagMissing />)
    expect(screen.getByText(/deleted or hidden/)).toBeInTheDocument()
  })
})

describe('the live preview', () => {
  beforeEach(() => {
    setViewportWidth(1200)
    vi.mocked(practicesApi.getUserPractices).mockResolvedValue(PRACTICES)
    charts.getReports.mockResolvedValue([])
    charts.getReportData.mockReset().mockResolvedValue([])
  })
  it.each([['days', 'HalfYear'], ['sleep', 'Month']])('of %s reads %s', async (slug, duration) => {
    renderNew(`/settings/charts/new/${slug}`)
    await waitFor(() => expect(charts.getReportData).toHaveBeenCalled())
    expect(charts.getReportData.mock.calls[0][1]).toBe(duration)
  })
})

describe('the new Japa screen', () => {
  beforeEach(() => {
    setViewportWidth(390)
    vi.mocked(practicesApi.getUserPractices).mockResolvedValue(PRACTICES)
    charts.getReports.mockResolvedValue([])
    charts.createReport.mockReset().mockResolvedValue('new-id')
  })
  it('creates a Japa report once it has a total and a target', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={['/settings/charts/new/japa']}>
          <Routes>
            <Route path="/settings/charts/new/:template" element={<NewTemplateScreen />} />
            <Route path="/charts" element={<p>Insights</p>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )
    expect(await screen.findByRole('heading', { name: 'New daily count report' })).toBeInTheDocument()
    await screen.findByRole('button', { name: 'Use Japa rounds' })
    expect(screen.getByLabelText('Name')).toHaveValue('Daily count')
    const create = screen.getByRole('button', { name: 'Create report' })
    expect(create).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Use Japa rounds' }))
    fireEvent.change(screen.getByLabelText('Daily target'), { target: { value: '16' } })
    fireEvent.blur(screen.getByLabelText('Daily target'))
    expect(create).toBeEnabled()
    fireEvent.click(create)
    expect(await screen.findByText('Insights')).toBeInTheDocument()
    const def = charts.createReport.mock.calls[0][1] as { Panels: { template: unknown } }
    expect(def.Panels.template).toEqual({ Japa: { total: 'japa', target: 16, morning: null, quality: null, attunement: null } })
  })
})

describe('the Duration template', () => {
  const DUR: TemplateDraft = { kind: 'Duration', practices: ['nap'], goal: 120 }
  const ALL = [...PRACTICES, p('r', 'Reading', 'Duration')]
  function DurationForm({ start, flagMissing, practices = ALL }: { start: TemplateDraft; flagMissing?: boolean; practices?: UserPractice[] }) {
    const [v, setV] = useState(start)
    return (
      <MemoryRouter>
        <TemplateForm value={v} onChange={setV} practices={practices} flagMissing={flagMissing} />
        <output data-testid="draft">{JSON.stringify(v)}</output>
      </MemoryRouter>
    )
  }

  it('needs a practice and no more than a report can hold', () => {
    expect(draftProblem(DUR)).toBeNull()
    expect(draftProblem({ ...DUR, practices: [] })).toBe('required')
    expect(draftProblem({ ...DUR, practices: Array.from({ length: 13 }, (_, i) => `p${i}`) })).toBe('tooMany')
    expect(draftProblem({ ...DUR, practices: Array.from({ length: 12 }, (_, i) => `p${i}`) })).toBeNull()
  })
  it('builds the report', () => {
    expect(draftToDefinition(DUR)).toEqual({ Panels: durationPanels({ practices: ['nap'], goal: 120 }) })
  })
  it('reads back, dropping practices that can’t be used', () => {
    const def = durationPanels({ practices: ['nap', 'r'], goal: null })
    expect(draftOf(def, ALL)).toEqual({ kind: 'Duration', practices: ['nap', 'r'], goal: null })
    expect(draftOf(def, ALL.filter((x) => x.id !== 'r'))).toEqual({ kind: 'Duration', practices: ['nap'], goal: null })
  })
  it('lists duration practices with checkboxes, and only those', () => {
    render(<DurationForm start={DUR} />)
    expect(screen.getByRole('checkbox', { name: 'Nap' })).toBeChecked()
    expect(screen.queryByRole('checkbox', { name: 'Bed time' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Reading' }))
    expect(shown()).toMatchObject({ practices: ['nap', 'r'] })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Nap' }))
    expect(shown()).toMatchObject({ practices: ['r'] })
  })
  it('the goal reads as Xh Ym, is typed in minutes and can be cleared', () => {
    render(<DurationForm start={DUR} />)
    const goal = screen.getByLabelText('Goal per day')
    expect(goal).toHaveValue('2h')
    fireEvent.focus(goal)
    expect(goal).toHaveValue('120')
    fireEvent.change(goal, { target: { value: '90' } })
    fireEvent.blur(goal)
    expect(shown()).toMatchObject({ goal: 90 })
    expect(goal).toHaveValue('1h 30m')
    fireEvent.click(screen.getByRole('button', { name: 'Clear Goal per day' }))
    expect(shown()).toMatchObject({ goal: null })
  })
  it('says when there are too many, and links out when there are none', () => {
    const many = Array.from({ length: 13 }, (_, i) => p(`d${i}`, `D${i}`, 'Duration'))
    render(<DurationForm start={{ kind: 'Duration', practices: many.map((x) => x.id), goal: null }} practices={many} />)
    expect(screen.getByRole('alert')).toHaveTextContent('12')
    cleanupForm()
    render(<DurationForm start={{ kind: 'Duration', practices: [], goal: null }} practices={[]} />)
    expect(screen.getByRole('link', { name: /My practices/ })).toBeInTheDocument()
  })
  it('flags an empty saved report', () => {
    render(<DurationForm start={{ kind: 'Duration', practices: [], goal: null }} flagMissing />)
    expect(screen.getByText(/deleted or hidden/)).toBeInTheDocument()
  })
})

describe('the Days template', () => {
  const ALL = [...PRACTICES, p('walk', 'Walk', 'Bool'), p('pray', 'Prayer', 'Bool'), p('hid', 'Hidden', 'Bool', false)]
  const DAYS: TemplateDraft = { kind: 'Days', practices: ['walk'] }
  function DaysForm({ start, practices = ALL }: { start: TemplateDraft; practices?: UserPractice[] }) {
    const [v, setV] = useState(start)
    return (
      <MemoryRouter>
        <TemplateForm value={v} onChange={setV} practices={practices} />
        <output data-testid="draft">{JSON.stringify(v)}</output>
      </MemoryRouter>
    )
  }
  it('needs a practice and no more than eight', () => {
    expect(draftProblem(DAYS)).toBeNull()
    expect(draftProblem({ kind: 'Days', practices: [] })).toBe('required')
    expect(draftProblem({ kind: 'Days', practices: Array.from({ length: 9 }, (_, i) => `p${i}`) })).toBe('tooMany')
    expect(draftProblem({ kind: 'Days', practices: Array.from({ length: 8 }, (_, i) => `p${i}`) })).toBeNull()
  })
  it('builds the report, and reads back dropping hidden or retyped practices', () => {
    expect(draftToDefinition(DAYS)).toEqual({ Panels: daysPanels({ practices: ['walk'] }) })
    const def = daysPanels({ practices: ['walk', 'hid', 'nap', 'pray'] })
    expect(draftOf(def, ALL)).toEqual({ kind: 'Days', practices: ['walk', 'pray'] })
  })
  it('lists yes/no practices with checkboxes, and only those', () => {
    render(<DaysForm start={DAYS} />)
    expect(screen.getByRole('checkbox', { name: 'Walk' })).toBeChecked()
    expect(screen.queryByRole('checkbox', { name: 'Nap' })).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: 'Hidden' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Prayer' }))
    expect(shown()).toMatchObject({ practices: ['walk', 'pray'] })
  })
  it('says when there are too many, and links out when there are none', () => {
    const many = Array.from({ length: 9 }, (_, i) => p(`d${i}`, `D${i}`, 'Bool'))
    render(<DaysForm start={{ kind: 'Days', practices: many.map((x) => x.id) }} practices={many} />)
    expect(screen.getByRole('alert')).toHaveTextContent('8')
    cleanupForm()
    render(<DaysForm start={{ kind: 'Days', practices: [] }} practices={[]} />)
    expect(screen.getByText('You have no yes/no practice')).toBeInTheDocument()
  })
})

describe('the Days between events template', () => {
  const ALL = [...PRACTICES, p('fast', 'Fasting', 'Bool'), p('note', 'Note', 'Text'), p('read', 'Reading', 'Int'), p('kirtan', 'Kirtan', 'Int'), p('pages', 'Pages', 'Int')]
  const GAPS: TemplateDraft = { kind: 'Gaps', event: null, rows: [], sleep: null }
  function GapsForm({ start = GAPS, practices = ALL }: { start?: TemplateDraft; practices?: UserPractice[] }) {
    const [v, setV] = useState(start)
    return (
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <TemplateForm value={v} onChange={setV} practices={practices} />
          <output data-testid="draft">{JSON.stringify(v)}</output>
        </MemoryRouter>
      </QueryClientProvider>
    )
  }
  const draft = () => JSON.parse(screen.getByTestId('draft').textContent!) as TemplateDraft
  beforeEach(() => { vi.clearAllMocks(); charts.getReports.mockResolvedValue([]) })

  it('needs an event, and no more than four rows counting Sleep', () => {
    expect(draftProblem(GAPS)).toBe('required')
    const sleep = { bedtime: 'bed', wake: 'wake', nap: null }
    expect(draftProblem({ ...GAPS, event: 'fast', rows: ['a', 'b', 'c'], sleep })).toBeNull()
    expect(draftProblem({ ...GAPS, event: 'fast', rows: ['a', 'b', 'c', 'd'], sleep })).toBe('tooMany')
  })

  it('picking a yes/no event and two number rows builds the definition', () => {
    render(<GapsForm />)
    fireEvent.click(screen.getByRole('button', { name: 'Event: Choose a practice' }))
    fireEvent.click(screen.getByRole('radio', { name: /Fasting/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Reading' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Kirtan' }))
    expect(draftToDefinition(draft())).toEqual({ Panels: gapsPanels({ event: 'fast', rows: ['read', 'kirtan'], sleep: null }) })
  })

  it('a fifth row (four rows plus Sleep) says a report can show up to 4', () => {
    render(<GapsForm start={{ ...GAPS, event: 'fast', rows: ['read', 'kirtan', 'pages', 'japa'] }} />)
    expect(screen.queryByRole('alert')).toBeNull()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Sleep (calculated)' }))
    expect(draft()).toMatchObject({ sleep: { bedtime: 'bed', wake: 'wake', nap: null } })
    expect(screen.getByRole('alert')).toHaveTextContent('A report can show up to 4 practices.')
  })

  it('offers Sleep only when a bedtime and a wake-up can be found', () => {
    render(<GapsForm />)
    expect(screen.getByRole('checkbox', { name: 'Sleep (calculated)' })).toBeInTheDocument()
    cleanupForm()
    render(<GapsForm practices={ALL.filter((x) => x.data_type !== 'Time')} />)
    expect(screen.queryByRole('checkbox', { name: 'Sleep (calculated)' })).toBeNull()
  })

  it('reads back, dropping what no longer fits', () => {
    const def = gapsPanels({ event: 'fast', rows: ['read', 'gone', 'fast'], sleep: { bedtime: 'bed', wake: 'wake', nap: null } })
    expect(draftOf(def, ALL)).toEqual({ kind: 'Gaps', event: 'fast', rows: ['read'], sleep: { bedtime: 'bed', wake: 'wake', nap: null } })
    expect(draftOf(def, ALL.filter((x) => x.id !== 'fast' && x.id !== 'wake'))).toEqual({ kind: 'Gaps', event: null, rows: ['read'], sleep: null })
  })

  it('Create waits for an event', async () => {
    vi.mocked(practicesApi.getUserPractices).mockResolvedValue(ALL)
    setViewportWidth(390)
    renderNew('/settings/charts/new/gaps')
    expect(await screen.findByText('Choose an event practice to create the report.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create report' })).toBeDisabled()
  })
})
