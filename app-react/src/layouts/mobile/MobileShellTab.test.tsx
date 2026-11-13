import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { MobileShell } from './MobileShell'

const renderAt = (path: string) => render(<MemoryRouter initialEntries={[path]}><MobileShell><p>x</p></MobileShell></MemoryRouter>)
const insightsTab = () => screen.getByRole('link', { name: 'Insights' })

afterEach(() => { vi.restoreAllMocks(); localStorage.clear() })

describe('Insights tab', () => {
  it('tab_reopens_last_insights_page', () => {
    renderAt('/insights/usual'); cleanup(); renderAt('/yatras')
    expect(insightsTab()).toHaveAttribute('href', '/insights/usual')
    cleanup(); renderAt('/charts'); cleanup(); renderAt('/yatras')
    expect(insightsTab()).toHaveAttribute('href', '/charts')
  })
  it('period_page_not_remembered', () => {
    renderAt('/insights/rhythm'); cleanup(); renderAt('/insights/period/p1'); cleanup(); renderAt('/')
    expect(insightsTab()).toHaveAttribute('href', '/insights/rhythm')
  })
  it('tab_survives_blocked_storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    renderAt('/insights/year'); cleanup(); renderAt('/yatras')
    expect(insightsTab()).toHaveAttribute('href', '/charts')
  })
})
