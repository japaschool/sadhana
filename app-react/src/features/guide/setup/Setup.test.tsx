import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import en from '../../../../public/locales/en/translation.json'
import ru from '../../../../public/locales/ru/translation.json'
import uk from '../../../../public/locales/uk/translation.json'
import type { PracticeDataType, UserPractice } from '../../../types/api'
import { setViewportWidth } from '../../../test/viewport'
import { GuideScreen } from '../GuideScreen'
import type { GuideKind } from '../guideLogic'

vi.mock('../../../api/guide', () => ({ guideApi: { start: vi.fn(), update: vi.fn() } }))
vi.mock('../../../api/practices', () => ({ practicesApi: { getUserPractices: vi.fn() } }))
vi.mock('../../../api/charts', () => ({ chartsApi: { getReports: vi.fn().mockResolvedValue([]) } }))
vi.mock('../MiniReport', () => ({
  MiniReport: ({ kind, applied, head, footer }: { kind: string; applied?: unknown; head?: React.ReactNode; footer?: React.ReactNode }) => (
    <div data-testid={`mini-${kind}`}>{head}{footer}{applied !== undefined && <pre data-testid={`applied-${kind}`}>{JSON.stringify(applied)}</pre>}</div>
  ),
}))
import { guideApi } from '../../../api/guide'
import { practicesApi } from '../../../api/practices'

const mine = (practice: string, data_type: PracticeDataType, is_active = true): UserPractice => ({ id: `id-${practice}`, practice, data_type, is_active })
const NAMES: Record<GuideKind, string> = { sleep: 'Sleep', count: 'Daily count', time: 'Time spent', days: 'Days I did it', gaps: 'Days between', goals: 'Goals' }

function setup(practices: UserPractice[] = []) {
  vi.mocked(practicesApi.getUserPractices).mockResolvedValue(practices)
}

const next = () => screen.getByRole('button', { name: /^(Next|Create report)/ })
const applied = (kind: GuideKind) => JSON.parse(screen.getByTestId(`applied-${kind}`).textContent!)

/** Opens the guide on a wide layout with these reports tracked, on the first one's set up. */
async function start(kinds: GuideKind[], state?: unknown) {
  setViewportWidth(1200)
  const user = userEvent.setup()
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const r = createMemoryRouter([{ path: '/guide', element: <GuideScreen /> }, { path: '/', element: <p>Today</p> }], { initialEntries: [{ pathname: '/guide', state }] })
  render(<QueryClientProvider client={qc}><RouterProvider router={r} /></QueryClientProvider>)
  for (const k of kinds) await user.click(screen.getByRole('checkbox', { name: NAMES[k] }))
  await user.click(next())
  await screen.findByText(/^Set up · /)
  await act(async () => {}) // the practices load
  return user
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(guideApi.start).mockResolvedValue('run-1')
  vi.mocked(guideApi.update).mockResolvedValue(undefined)
  setup()
})
afterEach(cleanup)

/** Types into the (only) open name field, replacing what is there. */
async function rename(user: ReturnType<typeof userEvent.setup>, from: string, to: string) {
  const open = screen.queryByRole('button', { name: `Rename ${from}` })
  if (open) await user.click(open)
  const input = screen.getByRole('textbox', { name: 'Practice name' })
  await user.clear(input)
  if (to) await user.type(input, to)
  return input
}

describe('small things on the rows', () => {
  it('+ Name your own after a suggestion opens the name field', async () => {
    const user = await start(['count'])
    await user.click(screen.getByRole('button', { name: en.guide.suggest.count1 }))
    await user.click(screen.getByRole('button', { name: en.guide.setup.ownName }))
    expect(screen.getByRole('textbox', { name: 'Practice name' })).toBeInTheDocument()
    expect(screen.queryByText(en.guide.setup.clash.empty)).not.toBeInTheDocument()
  })

  it('a blank row’s buttons still say what they act on', async () => {
    const user = await start(['days'])
    await user.click(screen.getByRole('button', { name: en.guide.setup.ownName }))
    await user.click(screen.getByRole('button', { name: 'Done' }))
    expect(screen.getByRole('button', { name: 'Remove Practice name' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Rename Practice name' })).toBeInTheDocument()
  })

  it('a name stops at 64 characters, as in the form', async () => {
    const user = await start(['days'])
    await user.click(screen.getByRole('button', { name: en.guide.setup.ownName }))
    expect(screen.getByRole('textbox', { name: 'Practice name' })).toHaveAttribute('maxlength', '64')
  })
})

describe('with no connection and no practices cached', () => {
  afterEach(() => onlineManager.setOnline(true))

  it('says so instead of a Next that never wakes up, and carries on when back online', async () => {
    const user = userEvent.setup()
    setViewportWidth(1200)
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const r = createMemoryRouter([{ path: '/guide', element: <GuideScreen /> }], { initialEntries: ['/guide'] })
    onlineManager.setOnline(false)
    render(<QueryClientProvider client={qc}><RouterProvider router={r} /></QueryClientProvider>)
    await user.click(screen.getByRole('checkbox', { name: 'Sleep' }))
    await user.click(next())
    expect(await screen.findByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    await act(async () => { onlineManager.setOnline(true) })
    await vi.waitFor(() => expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument())
    expect(next()).toBeEnabled()
  })
})

describe('Sleep', () => {
  it('renames a practice in place, and it reaches the choices (trimmed)', async () => {
    const user = await start(['sleep', 'days'], { firstRun: true })
    await rename(user, 'Bedtime', '  Lights out  ')
    await user.click(screen.getByRole('button', { name: 'Done' }))
    expect(screen.getByText('Lights out')).toBeInTheDocument()
    expect(applied('sleep').bedtime).toBe('Lights out')
    // and it is kept when you go on and come back
    await user.click(next())
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByText('Lights out')).toBeInTheDocument()
  })

  it('blocks Next on an empty name, and on a whitespace-only one', async () => {
    const user = await start(['sleep'])
    expect(next()).toBeEnabled()
    await rename(user, 'Bedtime', '   ')
    expect(next()).toBeDisabled()
    expect(screen.getByText('Give every practice a name to continue')).toBeInTheDocument()
    await user.type(screen.getByRole('textbox', { name: 'Practice name' }), 'Lights out')
    expect(next()).toBeEnabled()
  })

  it('blocks Next when bedtime and wake-up share a name', async () => {
    const user = await start(['sleep'])
    await rename(user, 'Bedtime', 'Wake-up')
    expect(next()).toBeDisabled()
    expect(screen.getByText('Choose a different name to continue')).toBeInTheDocument()
  })

  it('starts at 6h and 9h, each clearable, and blocks min above max', async () => {
    const user = await start(['sleep'])
    expect(screen.getByLabelText('At least')).toHaveValue('06:00')
    expect(screen.getByLabelText('At most')).toHaveValue('09:00')
    const min = screen.getByLabelText('At least')
    await user.clear(min)
    await user.type(min, '1000')
    fireEvent.blur(min)
    expect(screen.getByRole('alert')).toHaveTextContent('Minimum sleep can’t be above maximum.')
    expect(screen.getByText('Fix the sleep range to continue')).toBeInTheDocument()
    expect(next()).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Clear At least' }))
    expect(screen.getByLabelText('At least')).toHaveValue('')
    expect(applied('sleep').min).toBeNull()
    expect(next()).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Clear At most' }))
    expect(applied('sleep').max).toBeNull()
  })

  it('Nap can be unticked, which drops it from the choices', async () => {
    const user = await start(['sleep'])
    expect(applied('sleep').nap).toBe('Nap')
    await user.click(screen.getByRole('checkbox', { name: 'Nap' }))
    expect(applied('sleep').nap).toBeNull()
  })
})

describe('a ticked extra left blank', () => {
  it('blocks Next for Nap', async () => {
    const user = await start(['sleep'])
    expect(next()).toBeEnabled()
    await rename(user, 'Nap', '')
    expect(next()).toBeDisabled()
    expect(screen.getByText('Give every practice a name to continue')).toBeInTheDocument()
  })

  it.each(['Done in the morning'])('blocks Next for %s once the count and target are filled in', async (extra) => {
    const user = await start(['count'])
    await user.click(screen.getByRole('button', { name: 'Pages read' }))
    const target = screen.getByLabelText('How many a day')
    await user.type(target, '20')
    fireEvent.blur(target)
    await user.click(screen.getByRole('checkbox', { name: extra }))
    expect(next()).toBeEnabled()
    await rename(user, extra, '  ')
    expect(next()).toBeDisabled()
    expect(screen.getByText('Give every practice a name to continue')).toBeInTheDocument()
  })
})

describe('when the practices cannot be loaded', () => {
  it('says so and Try again loads them', async () => {
    vi.mocked(practicesApi.getUserPractices).mockRejectedValueOnce(new Error('down'))
    const user = await start(['sleep'])
    expect(await screen.findByText('Something went wrong')).toBeInTheDocument()
    expect(next()).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    await vi.waitFor(() => expect(next()).toBeEnabled())
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument()
  })
})

describe('Daily count', () => {
  it('needs a target, which starts empty', async () => {
    const user = await start(['count'])
    expect(screen.getByLabelText('How many a day')).toHaveValue('')
    await user.click(screen.getByRole('button', { name: 'Pages read' }))
    expect(next()).toBeDisabled()
    expect(screen.getByText('Add a daily target to continue')).toBeInTheDocument()
    const target = screen.getByLabelText('How many a day')
    await user.type(target, '20')
    fireEvent.blur(target)
    expect(next()).toBeEnabled()
    expect(applied('count')).toMatchObject({ count: 'Pages read', target: 20 })
  })

  it('needs something to count', async () => {
    const user = await start(['count'])
    const target = screen.getByLabelText('How many a day')
    await user.type(target, '20')
    fireEvent.blur(target)
    expect(next()).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Prayers' }))
    expect(next()).toBeEnabled()
  })

  it('Done in the morning starts unticked, and How it went isn’t offered', async () => {
    const user = await start(['count'])
    expect(screen.getByRole('checkbox', { name: 'Done in the morning' })).not.toBeChecked()
    expect(screen.queryByRole('checkbox', { name: 'How it went' })).not.toBeInTheDocument()
    expect(applied('count')).toMatchObject({ early: null })
    await user.click(screen.getByRole('checkbox', { name: 'Done in the morning' }))
    expect(applied('count').early).toBe('Done in the morning')
    await rename(user, 'Done in the morning', '   ')
    expect(next()).toBeDisabled()
  })
})


describe('Days between', () => {
  it('needs an event; with nothing to compare it says so', async () => {
    const user = await start(['gaps'])
    expect(next()).toBeDisabled()
    expect(screen.getByText('Choose an event to continue')).toBeInTheDocument()
    expect(screen.getByText(/can be compared around the event/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Travel' }))
    expect(next()).toBeEnabled()
    expect(applied('gaps')).toEqual({ event: 'Travel', rows: [], sleep: false })
  })

  it('compares on a practice they have', async () => {
    setup([mine('Pages read', 'Int')])
    const user = await start(['gaps'])
    await user.click(screen.getByRole('button', { name: 'Sick day' }))
    await user.click(screen.getByRole('button', { name: 'Pages read' }))
    expect(applied('gaps').rows).toEqual(['Pages read'])
  })
})

describe('Goals', () => {
  it('a goal needs an amount; a new name is a yes/no practice', async () => {
    const user = await start(['goals'])
    expect(next()).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Walk' }))
    expect(screen.getByText('Give every goal an amount to continue')).toBeInTheDocument()
    const amount = screen.getByLabelText('Amount')
    await user.type(amount, '3')
    fireEvent.blur(amount)
    expect(next()).toBeEnabled()
    expect(applied('goals').goals).toEqual([{ name: 'Walk', type: 'Bool', direction: 'AtLeast', amount: 3, period: 'Week', counts: 'Total' }])
  })

  it('a goal on a Duration practice of theirs can count days', async () => {
    setup([mine('Reading', 'Duration')])
    const user = await start(['goals'])
    await user.click(screen.getByRole('button', { name: 'Use' }))
    expect(applied('goals').goals[0]).toMatchObject({ name: 'Reading', type: 'Duration' })
    expect(screen.getAllByRole('radiogroup', { name: 'Counts' }).length).toBeGreaterThan(0)
  })
})

describe('Time spent and Days I did it', () => {
  it.each([['time', 'Reading'], ['days', 'Walk']] as const)('%s needs at least one practice', async (kind, chip) => {
    const user = await start([kind])
    expect(next()).toBeDisabled()
    expect(screen.getByText('Choose at least one practice to continue')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: chip }))
    expect(next()).toBeEnabled()
    expect(applied(kind).names).toEqual([chip])
    await user.click(screen.getByRole('button', { name: chip }))
    expect(applied(kind).names).toEqual([])
  })

  it('a goal is optional and clearable', async () => {
    const user = await start(['time'])
    await user.click(screen.getByRole('button', { name: 'Reading' }))
    const goal = screen.getByLabelText('Time a day')
    await user.type(goal, '90')
    fireEvent.blur(goal)
    expect(applied('time').goal).toBe(90)
    await user.click(screen.getByRole('button', { name: 'Clear Time a day' }))
    expect(applied('time').goal).toBeNull()
  })

  it('stops at 8 Days practices with a message, 12 for Time spent', async () => {
    const user = await start(['days'])
    for (let i = 0; i < 8; i++) await user.click(screen.getByRole('button', { name: '+ Name your own' }))
    expect(applied('days').names).toHaveLength(8)
    expect(screen.getByText('A report can show up to 8 practices.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+ Name your own' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Walk' })).toBeDisabled()
    cleanup()
    const user2 = await start(['time'])
    for (let i = 0; i < 12; i++) await user2.click(screen.getByRole('button', { name: '+ Name your own' }))
    expect(applied('time').names).toHaveLength(12)
    expect(screen.getByText('A report can show up to 12 practices.')).toBeInTheDocument()
  })

  it('a practice can be removed', async () => {
    const user = await start(['days'])
    await user.click(screen.getByRole('button', { name: 'Walk' }))
    await user.click(screen.getByRole('button', { name: 'Remove Walk' }))
    expect(applied('days').names).toEqual([])
  })
})

describe('names that are taken', () => {
  it('asks for another name when a hidden practice has it, and does not fail', async () => {
    setup([mine('Pages read', 'Int', false)])
    const user = await start(['count'])
    await user.click(await screen.findByRole('button', { name: 'Pages read' }))
    const target = screen.getByLabelText('How many a day')
    await user.type(target, '20')
    fireEvent.blur(target)
    expect(screen.getByRole('alert')).toHaveTextContent('Pages read is hidden in your practices. Please choose a different name.')
    expect(next()).toBeDisabled()
    expect(screen.getByText('Choose a different name to continue')).toBeInTheDocument()
    await rename(user, 'Pages read', 'Pages read today')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(next()).toBeEnabled()
  })

  it('asks for another name when an active practice has another type', async () => {
    setup([mine('Walk', 'Int')])
    const user = await start(['days'])
    await user.click(await screen.findByRole('button', { name: 'Walk' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Walk is a Number practice, so it can’t be used here. Please choose a different name.')
    expect(next()).toBeDisabled()
  })

  it('offers Use for an active practice of the same type', async () => {
    setup([mine('Book reading', 'Duration')])
    const user = await start(['time'])
    await user.click(await screen.findByRole('button', { name: '+ Name your own' }))
    await user.type(screen.getByRole('textbox', { name: 'Practice name' }), 'Book reading')
    const msg = screen.getByRole('group', { name: 'You already have a practice with this name' })
    expect(within(msg).getByText(/Book reading is a Duration practice you already have/)).toBeInTheDocument()
    expect(next()).toBeEnabled()
    await user.click(within(msg).getByRole('button', { name: 'Use Book reading' }))
    expect(screen.getByText('Using Book reading')).toBeInTheDocument()
    expect(next()).toBeEnabled()
  })

  it('a typed name that is one of theirs moves to the list above once done', async () => {
    setup([mine('Book reading', 'Duration')])
    const user = await start(['time'])
    await user.click(await screen.findByRole('button', { name: '+ Name your own' }))
    await user.type(screen.getByRole('textbox', { name: 'Practice name' }), 'Book reading')
    await user.click(screen.getByRole('button', { name: 'Done' }))
    // it is theirs now: the list above holds it, and the row is gone
    expect(within(screen.getByRole('group', { name: 'Book reading' })).getByRole('button', { name: 'Using' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Rename Book reading' })).not.toBeInTheDocument()
  })

  it('shows the later screen a name used with two types, and cannot go on', async () => {
    const user = await start(['count', 'days'])
    await user.click(screen.getByRole('button', { name: 'Pages read' }))
    const target = screen.getByLabelText('How many a day')
    await user.type(target, '20')
    fireEvent.blur(target)
    await user.click(next())
    await user.click(screen.getByRole('button', { name: '+ Name your own' }))
    await user.type(screen.getByRole('textbox', { name: 'Practice name' }), 'Pages read')
    expect(screen.getByRole('alert')).toHaveTextContent('You’re using this name for something else in this setup. Please choose a different name.')
    expect(next()).toBeDisabled()
    // the screen stays: Finish can't be reached with it
    expect(screen.queryByRole('heading', { name: 'Finish' })).not.toBeInTheDocument()
    await rename(user, 'Pages read', 'Read today')
    expect(next()).toBeEnabled()
  })

  it('does not count a report that was dropped', async () => {
    const user = await start(['count', 'days'])
    await user.click(screen.getByRole('button', { name: 'Pages read' }))
    const target = screen.getByLabelText('How many a day')
    await user.type(target, '20')
    fireEvent.blur(target)
    await user.click(next())
    await user.click(screen.getByRole('button', { name: '+ Name your own' }))
    await user.type(screen.getByRole('textbox', { name: 'Practice name' }), 'Pages read')
    expect(screen.getByRole('alert')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Back' })) // count
    await user.click(screen.getByRole('button', { name: 'Back' })) // choose
    await user.click(screen.getByRole('checkbox', { name: 'Daily count' }))
    await user.click(next())
    expect(screen.getByRole('button', { name: 'Rename Pages read' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(next()).toBeEnabled()
  })
})

describe('layouts and leaving', () => {
  it('the wide preview gets the current choices', async () => {
    const user = await start(['count'])
    expect(applied('count')).toMatchObject({ target: null })
    await user.click(screen.getByRole('button', { name: 'Pages read' }))
    const target = screen.getByLabelText('How many a day')
    await user.type(target, '25')
    fireEvent.blur(target)
    expect(applied('count')).toMatchObject({ count: 'Pages read', target: 25 })
  })

  it('names the report after this one in Next, and the count of reports in the header', async () => {
    const user = await start(['sleep', 'days'])
    expect(screen.getByText('Set up · 1 of 2')).toBeInTheDocument()
    expect(next()).toHaveTextContent('Next: Days I did it')
    await user.click(next())
    expect(screen.getByText('Set up · 2 of 2')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Days I did it' })).toBeInTheDocument()
  })

  it('on a phone, the same screen has Next in a bar and no Back button in the form', async () => {
    setViewportWidth(390)
    const user = userEvent.setup()
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const r = createMemoryRouter([{ path: '/guide', element: <GuideScreen /> }], { initialEntries: ['/guide'] })
    render(<QueryClientProvider client={qc}><RouterProvider router={r} /></QueryClientProvider>)
    await user.click(screen.getByRole('checkbox', { name: 'Sleep' }))
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(await screen.findByText('Set up · 1 of 1')).toBeInTheDocument()
    expect(screen.queryByTestId('mini-sleep')).not.toBeInTheDocument()
    await rename(user, 'Bedtime', 'Lights out')
    expect(screen.getByRole('button', { name: /^(Next|Create report)/ })).toBeEnabled()
  })

  it('the leave sheet appears once a set up is done, and Keep setting up stays', async () => {
    const user = await start(['sleep', 'days'], { firstRun: true })
    await user.click(next())
    expect(screen.getAllByText(/^Set up · /).length).toBeGreaterThan(0)
    await user.click(screen.getAllByRole('button', { name: 'Build my own list' })[0])
    expect(screen.getByRole('heading', { name: 'Leave setup?' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Keep setting up' }))
    expect(screen.queryByRole('heading', { name: 'Leave setup?' })).not.toBeInTheDocument()
    expect(screen.getAllByText(/^Set up · /).length).toBeGreaterThan(0)
  })
})

describe('guide.setup translations', () => {
  const keys = (o: object, p = ''): string[] => Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' ? keys(v, `${p}${k}.`) : [`${p}${k}`])).sort()
  it('has the same keys in en, ru and uk', () => {
    const want = keys(en.guide.setup)
    expect(want.length).toBeGreaterThan(20)
    expect(keys(ru.guide.setup)).toEqual(want)
    expect(keys(uk.guide.setup)).toEqual(want)
  })
})

describe('your practices that fit', () => {
  const MINE = [mine('Book reading', 'Duration'), mine('Hidden one', 'Duration', false), mine('Steps', 'Int'), mine('Meditation', 'Duration')]

  it('lists compatible active practices first, with Use, and Using once picked', async () => {
    setup(MINE)
    const user = await start(['time'])
    const list = await screen.findByRole('group', { name: 'Book reading' })
    expect(screen.queryByRole('group', { name: 'Hidden one' })).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Steps' })).not.toBeInTheDocument()
    const heading = screen.getByRole('heading', { name: 'Your practices that fit' })
    expect(heading.compareDocumentPosition(screen.getByRole('heading', { name: 'Or start something new' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    await user.click(within(list).getByRole('button', { name: 'Use' }))
    expect(within(list).getByRole('button', { name: 'Using' })).toBeInTheDocument()
    // the picked row is not asked again whether to use it
    expect(screen.queryByRole('group', { name: 'You already have a practice with this name' })).not.toBeInTheDocument()
    expect(next()).toBeEnabled()
  })

  it('Use keeps the name exactly, and Using again lets it go', async () => {
    setup(MINE)
    const user = await start(['time'])
    const list = await screen.findByRole('group', { name: 'Book reading' })
    await user.click(within(list).getByRole('button', { name: 'Use' }))
    expect(applied('time').names).toEqual(['Book reading'])
    await user.click(within(list).getByRole('button', { name: 'Using' }))
    expect(applied('time').names).toEqual([])
  })

  it('marks a suggestion that exactly matches with "You already track this"', async () => {
    setup(MINE)
    await start(['time'])
    expect(await screen.findByRole('button', { name: 'Meditation', description: 'You already track this' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reading' })).not.toHaveAccessibleDescription('You already track this')
  })

  it('does not mark a suggestion whose practice is hidden', async () => {
    setup([mine('Reading', 'Duration', false)])
    await start(['time'])
    expect(screen.getByRole('button', { name: 'Reading' })).not.toHaveAccessibleDescription('You already track this')
  })

  it('keeps Using when you go on and come back, with no question about the name', async () => {
    setup(MINE)
    const user = await start(['time', 'days'])
    await user.click(within(await screen.findByRole('group', { name: 'Book reading' })).getByRole('button', { name: 'Use' }))
    await user.click(next())
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(within(await screen.findByRole('group', { name: 'Book reading' })).getByRole('button', { name: 'Using' })).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'You already have a practice with this name' })).not.toBeInTheDocument()
    expect(applied('time').names).toEqual(['Book reading'])
  })

  it('a practice in use has no row of its own to rename, and a second press releases it', async () => {
    setup(MINE)
    const user = await start(['time'])
    const list = await screen.findByRole('group', { name: 'Book reading' })
    await user.click(within(list).getByRole('button', { name: 'Use' }))
    expect(screen.queryByRole('button', { name: 'Rename Book reading' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remove Book reading' })).not.toBeInTheDocument()
    await user.click(within(list).getByRole('button', { name: 'Using' }))
    expect(applied('time').names).toEqual([])
  })

  it('offers the compatible ones for a single slot, and Use sets the name and asks nothing more', async () => {
    setup([mine('Lights out', 'Time'), mine('Steps', 'Int')])
    const user = await start(['sleep'])
    const [bed] = await screen.findAllByRole('group', { name: 'Lights out' })
    expect(screen.queryByRole('group', { name: 'Steps' })).not.toBeInTheDocument()
    await user.click(within(bed).getByRole('button', { name: 'Use' }))
    expect(applied('sleep').bedtime).toBe('Lights out')
    expect(screen.queryByRole('group', { name: 'You already have a practice with this name' })).not.toBeInTheDocument()
    expect(next()).toBeEnabled()
    await user.click(within(screen.getAllByRole('group', { name: 'Lights out' })[0]).getByRole('button', { name: 'Using' }))
    expect(applied('sleep').bedtime).toBe('Bedtime')
  })

  it('a picked slot offers Start a new one, not Rename, and leaves their practice alone', async () => {
    setup([mine('Lights out', 'Time')])
    const user = await start(['sleep'])
    await user.click(within((await screen.findAllByRole('group', { name: 'Lights out' }))[0]).getByRole('button', { name: 'Use' }))
    expect(screen.queryByRole('button', { name: 'Rename Lights out' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Start a new one' }))
    expect(screen.getByRole('textbox', { name: 'Practice name' })).toHaveValue('')
    expect(applied('sleep').bedtime).toBe('')
    await user.type(screen.getByRole('textbox', { name: 'Practice name' }), 'Early to bed')
    expect(applied('sleep').bedtime).toBe('Early to bed')
  })

  it('Daily count lists them too, and an unticked optional row can take one, which ticks it', async () => {
    setup([mine('Rounds', 'Int'), mine('Walk', 'Bool')])
    const user = await start(['count'])
    const [count, early] = await screen.findAllByRole('group', { name: 'Rounds' })
    expect(screen.queryByRole('group', { name: 'Walk' })).not.toBeInTheDocument()
    await user.click(within(count).getByRole('button', { name: 'Use' }))
    expect(applied('count').count).toBe('Rounds')
    expect(screen.queryByRole('group', { name: 'You already have a practice with this name' })).not.toBeInTheDocument()
    await user.click(within(early).getByRole('button', { name: 'Use' }))
    expect(applied('count').early).toBe('Rounds')
    expect(screen.getByRole('checkbox', { name: 'Done in the morning' })).toBeChecked()
    await user.click(within(screen.getAllByRole('group', { name: 'Rounds' })[1]).getByRole('button', { name: 'Using' }))
    expect(applied('count').early).toBeNull()
  })

  it('on first run, with nothing of theirs, lists nothing', async () => {
    await start(['sleep'], { firstRun: true })
    expect(screen.queryByText('Your practices that fit')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Rename Bedtime' })).toBeInTheDocument()
  })
})

describe('from Add practice', () => {
  it('the last button creates the report, on first run too', async () => {
    await start(['time'])
    expect(screen.getByRole('button', { name: 'Create report' })).toBeInTheDocument()
    cleanup()
    await start(['time'], { firstRun: true })
    expect(screen.getByRole('button', { name: 'Create report' })).toBeInTheDocument()
  })

  it('says to use what you log, and tags the list with the type', async () => {
    setup([mine('Book reading', 'Duration')])
    await start(['time'])
    expect(await screen.findByText('Use practices you already log, or start new ones.')).toBeInTheDocument()
    expect(within(screen.getByRole('heading', { name: 'Your practices that fit' }).parentElement!).getByText('Duration')).toBeInTheDocument()
  })
})
