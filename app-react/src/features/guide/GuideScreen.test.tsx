import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setViewportWidth } from '../../test/viewport'
import { GuideScreen } from './GuideScreen'

vi.mock('../../api/guide', () => ({ guideApi: { start: vi.fn(), update: vi.fn() } }))
vi.mock('./MiniReport', () => ({ MiniReport: ({ kind }: { kind: string }) => <div data-testid={`mini-${kind}`} /> }))
import { guideApi } from '../../api/guide'
const api = vi.mocked(guideApi)

const routes = [{ path: '/guide', element: <GuideScreen /> }, { path: '/', element: <p>Today</p> }]
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
  it('Track and Skip move through the four reports and record each choice', async () => {
    const user = userEvent.setup()
    render(<RouterProvider router={router({ firstRun: true })} />)
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
    render(<RouterProvider router={router()} />)
    for (let i = 0; i < 4; i++) await user.click(screen.getByRole('button', { name: 'Skip' }))
    expect(screen.getByText('Nothing picked yet')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Look through again' }))
    pos(1)
  })

  it('Build my own list goes to Today and marks left', async () => {
    const user = userEvent.setup()
    render(<RouterProvider router={router()} />)
    for (let i = 0; i < 4; i++) await user.click(screen.getByRole('button', { name: 'Skip' }))
    const exits = screen.getAllByRole('button', { name: 'Build my own list' })
    await user.click(exits[exits.length - 1])
    expect(screen.getByText('Today')).toBeInTheDocument()
    await vi.waitFor(() => expect(api.update).toHaveBeenCalledWith('run-1', { outcome: 'left' }))
  })

  it('can be left from the first card, and has no Back there on first run', async () => {
    const user = userEvent.setup()
    render(<RouterProvider router={router({ firstRun: true })} />)
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Build my own list' }))
    expect(screen.getByText('Today')).toBeInTheDocument()
  })

  it('goes on when guide_runs fails', async () => {
    api.start.mockRejectedValue(new Error('down'))
    api.update.mockRejectedValue(new Error('down'))
    const user = userEvent.setup()
    render(<RouterProvider router={router()} />)
    await user.click(screen.getByRole('button', { name: 'Track this' }))
    pos(2)
  })

  it('reads first run from history state, so a reload keeps it; without it the run is add_practice', async () => {
    const first = router({ firstRun: true })
    const { unmount } = render(<RouterProvider router={first} />)
    unmount()
    render(<RouterProvider router={first} />)
    await vi.waitFor(() => expect(api.start).toHaveBeenCalledTimes(2))
    expect(api.start).toHaveBeenNthCalledWith(1, 'signup')
    expect(api.start).toHaveBeenNthCalledWith(2, 'signup')
    cleanup()
    render(<RouterProvider router={router()} />)
    await vi.waitFor(() => expect(api.start).toHaveBeenLastCalledWith('add_practice'))
  })
})

describe('GuideScreen on wide layouts', () => {
  it('Next is disabled until something is chosen, then goes to set up', async () => {
    setViewportWidth(1200)
    const user = userEvent.setup()
    render(<RouterProvider router={router({ firstRun: true })} />)
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
    await user.click(screen.getByRole('switch', { name: 'Sleep' }))
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByRole('heading', { name: 'Sleep' })).toBeInTheDocument()
  })
})
