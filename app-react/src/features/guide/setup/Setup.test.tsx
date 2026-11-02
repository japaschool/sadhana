import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
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
vi.mock('../MiniReport', () => ({
  MiniReport: ({ kind, applied, head, footer }: { kind: string; applied?: unknown; head?: React.ReactNode; footer?: React.ReactNode }) => (
    <div data-testid={`mini-${kind}`}>{head}{footer}{applied !== undefined && <pre data-testid={`applied-${kind}`}>{JSON.stringify(applied)}</pre>}</div>
  ),
}))
import { guideApi } from '../../../api/guide'
import { practicesApi } from '../../../api/practices'

const mine = (practice: string, data_type: PracticeDataType, is_active = true): UserPractice => ({ id: `id-${practice}`, practice, data_type, is_active })
const NAMES: Record<GuideKind, string> = { sleep: 'Sleep', count: 'Daily count', time: 'Time spent', days: 'Days I did it' }

function setup(practices: UserPractice[] = []) {
  vi.mocked(practicesApi.getUserPractices).mockResolvedValue(practices)
}

const next = () => screen.getByRole('button', { name: /^Next/ })
const applied = (kind: GuideKind) => JSON.parse(screen.getByTestId(`applied-${kind}`).textContent!)

/** Opens the guide on a wide layout with these reports tracked, on the first one's set up. */
async function start(kinds: GuideKind[], state?: unknown) {
  setViewportWidth(1200)
  const user = userEvent.setup()
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const r = createMemoryRouter([{ path: '/guide', element: <GuideScreen /> }, { path: '/', element: <p>Today</p> }], { initialEntries: [{ pathname: '/guide', state }] })
  render(<QueryClientProvider client={qc}><RouterProvider router={r} /></QueryClientProvider>)
  for (const k of kinds) await user.click(screen.getByRole('switch', { name: NAMES[k] }))
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

describe('Sleep', () => {
  it('renames a practice in place, and it reaches the choices (trimmed)', async () => {
    const user = await start(['sleep'])
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

  it('How it went and Part done early start unticked', async () => {
    const user = await start(['count'])
    expect(screen.getByRole('checkbox', { name: 'Part done early' })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'How it went' })).not.toBeChecked()
    expect(applied('count')).toMatchObject({ early: null, how: null })
    await user.click(screen.getByRole('checkbox', { name: 'Part done early' }))
    expect(applied('count').early).toBe('Part done early')
    await rename(user, 'Part done early', '   ')
    expect(next()).toBeDisabled()
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
    await user.type(goal, '0130')
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

  it('Keep editing puts you back in the name', async () => {
    setup([mine('Book reading', 'Duration')])
    const user = await start(['time'])
    await user.click(await screen.findByRole('button', { name: '+ Name your own' }))
    await user.type(screen.getByRole('textbox', { name: 'Practice name' }), 'Book reading')
    await user.click(screen.getByRole('button', { name: 'Done' }))
    await user.click(screen.getByRole('button', { name: 'Keep editing' }))
    expect(screen.getByRole('textbox', { name: 'Practice name' })).toHaveFocus()
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
    await user.click(screen.getByRole('switch', { name: 'Daily count' }))
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
    await user.click(screen.getByRole('button', { name: 'Track this' }))
    for (let i = 0; i < 3; i++) await user.click(screen.getByRole('button', { name: 'Skip' }))
    expect(await screen.findByText('Set up · 1 of 1')).toBeInTheDocument()
    expect(screen.queryByTestId('mini-sleep')).not.toBeInTheDocument()
    await rename(user, 'Bedtime', 'Lights out')
    expect(screen.getByRole('button', { name: /^Next/ })).toBeEnabled()
  })

  it('the leave sheet appears once a set up is done, and Keep setting up stays', async () => {
    const user = await start(['sleep'])
    await user.click(next())
    expect(screen.getByRole('heading', { name: 'Finish' })).toBeInTheDocument()
    await user.click(screen.getAllByRole('button', { name: 'Build my own list' })[0])
    expect(screen.getByRole('heading', { name: 'Leave setup?' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Keep setting up' }))
    expect(screen.queryByRole('heading', { name: 'Leave setup?' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Finish' })).toBeInTheDocument()
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
