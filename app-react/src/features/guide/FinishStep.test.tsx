import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import en from '../../../public/locales/en/translation.json'
import ru from '../../../public/locales/ru/translation.json'
import uk from '../../../public/locales/uk/translation.json'
import type { UserPractice } from '../../types/api'
import { useAuthStore } from '../../store/authStore'
import { setViewportWidth } from '../../test/viewport'
import { REPORTS_KEY } from '../insights/useReports'
import { GuideScreen } from './GuideScreen'

vi.mock('../../api/guide', () => ({ guideApi: { start: vi.fn(), update: vi.fn() } }))
vi.mock('../../api/practices', () => ({ practicesApi: { getUserPractices: vi.fn(), createUserPractice: vi.fn(), updateUserPractice: vi.fn(), deleteUserPractice: vi.fn(), getGroups: vi.fn(), createGroup: vi.fn() } }))
vi.mock('../../api/charts', () => ({ chartsApi: { getReports: vi.fn(), createReport: vi.fn(), updateReport: vi.fn(), deleteReport: vi.fn() } }))
vi.mock('./MiniReport', () => ({ MiniReport: ({ head, footer }: { head?: React.ReactNode; footer?: React.ReactNode }) => <div>{head}{footer}</div> }))
import { chartsApi } from '../../api/charts'
import { guideApi } from '../../api/guide'
import { practicesApi } from '../../api/practices'

let have: UserPractice[]
let made: string[]
let qc: QueryClient
let router: ReturnType<typeof createMemoryRouter>

beforeEach(() => {
  vi.clearAllMocks()
  have = []
  made = []
  setViewportWidth(1200)
  useAuthStore.setState({ user: { id: 'u-123' } as never })
  vi.mocked(guideApi.start).mockResolvedValue('run-1')
  vi.mocked(guideApi.update).mockResolvedValue(undefined)
  vi.mocked(practicesApi.getUserPractices).mockImplementation(async () => [...have])
  vi.mocked(practicesApi.createUserPractice).mockImplementation(async (p) => { have.push({ id: `id-${p.practice}`, practice: p.practice, data_type: p.data_type, is_active: true }) })
  vi.mocked(practicesApi.getGroups).mockResolvedValue([{ id: null, name: '', is_default: true }])
  vi.mocked(practicesApi.createGroup).mockImplementation(async (name) => `g-${name}`)
  vi.mocked(chartsApi.getReports).mockImplementation(async () => made.map((name) => ({ id: name, name, definition: { Panels: { panels: [] } } }) as never))
  vi.mocked(chartsApi.createReport).mockImplementation(async (name) => { made.push(name); return `r-${name}` })
})
afterEach(cleanup)

/** Walks the guide to the step after the last set up, with sleep (and days, if asked) tracked. */
async function open(state: unknown, days = false) {
  const user = userEvent.setup()
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  router = createMemoryRouter([{ path: '/guide', element: <GuideScreen /> }, { path: '/', element: <p>Today</p> }, { path: '/settings', element: <p>Settings</p> }], { initialEntries: ['/settings', { pathname: '/guide', state }], initialIndex: 1 })
  render(<QueryClientProvider client={qc}><RouterProvider router={router} /></QueryClientProvider>)
  await user.click(screen.getByRole('switch', { name: 'Sleep' }))
  if (days) await user.click(screen.getByRole('switch', { name: 'Days I did it' }))
  await user.click(screen.getByRole('button', { name: /^(Next|Create report)/ }))
  await screen.findByText(/^Set up · /)
  await act(async () => {})
  await user.click(screen.getByRole('button', { name: /^(Next|Create report)/ }))
  if (days) {
    await user.click(screen.getByRole('button', { name: 'Walk' }))
    await user.click(screen.getByRole('button', { name: /^(Next|Create report)/ }))
  }
  return user
}
const answer = (name: string, user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole('radio', { name: new RegExp(`^${name}`) }))
const offline = () => new AxiosError('Network Error')

describe('the reader question', () => {
  it('starts with neither answer selected, and Finish waits for one', async () => {
    const user = await open({ firstRun: true })
    const [yes, no] = [screen.getByRole('radio', { name: /^Yes/ }), screen.getByRole('radio', { name: /^No/ })]
    expect(yes).not.toBeChecked()
    expect(no).not.toBeChecked()
    expect(screen.getByRole('button', { name: 'Finish setup' })).toBeDisabled()
    await user.click(no)
    expect(screen.getByRole('button', { name: 'Finish setup' })).toBeEnabled()
  })

  it('says plainly that the link exists whatever the answer', async () => {
    await open({ firstRun: true })
    expect(screen.getByText(/works without signing in and can’t be turned off/)).toBeInTheDocument()
  })

  it('is not asked outside first run', async () => {
    await open({ back: '/settings' })
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    expect(await screen.findByText('Here’s what’s set up')).toBeInTheDocument()
  })
})

describe('creating', () => {
  it('shows each report as Created, Creating… or Waiting', async () => {
    let release!: () => void
    vi.mocked(chartsApi.createReport).mockImplementationOnce(async (name) => { await new Promise<void>((r) => { release = r }); made.push(name); return 'r' })
    const user = await open({ firstRun: true }, true)
    await answer('No', user)
    await user.click(screen.getByRole('button', { name: 'Finish setup' }))
    expect(await screen.findByText('Creating…')).toBeInTheDocument()
    expect(screen.getByText('Waiting')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument()
    await act(async () => release())
    expect(await screen.findByText('Here’s what’s set up')).toBeInTheDocument()
    expect(made).toEqual(['Sleep', 'Days I did it'])
  })

  it('on a failure says Not saved yet, offers Retry, and Retry carries on without duplicates', async () => {
    vi.mocked(chartsApi.createReport).mockRejectedValueOnce(offline()).mockImplementationOnce(async (name) => { made.push(name); return 'r' })
    const user = await open({ firstRun: true }, true)
    await answer('Yes', user)
    await user.click(screen.getByRole('button', { name: 'Finish setup' }))
    expect(await screen.findByText('Setup didn’t finish')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong. The connection dropped while saving.')
    expect(screen.getAllByText('Not saved yet').length).toBe(2)
    expect(screen.getByRole('button', { name: 'Review my choices' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Here’s what’s set up')).toBeInTheDocument()
    expect(made).toEqual(['Sleep', 'Days I did it'])
    expect(have.map((p) => p.practice).sort()).toEqual(['Bedtime', 'Nap', 'Wake-up', 'Walk'])
  })

  it('keeps the plan across a retry, so the guide’s own report is not met again as "Sleep 2"', async () => {
    vi.mocked(chartsApi.createReport).mockImplementationOnce(async (name) => { made.push(name); throw offline() })
    const user = await open({ firstRun: true })
    await answer('No', user)
    await user.click(screen.getByRole('button', { name: 'Finish setup' }))
    await user.click(await screen.findByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Here’s what’s set up')).toBeInTheDocument()
    expect(made).toEqual(['Sleep'])
  })

  it('reads practices fresh, and a name that turned out hidden reaches the person as the retry state', async () => {
    const user = await open({ firstRun: true })
    have.push({ id: 'h', practice: 'Bedtime', data_type: 'Time', is_active: false })
    await answer('No', user)
    await user.click(screen.getByRole('button', { name: 'Finish setup' }))
    expect(await screen.findByText('Setup didn’t finish')).toBeInTheDocument()
    expect(screen.getByText(/can’t be used any more/)).toBeInTheDocument()
    expect(chartsApi.createReport).not.toHaveBeenCalled()
    await vi.waitFor(() => expect(qc.getQueryData<UserPractice[]>(['practices'])?.map((p) => p.practice)).toContain('Bedtime')) // so set up can't pass on the old list
  })

  it('has fresh practices and reports in the cache before the closing screen, and marks the run finished with the answer', async () => {
    const user = await open({ firstRun: true })
    // Nothing observes these during Finish, which is what a plain invalidate skips.
    await qc.fetchQuery({ queryKey: REPORTS_KEY, queryFn: chartsApi.getReports })
    await answer('Yes', user)
    await user.click(screen.getByRole('button', { name: 'Finish setup' }))
    await screen.findByText('Here’s what’s set up')
    expect(qc.getQueryData<UserPractice[]>(['practices'])?.map((p) => p.practice).sort()).toEqual(['Bedtime', 'Nap', 'Wake-up'])
    expect(qc.getQueryData<{ name: string }[]>(REPORTS_KEY)?.map((r) => r.name)).toEqual(['Sleep'])
    // recorded on success, so someone who copies the link and closes the app still counts
    await vi.waitFor(() => expect(guideApi.update).toHaveBeenCalledWith('run-1', { outcome: 'finished', has_reader: true }))
    await user.click(screen.getByRole('button', { name: 'Start logging' }))
    expect(await screen.findByText('Today')).toBeInTheDocument()
    expect(vi.mocked(guideApi.update).mock.calls.filter(([, b]) => b.outcome).length).toBe(1)
  })
})

describe('a refresh that never answers', () => {
  it('records finished first and still reaches the closing screen', async () => {
    const user = await open({ firstRun: true })
    await answer('No', user)
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'], shouldAdvanceTime: true })
    try {
      vi.mocked(chartsApi.createReport).mockImplementationOnce(async (name) => {
        made.push(name)
        // offlineFirst: the fetch goes out and stays pending
        vi.mocked(practicesApi.getUserPractices).mockImplementation(() => new Promise(() => {}))
        return 'r'
      })
      await user.click(screen.getByRole('button', { name: 'Finish setup' }))
      await vi.waitFor(() => expect(guideApi.update).toHaveBeenCalledWith('run-1', { outcome: 'finished', has_reader: false }))
      expect(screen.queryByText('Here’s what’s set up')).not.toBeInTheDocument()
      await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
      expect(screen.getByText('Here’s what’s set up')).toBeInTheDocument()
    } finally { vi.useRealTimers() }
  })
})

describe('leaving during and after creating', () => {
  async function opened(state: unknown) {
    const user = await open(state)
    await answer('No', user)
    await user.click(screen.getByRole('button', { name: 'Finish setup' }))
    return router
  }

  it('the system Back is not held while creating: nobody is stranded, and the work carries on', async () => {
    let release!: () => void
    vi.mocked(chartsApi.createReport).mockImplementationOnce(async (name) => { await new Promise<void>((r) => { release = r }); made.push(name); return 'r' })
    const r = await opened({ firstRun: true })
    await screen.findByText('Creating…')
    await act(async () => { await r.navigate(-1) })
    expect(await screen.findByText('Settings')).toBeInTheDocument()
    await act(async () => release())
    await vi.waitFor(() => expect(made).toEqual(['Sleep']))
  })

  it('the system Back on the closing screen leaves, it does not reopen the steps', async () => {
    const r = await opened({ firstRun: true })
    await screen.findByText('Here’s what’s set up')
    await act(async () => { await r.navigate(-1) })
    expect(await screen.findByText('Settings')).toBeInTheDocument()
  })

  it('the system Back after a failure reviews the choices', async () => {
    vi.mocked(chartsApi.createReport).mockRejectedValueOnce(offline())
    const r = await opened({ firstRun: true })
    await screen.findByText('Setup didn’t finish')
    await act(async () => { await r.navigate(-1) })
    expect(await screen.findByRole('radio', { name: /^No/ })).toBeInTheDocument()
    expect(r.state.location.pathname).toBe('/guide')
  })

  it('has no exit link while creating', async () => {
    let release!: () => void
    vi.mocked(chartsApi.createReport).mockImplementationOnce(async (name) => { await new Promise<void>((r) => { release = r }); made.push(name); return 'r' })
    const user = await open({ firstRun: true })
    await answer('No', user)
    await user.click(screen.getByRole('button', { name: 'Finish setup' }))
    await screen.findByText('Creating…')
    expect(screen.queryByRole('button', { name: 'Build my own list' })).not.toBeInTheDocument()
    await act(async () => release())
    await screen.findByText('Here’s what’s set up')
  })

  it('after a partial failure the leave sheet says what stays', async () => {
    vi.mocked(chartsApi.createReport).mockRejectedValueOnce(offline())
    const user = await open({ firstRun: true })
    await answer('No', user)
    await user.click(screen.getByRole('button', { name: 'Finish setup' }))
    await screen.findByText('Setup didn’t finish')
    await user.click(screen.getAllByRole('button', { name: 'Build my own list' })[0])
    expect(screen.getByText('Anything already created stays. The rest won’t be saved.')).toBeInTheDocument()
  })

  it('before anything is created the sheet keeps its first wording', async () => {
    const user = await open({ firstRun: true })
    await user.click(screen.getAllByRole('button', { name: 'Build my own list' })[0])
    expect(screen.getByText('What you’ve chosen here won’t be saved.')).toBeInTheDocument()
  })
})

describe('coming back to Finish after a failure', () => {
  async function fail(user: ReturnType<typeof userEvent.setup>) {
    await answer('No', user)
    await user.click(screen.getByRole('button', { name: 'Finish setup' }))
    await screen.findByText('Setup didn’t finish')
  }

  it('builds the plan again, so a changed name is the one created', async () => {
    const user = await open({ firstRun: true })
    have.push({ id: 'h', practice: 'Bedtime', data_type: 'Time', is_active: false })
    await fail(user)
    await user.click(screen.getByRole('button', { name: 'Review my choices' })) // the reader question
    await user.click(screen.getByRole('button', { name: 'Back' })) // the sleep set up
    await user.click(screen.getByRole('button', { name: 'Rename Bedtime' }))
    const input = screen.getByRole('textbox', { name: 'Practice name' })
    await user.clear(input)
    await user.type(input, 'Lights out')
    await user.click(screen.getByRole('button', { name: 'Done' }))
    await user.click(screen.getByRole('button', { name: /^(Next|Create report)/ }))
    await user.click(screen.getByRole('button', { name: 'Finish setup' }))
    expect(await screen.findByText('Here’s what’s set up')).toBeInTheDocument()
    expect(have.map((p) => p.practice)).toContain('Lights out')
    expect(made).toEqual(['Sleep'])
  })

  it('does not duplicate or renumber a report that landed before the failure', async () => {
    vi.mocked(chartsApi.createReport).mockImplementationOnce(async (name) => { made.push(name); return 'r' }).mockRejectedValueOnce(offline())
    const user = await open({ firstRun: true }, true)
    await fail(user)
    expect(made).toEqual(['Sleep'])
    await user.click(screen.getByRole('button', { name: 'Review my choices' }))
    await user.click(screen.getByRole('button', { name: 'Finish setup' }))
    expect(await screen.findByText('Here’s what’s set up')).toBeInTheDocument()
    expect(made).toEqual(['Sleep', 'Days I did it'])
  })

  it('Retry still rebuilds when the rebuild itself failed offline', async () => {
    vi.mocked(chartsApi.createReport).mockRejectedValueOnce(offline())
    const user = await open({ firstRun: true })
    await fail(user)
    await user.click(screen.getByRole('button', { name: 'Review my choices' }))
    await user.click(screen.getByRole('button', { name: 'Back' }))
    // Bedtime was created by the first attempt, so it is theirs now: the way to another name is a new practice
    await user.click(screen.getAllByRole('button', { name: 'Start a new one' })[0])
    const input = screen.getByRole('textbox', { name: 'Practice name' })
    await user.type(input, 'Lights out')
    await user.click(screen.getByRole('button', { name: 'Done' }))
    await user.click(screen.getByRole('button', { name: /^(Next|Create report)/ }))
    vi.mocked(practicesApi.getUserPractices).mockRejectedValueOnce(offline())
    await user.click(screen.getByRole('button', { name: 'Finish setup' }))
    await screen.findByText('Setup didn’t finish')
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Here’s what’s set up')).toBeInTheDocument()
    expect(have.map((p) => p.practice)).toContain('Lights out')
  })

  it('a plain Retry reads nothing again for the plan', async () => {
    vi.mocked(chartsApi.createReport).mockRejectedValueOnce(offline())
    const user = await open({ firstRun: true })
    await fail(user)
    const before = vi.mocked(chartsApi.getReports).mock.calls.length
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    await screen.findByText('Here’s what’s set up')
    expect(vi.mocked(chartsApi.getReports).mock.calls.length - before).toBe(2) // runPlan's own read and the refresh at the end
  })
})

describe('the closing screen', () => {
  it('says Sleep starts on the second day', async () => {
    const user = await open({ firstRun: true })
    await answer('No', user)
    await user.click(screen.getByRole('button', { name: 'Finish setup' }))
    await screen.findByText('Here’s what’s set up')
    expect(screen.getByText(/^Second day/)).toBeInTheDocument()
    expect(screen.getByText(/day one has nothing to show yet/)).toBeInTheDocument()
  })

  it('a report on practices that were already there says their past entries are in it', async () => {
    for (const [practice, data_type] of [['Bedtime', 'Time'], ['Wake-up', 'Time'], ['Nap', 'Duration']] as const) have.push({ id: practice, practice, data_type, is_active: true })
    await open({ back: '/settings' })
    await screen.findByText('Here’s what’s set up')
    expect(screen.getByText('Your past entries are already in it.')).toBeInTheDocument()
    expect(screen.queryByText(/^Second day/)).not.toBeInTheDocument()
  })

  it('with one new practice among them, keeps the note about starting', async () => {
    have.push({ id: 'b', practice: 'Bedtime', data_type: 'Time', is_active: true }, { id: 'w', practice: 'Wake-up', data_type: 'Time', is_active: true })
    await open({ back: '/settings' })
    await screen.findByText('Here’s what’s set up')
    expect(screen.getByText(/^Second day/)).toBeInTheDocument()
    expect(screen.queryByText('Your past entries are already in it.')).not.toBeInTheDocument()
  })

  it('practices created by an earlier attempt of this run are not past entries', async () => {
    vi.mocked(chartsApi.createReport).mockRejectedValueOnce(offline())
    const user = await open({ firstRun: true })
    await answer('No', user)
    await user.click(screen.getByRole('button', { name: 'Finish setup' }))
    await user.click(await screen.findByRole('button', { name: 'Review my choices' }))
    await user.click(screen.getByRole('button', { name: 'Finish setup' }))
    await screen.findByText('Here’s what’s set up')
    expect(screen.getByText(/^Second day/)).toBeInTheDocument()
    expect(screen.queryByText('Your past entries are already in it.')).not.toBeInTheDocument()
  })

  it('shows the whole share link only after Yes, and says who can see it', async () => {
    const user = await open({ firstRun: true })
    await answer('Yes', user)
    await user.click(screen.getByRole('button', { name: 'Finish setup' }))
    await screen.findByText('Here’s what’s set up')
    expect(screen.getByText(`${window.location.origin}/shared/u-123`)).toBeInTheDocument()
    expect(screen.getByText('Anyone with this link can see your reports. It updates as you log.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument()
  })

  it('shows no link after No', async () => {
    const user = await open({ firstRun: true })
    await answer('No', user)
    await user.click(screen.getByRole('button', { name: 'Finish setup' }))
    await screen.findByText('Here’s what’s set up')
    expect(screen.queryByText(/\/shared\//)).not.toBeInTheDocument()
  })

  it('outside first run, leaves to where the guide was opened from', async () => {
    const user = await open({ back: '/settings' })
    await user.click(await screen.findByRole('button', { name: 'Done' }))
    expect(await screen.findByText('Settings')).toBeInTheDocument()
  })

  it('says Start logging when it leaves for Today from the app too', async () => {
    await open({ back: '/' })
    expect(await screen.findByRole('button', { name: 'Start logging' })).toBeInTheDocument()
  })

  it('has no exit link', async () => {
    const user = await open({ firstRun: true })
    await answer('No', user)
    await user.click(screen.getByRole('button', { name: 'Finish setup' }))
    await screen.findByText('Here’s what’s set up')
    expect(screen.queryByRole('button', { name: 'Build my own list' })).not.toBeInTheDocument()
  })

  it('shows the target and the goal beside the names', async () => {
    const user = userEvent.setup()
    qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    router = createMemoryRouter([{ path: '/guide', element: <GuideScreen /> }, { path: '/settings', element: <p>Settings</p> }], { initialEntries: [{ pathname: '/guide', state: { back: '/settings' } }] })
    render(<QueryClientProvider client={qc}><RouterProvider router={router} /></QueryClientProvider>)
    await user.click(screen.getByRole('switch', { name: 'Daily count' }))
    await user.click(screen.getByRole('switch', { name: 'Time spent' }))
    await user.click(screen.getByRole('button', { name: /^(Next|Create report)/ }))
    await screen.findByText(/^Set up · /)
    await act(async () => {})
    await user.click(screen.getByRole('button', { name: en.guide.suggest.count3 }))
    const target = screen.getByLabelText('How many a day')
    await user.type(target, '20')
    fireEvent.blur(target)
    await user.click(screen.getByRole('button', { name: /^(Next|Create report)/ }))
    await user.click(screen.getByRole('button', { name: en.guide.suggest.time1 }))
    const goal = screen.getByLabelText('Time a day')
    fireEvent.change(goal, { target: { value: '01:30' } })
    fireEvent.blur(goal)
    await user.click(screen.getByRole('button', { name: /^(Next|Create report)/ }))
    await screen.findByText('Here’s what’s set up')
    expect(screen.getByText(`${en.guide.suggest.count3} · 20 a day`)).toBeInTheDocument()
    expect(screen.getByText(`${en.guide.suggest.time1} · goal 1h 30m`)).toBeInTheDocument()
  })

  it('says Copied only when the copy worked', async () => {
    const user = await open({ firstRun: true })
    // After open: userEvent.setup puts its own clipboard in place.
    const writeText = vi.fn().mockRejectedValueOnce(new Error('denied')).mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    await answer('Yes', user)
    await user.click(screen.getByRole('button', { name: 'Finish setup' }))
    await screen.findByText('Here’s what’s set up')
    await user.click(screen.getByRole('button', { name: 'Copy' }))
    await act(async () => {})
    expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Copy' }))
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument()
  })
})

describe('from Add practice, on practices the person already has', () => {
  it('uses them, skips the reader, numbers a report kind they have, leaves everything unchanged, and returns to where it came from', async () => {
    have.push({ id: 'p-sleep', practice: 'Lights out', data_type: 'Time', is_active: true }, { id: 'p-wake', practice: 'Up', data_type: 'Time', is_active: true })
    made.push('Sleep')
    const user = userEvent.setup()
    qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const r = createMemoryRouter([{ path: '/guide', element: <GuideScreen /> }, { path: '/settings', element: <p>Settings</p> }], { initialEntries: [{ pathname: '/guide', state: { back: '/settings' } }] })
    render(<QueryClientProvider client={qc}><RouterProvider router={r} /></QueryClientProvider>)
    await user.click(await screen.findByRole('switch', { name: 'Sleep' }))
    await user.click(screen.getByRole('button', { name: /^(Next|Create report)/ }))
    await screen.findByText(/^Set up · /)
    await act(async () => {})
    await user.click(within(screen.getAllByRole('group', { name: 'Lights out' })[0]).getByRole('button', { name: 'Use' }))
    await user.click(within(screen.getAllByRole('group', { name: 'Up' })[1]).getByRole('button', { name: 'Use' }))
    await user.click(screen.getByRole('button', { name: /^(Next|Create report)/ }))
    // no reader question, no new practice but Nap, the second Sleep report is numbered, with the existing ids
    expect(await screen.findByText('Here’s what’s set up')).toBeInTheDocument()
    expect(practicesApi.createUserPractice).toHaveBeenCalledTimes(1)
    expect(practicesApi.createUserPractice).toHaveBeenCalledWith(expect.objectContaining({ practice: 'Nap' }))
    const [name, def] = vi.mocked(chartsApi.createReport).mock.calls[0]
    expect(name).toBe('Sleep 2')
    expect(JSON.stringify(def)).toContain('"bedtime":"p-sleep"')
    // A reused practice: no group.
    expect(practicesApi.createGroup).not.toHaveBeenCalled()
    expect(practicesApi.createUserPractice).toHaveBeenCalledWith(expect.objectContaining({ group_id: null }))
    expect(JSON.stringify(def)).toContain('"wake":"p-wake"')
    expect(practicesApi.updateUserPractice).not.toHaveBeenCalled()
    expect(practicesApi.deleteUserPractice).not.toHaveBeenCalled()
    expect(chartsApi.updateReport).not.toHaveBeenCalled()
    expect(chartsApi.deleteReport).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Done' }))
    expect(await screen.findByText('Settings')).toBeInTheDocument()
  })
})

describe('copy', () => {
  it('is in every language and promises nothing about privacy', () => {
    for (const l of [en, ru, uk]) {
      expect(Object.keys(l.guide.reader)).toEqual(Object.keys(en.guide.reader))
      expect(Object.keys(l.guide.finish)).toEqual(Object.keys(en.guide.finish))
    }
    expect(JSON.stringify(en.guide.reader) + JSON.stringify(en.guide.finish)).not.toMatch(/private|turn off|nothing is shared/i)
  })
})
