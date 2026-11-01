import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
import { sleepPanels } from './templates'

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
const DRAFT: TemplateDraft = { kind: 'Sleep', bedtime: 'bed', wake: 'wake', nap: null, min: 360, max: 540 }

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
    expect(draftOf(def, PRACTICES.filter((x) => x.id !== 'wake'))?.wake).toBeNull()
    expect(draftOf(def, [PRACTICES[1], PRACTICES[2], { ...PRACTICES[0], is_active: false }])?.bedtime).toBeNull()
  })
  it('a required practice retyped away from Time loads as missing', () => {
    expect(draftOf(def, [{ ...PRACTICES[0], data_type: 'Int' }, PRACTICES[1]])?.bedtime).toBeNull()
  })
  it('the optional nap keeps its stale id, so limits still save', () => {
    const d = draftOf(def, PRACTICES.filter((x) => x.id !== 'nap'))!
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
const shown = () => JSON.parse(screen.getByTestId('draft').textContent!) as TemplateDraft

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
