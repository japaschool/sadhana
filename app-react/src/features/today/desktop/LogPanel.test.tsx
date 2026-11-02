import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LogPanel } from './LogPanel'

vi.mock('../useToday', () => ({
  useToday: () => ({ summary: '', dayLoading: false, incomplete: new Set(), isLoading: false, isError: false, practices: [], seedStarters: vi.fn(), isSeeding: false, dayFailed: false }),
}))

function GuideState() {
  return <p>guide state {JSON.stringify(useLocation().state)}</p>
}

afterEach(cleanup)

describe('LogPanel', () => {
  it('opens the guide with the page it stands beside as the way back', async () => {
    const r = createMemoryRouter([
      { path: '/charts', element: <LogPanel date={new Date(2026, 10, 2)} onDate={vi.fn()} /> },
      { path: '/guide', element: <GuideState /> },
    ], { initialEntries: ['/charts'] })
    render(<RouterProvider router={r} />)
    await userEvent.click(screen.getByRole('button', { name: 'More' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Help me choose' }))
    expect(screen.getByText('guide state {"back":"/charts"}')).toBeInTheDocument()
  })
})
