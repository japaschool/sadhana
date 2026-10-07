import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { SettingsTabletScreen } from './SettingsTablet'
import { setViewportWidth } from '../../../test/viewport'
import { useAuthStore } from '../../../store/authStore'

vi.mock('../../../hooks/useServiceWorkerUpdate', () => ({ useServiceWorkerUpdate: () => ({ updateReady: false, applyUpdate: vi.fn() }) }))

describe('SettingsTablet', () => {
  beforeEach(() => {
    setViewportWidth(834)
    useAuthStore.setState({ user: { id: '1', email: 't@e.st', token: 'tok', name: 'Test User' }, token: 'tok' })
  })

  it('shows Preferences first and switches the detail pane by section', () => {
    render(<MemoryRouter initialEntries={['/settings']}><SettingsTabletScreen /></MemoryRouter>)
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('heading', { level: 2, name: 'Preferences' })).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Preview channel' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Account & data' }))
    expect(screen.getByRole('button', { name: 'Account & data' })).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('link', { name: /Change password/ })).toHaveAttribute('href', '/settings/edit-password')
    expect(screen.queryByRole('switch', { name: 'Preview channel' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Logout' }))
    expect(screen.getByRole('dialog', { name: 'Log out?' })).toBeInTheDocument()
  })
})
