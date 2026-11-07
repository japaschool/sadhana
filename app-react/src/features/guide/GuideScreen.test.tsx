import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setViewportWidth } from '../../test/viewport'
import { GuideScreen } from './GuideScreen'

vi.mock('../../api/guide', () => ({ guideApi: { start: vi.fn(), update: vi.fn() } }))
vi.mock('../../api/practices', () => ({ practicesApi: { getUserPractices: vi.fn().mockResolvedValue([]) } }))
vi.mock('../../api/charts', () => ({ chartsApi: { getReports: vi.fn().mockResolvedValue([]) } }))
vi.mock('./MiniReport', () => ({ MiniReport: ({ kind, head, footer }: { kind: string; head?: React.ReactNode; footer?: React.ReactNode }) => <div data-testid={`mini-${kind}`}>{head}{footer}</div> }))
import { chartsApi } from '../../api/charts'
import { guideApi } from '../../api/guide'
const api = vi.mocked(guideApi)

const routes = [{ path: '/guide', element: <GuideScreen /> }, { path: '/', element: <p>Today</p> }, { path: '/settings/practices/new', element: <p>New practice form</p> }]
const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
const Providers = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
const router = (state?: unknown) => createMemoryRouter(routes, { initialEntries: [{ pathname: '/guide', state }] })
const pos = (n: number) => screen.getByText(`${n} of 6`)
const states = () => [...document.querySelectorAll('[data-state]')].map((d) => d.getAttribute('data-state'))

beforeEach(() => {
  vi.clearAllMocks()
  api.start.mockResolvedValue('run-1')
  api.update.mockResolvedValue(undefined)
  setViewportWidth(390)
})
afterEach(cleanup)

describe('the system Back button', () => {
  const opened = (state?: unknown, from = '/settings/practices') =>
    createMemoryRouter([...routes, { path: from, element: <p>Where it came from</p> }], { initialEntries: [from, { pathname: '/guide', state }], initialIndex: 1 })
  const back = (r: ReturnType<typeof opened>) => act(async () => { await r.navigate(-1) })
  /** To the last setup, with two reports tracked: the next step would create them. */
  const toSetup = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('checkbox', { name: 'Sleep' }))
    await user.click(screen.getByRole('checkbox', { name: 'Days I did it' }))
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await screen.findByRole('heading', { name: 'Sleep' })
    await user.click(await screen.findByRole('button', { name: /^Next/ }))
    await screen.findByRole('heading', { name: 'Days I did it' })
  }

  it('steps back inside the guide, staying there and marking nothing', async () => {
    const user = userEvent.setup()
    const r = opened({ firstRun: true })
    render(<Providers><RouterProvider router={r} /></Providers>)
    await toSetup(user)
    await back(r)
    expect(screen.getByRole('heading', { name: 'Sleep' })).toBeInTheDocument()
    expect(r.state.location.pathname).toBe('/guide')
    await back(r)
    pos(1)
    expect(r.state.location.pathname).toBe('/guide')
    expect(api.update).not.toHaveBeenCalledWith('run-1', { outcome: 'left' })
  })

  it('on the first card of a sign-up guide with something set up, asks before leaving; Back again keeps going', async () => {
    const user = userEvent.setup()
    const r = opened({ firstRun: true })
    render(<Providers><RouterProvider router={r} /></Providers>)
    await toSetup(user)
    await back(r)
    await back(r)
    await back(r)
    expect(screen.getByText('Leave setup?')).toBeInTheDocument()
    await back(r)
    expect(screen.queryByText('Leave setup?')).not.toBeInTheDocument()
    expect(r.state.location.pathname).toBe('/guide')
  })

  // The browser restores /guide asynchronously after a blocked POP, so a navigate from here would act on the wrong entry
  // (seen in real Chrome). The memory router can't show that, so these pin that the Back itself goes through: the action stays POP.
  it('on the first card of a sign-up guide with nothing set up, lets the Back through and marks left', async () => {
    const r = opened({ firstRun: true })
    render(<Providers><RouterProvider router={r} /></Providers>)
    await back(r)
    expect(await screen.findByText('Where it came from')).toBeInTheDocument()
    expect(r.state.historyAction).toBe('POP')
    await vi.waitFor(() => expect(api.update).toHaveBeenCalledWith('run-1', { outcome: 'left' }))
  })

  it('from Add practice with nothing set up, goes back to where it was opened', async () => {
    const r = opened({ back: '/settings/practices' })
    render(<Providers><RouterProvider router={r} /></Providers>)
    await back(r)
    expect(await screen.findByText('Where it came from')).toBeInTheDocument()
    expect(r.state.historyAction).toBe('POP')
  })

  it('after the leave sheet, leaving replaces the guide, so a reload cannot reopen it', async () => {
    const user = userEvent.setup()
    const r = opened({ firstRun: true })
    render(<Providers><RouterProvider router={r} /></Providers>)
    await toSetup(user)
    await back(r)
    await back(r)
    await back(r)
    await user.click(screen.getByRole('button', { name: 'Leave setup' }))
    expect(await screen.findByText('Today')).toBeInTheDocument()
    expect(r.state.historyAction).toBe('REPLACE')
  })

  it('does not get in the way of the guide’s own exit', async () => {
    const user = userEvent.setup()
    const r = opened({ firstRun: true })
    render(<Providers><RouterProvider router={r} /></Providers>)
    await user.click(screen.getAllByRole('button', { name: 'Build my own list' })[0])
    expect(await screen.findByText('Today')).toBeInTheDocument()
  })
})

describe('GuideScreen on mobile', () => {
  it('has one Next in a bar under the cards, disabled until a card is ticked', async () => {
    const user = userEvent.setup()
    render(<Providers><RouterProvider router={router()} /></Providers>)
    expect(screen.queryByRole('button', { name: /Skip|Track this/ })).not.toBeInTheDocument()
    const next = screen.getByRole('button', { name: 'Next' })
    expect(next.parentElement).toHaveClass('bg-ui-tabbar')
    expect(next).toBeDisabled()
    expect(screen.getByText('Choose at least one to continue')).toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: 'Sleep' }))
    expect(next).toBeEnabled()
    expect(screen.queryByText('Choose at least one to continue')).not.toBeInTheDocument()
  })

  it('a swipe during the scroll back to a card moves the position, not stuck on the target', async () => {
    const width = vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(300)
    Element.prototype.scrollIntoView = vi.fn()
    const user = userEvent.setup()
    const { container } = render(<Providers><RouterProvider router={router()} /></Providers>)
    await user.click(screen.getByRole('checkbox', { name: 'Days I did it' }))
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await user.click(await screen.findByRole('button', { name: 'Back' }))
    pos(4)
    const strip = container.querySelector('.snap-x') as HTMLElement
    fireEvent.pointerDown(strip)
    strip.scrollLeft = 0
    fireEvent.scroll(strip)
    pos(1)
    width.mockRestore()
  })

  it('a swipe moves the position; ticked cards show in the dots; Next sets up the ticked ones in order', async () => {
    const width = vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(300)
    const user = userEvent.setup()
    const { container } = render(<Providers><RouterProvider router={router({ firstRun: true })} /></Providers>)
    expect(states()).toEqual(['cur', 'pending', 'pending', 'pending', 'pending', 'pending'])
    await user.click(screen.getByRole('checkbox', { name: 'Daily count' }))
    await user.click(screen.getByRole('checkbox', { name: 'Sleep' }))
    const strip = container.querySelector('.snap-x') as HTMLElement
    strip.scrollLeft = 312 * 2
    fireEvent.scroll(strip)
    pos(3)
    expect(states()).toEqual(['tracked', 'tracked', 'cur', 'pending', 'pending', 'pending'])
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByRole('heading', { name: 'Sleep' })).toBeInTheDocument()
    expect(screen.getByText('Set up · 1 of 2')).toBeInTheDocument()
    await vi.waitFor(() => expect(api.update).toHaveBeenCalledWith('run-1', { last_step: 'setup_sleep' }))
    width.mockRestore()
  })

  it('can be left from the first card, marking left, and has no Back there on first run', async () => {
    const user = userEvent.setup()
    render(<Providers><RouterProvider router={router({ firstRun: true })} /></Providers>)
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Build my own list' }))
    expect(screen.getByText('Today')).toBeInTheDocument()
    await vi.waitFor(() => expect(api.update).toHaveBeenCalledWith('run-1', { outcome: 'left' }))
  })

  it('a tap on a card ticks it in place, and again unticks it', async () => {
    const user = userEvent.setup()
    render(<Providers><RouterProvider router={router()} /></Providers>)
    const sleep = screen.getByRole('checkbox', { name: 'Sleep' })
    await user.click(sleep)
    expect(sleep).toBeChecked()
    pos(1)
    expect(states()[0]).toBe('cur')
    expect(screen.getByText('1 chosen')).toBeInTheDocument()
    await user.click(sleep)
    expect(sleep).not.toBeChecked()
  })

  it('goes on when guide_runs fails', async () => {
    api.start.mockRejectedValue(new Error('down'))
    api.update.mockRejectedValue(new Error('down'))
    const user = userEvent.setup()
    render(<Providers><RouterProvider router={router()} /></Providers>)
    await user.click(screen.getByRole('checkbox', { name: 'Sleep' }))
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByRole('heading', { name: 'Sleep' })).toBeInTheDocument()
  })

  it('reads first run from history state, so a reload keeps it; without it the run is add_practice', async () => {
    const first = router({ firstRun: true })
    const { unmount } = render(<Providers><RouterProvider router={first} /></Providers>)
    unmount()
    render(<Providers><RouterProvider router={first} /></Providers>)
    await vi.waitFor(() => expect(api.start).toHaveBeenCalledTimes(2))
    expect(api.start).toHaveBeenNthCalledWith(1, 'signup')
    expect(api.start).toHaveBeenNthCalledWith(2, 'signup')
    cleanup()
    render(<Providers><RouterProvider router={router()} /></Providers>)
    await vi.waitFor(() => expect(api.start).toHaveBeenLastCalledWith('add_practice'))
  })
})

describe('GuideScreen on wide layouts', () => {
  it('has no Back on first run, and Back from set up needs one click on a later run', async () => {
    setViewportWidth(1200)
    const user = userEvent.setup()
    const { unmount } = render(<Providers><RouterProvider router={router({ firstRun: true })} /></Providers>)
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument()
    unmount()
    const r = createMemoryRouter([...routes, { path: '/settings', element: <p>Settings</p> }], { initialEntries: [{ pathname: '/guide', state: { back: '/settings' } }] })
    render(<Providers><RouterProvider router={r} /></Providers>)
    await user.click(screen.getByRole('checkbox', { name: 'Days I did it' }))
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await user.click(screen.getByRole('button', { name: 'Back' }))
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('a click on a tile ticks it, and again unticks it', async () => {
    setViewportWidth(1200)
    const user = userEvent.setup()
    render(<Providers><RouterProvider router={router()} /></Providers>)
    const sleep = screen.getByRole('checkbox', { name: 'Sleep' })
    expect(sleep).not.toBeChecked()
    await user.click(screen.getAllByText('Sleep')[0])
    expect(sleep).toBeChecked()
    await user.click(sleep)
    expect(sleep).not.toBeChecked()
  })

  it('Next is disabled until something is chosen, then goes to set up', async () => {
    setViewportWidth(1200)
    const user = userEvent.setup()
    render(<Providers><RouterProvider router={router({ firstRun: true })} /></Providers>)
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
    await user.click(screen.getByRole('checkbox', { name: 'Sleep' }))
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByRole('heading', { name: 'Sleep' })).toBeInTheDocument()
  })
})

describe('a report the person already has', () => {
  it('is marked on its card, and can still be tracked again', async () => {
    vi.mocked(chartsApi.getReports).mockResolvedValue([{ id: 'r1', name: 'My sleep', definition: { Panels: { version: 1, template: { Sleep: { bedtime: 'a', wake: 'b', nap: null, min: null, max: null } }, required: [], panels: [] } } } as never])
    setViewportWidth(1200)
    const user = userEvent.setup()
    render(<Providers><RouterProvider router={router()} /></Providers>)
    expect(await screen.findByText('You already have this report')).toBeInTheDocument()
    expect(screen.getAllByText('You already have this report')).toHaveLength(1)
    await user.click(screen.getByRole('checkbox', { name: 'Sleep' }))
    expect(screen.getByRole('button', { name: /^Next/ })).toBeEnabled()
  })
})

describe('opened from Add practice', () => {
  it('the way out is Add one myself, and it opens the form', async () => {
    const user = userEvent.setup()
    render(<Providers><RouterProvider router={router({ back: '/settings' })} /></Providers>)
    expect(screen.queryByRole('button', { name: 'Build my own list' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add one myself' }))
    expect(screen.getByText('New practice form')).toBeInTheDocument()
    await vi.waitFor(() => expect(api.update).toHaveBeenCalledWith('run-1', { outcome: 'left' }))
  })
})
