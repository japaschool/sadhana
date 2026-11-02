import { cleanup, fireEvent, render, screen } from '@testing-library/react'
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

const routes = [{ path: '/guide', element: <GuideScreen /> }, { path: '/', element: <p>Today</p> }]
const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
const Providers = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
const router = (state?: unknown) => createMemoryRouter(routes, { initialEntries: [{ pathname: '/guide', state }] })
const pos = (n: number) => screen.getByText(`${n} of 4`)
const states = () => [...document.querySelectorAll('[data-state]')].map((d) => d.getAttribute('data-state'))

beforeEach(() => {
  vi.clearAllMocks()
  api.start.mockResolvedValue('run-1')
  api.update.mockResolvedValue(undefined)
  setViewportWidth(390)
})
afterEach(cleanup)

describe('GuideScreen on mobile', () => {
  it('a swipe back during a Track scroll moves the position back, not stuck on the target', async () => {
    const width = vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(300)
    Element.prototype.scrollIntoView = vi.fn()
    const user = userEvent.setup()
    const { container } = render(<Providers><RouterProvider router={router()} /></Providers>)
    await user.click(screen.getByRole('button', { name: 'Track this' }))
    pos(2)
    const strip = container.querySelector('.snap-x') as HTMLElement
    fireEvent.pointerDown(strip)
    strip.scrollLeft = 0
    fireEvent.scroll(strip)
    pos(1)
    width.mockRestore()
  })

  it('Track and Skip move through the four reports and record each choice', async () => {
    const user = userEvent.setup()
    render(<Providers><RouterProvider router={router({ firstRun: true })} /></Providers>)
    pos(1)
    expect(states()).toEqual(['cur', 'pending', 'pending', 'pending'])
    await user.click(screen.getByRole('button', { name: 'Track this' }))
    pos(2)
    await user.click(screen.getByRole('button', { name: 'Skip' }))
    pos(3)
    expect(states()).toEqual(['tracked', 'skipped', 'cur', 'pending'])
    await user.click(screen.getByRole('button', { name: 'Track this' }))
    await user.click(screen.getByRole('button', { name: 'Skip' }))
    expect(screen.getByRole('heading', { name: 'Sleep' })).toBeInTheDocument()
    await vi.waitFor(() => expect(api.update).toHaveBeenCalledWith('run-1', { last_step: 'setup_sleep' }))
  })

  it('shows the nothing-chosen screen after skipping all; look through again starts over', async () => {
    const user = userEvent.setup()
    render(<Providers><RouterProvider router={router()} /></Providers>)
    for (let i = 0; i < 4; i++) await user.click(screen.getByRole('button', { name: 'Skip' }))
    expect(screen.getByText('Nothing picked yet')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Look through again' }))
    pos(1)
  })

  it('Build my own list goes to Today and marks left', async () => {
    const user = userEvent.setup()
    render(<Providers><RouterProvider router={router()} /></Providers>)
    for (let i = 0; i < 4; i++) await user.click(screen.getByRole('button', { name: 'Skip' }))
    const exits = screen.getAllByRole('button', { name: 'Build my own list' })
    await user.click(exits[exits.length - 1])
    expect(screen.getByText('Today')).toBeInTheDocument()
    await vi.waitFor(() => expect(api.update).toHaveBeenCalledWith('run-1', { outcome: 'left' }))
  })

  it('can be left from the first card, and has no Back there on first run', async () => {
    const user = userEvent.setup()
    render(<Providers><RouterProvider router={router({ firstRun: true })} /></Providers>)
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Build my own list' }))
    expect(screen.getByText('Today')).toBeInTheDocument()
  })

  it('goes on when guide_runs fails', async () => {
    api.start.mockRejectedValue(new Error('down'))
    api.update.mockRejectedValue(new Error('down'))
    const user = userEvent.setup()
    render(<Providers><RouterProvider router={router()} /></Providers>)
    await user.click(screen.getByRole('button', { name: 'Track this' }))
    pos(2)
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
    await user.click(screen.getByRole('switch', { name: 'Days I did it' }))
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await user.click(screen.getByRole('button', { name: 'Back' }))
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('a chosen card says Tracking', async () => {
    setViewportWidth(1200)
    const user = userEvent.setup()
    render(<Providers><RouterProvider router={router()} /></Providers>)
    expect(screen.getAllByText('Track this')).toHaveLength(4)
    await user.click(screen.getByRole('switch', { name: 'Sleep' }))
    expect(screen.getByText('Tracking')).toBeInTheDocument()
  })

  it('Next is disabled until something is chosen, then goes to set up', async () => {
    setViewportWidth(1200)
    const user = userEvent.setup()
    render(<Providers><RouterProvider router={router({ firstRun: true })} /></Providers>)
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
    await user.click(screen.getByRole('switch', { name: 'Sleep' }))
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
    await user.click(screen.getByRole('switch', { name: 'Sleep' }))
    expect(screen.getByRole('button', { name: /^Next/ })).toBeEnabled()
  })
})
