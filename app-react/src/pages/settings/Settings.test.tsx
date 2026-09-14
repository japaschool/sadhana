import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { EditPasswordPage } from './EditPasswordPage'
import { EditUserPage } from './EditUserPage'

vi.mock('../../api/auth', () => ({
  authApi: {
    updatePassword: vi.fn().mockResolvedValue({}),
    updateUser: vi.fn().mockResolvedValue({}),
  },
}))

vi.mock('../../store/authStore', () => ({
  useAuthStore: vi.fn((selector: (s: { user: { name: string; email: string } | null; logout: () => void }) => unknown) =>
    selector({ user: { name: 'Test User', email: 'test@example.com' }, logout: vi.fn() })
  ),
}))

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Routes>
          <Route path="/" element={ui} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('EditPasswordPage', () => {
  it('shows real-time mismatch error when passwords differ', async () => {
    wrap(<EditPasswordPage />)
    const inputs = screen.getAllByLabelText(/password/i)
    const newPass = inputs.find(i => i.id === 'new-password')!
    const confirmPass = inputs.find(i => i.id === 'confirm-password')!
    await userEvent.type(newPass, 'newpass123')
    await userEvent.type(confirmPass, 'wrongpass')
    expect(screen.getByText(/do not match/i)).toBeInTheDocument()
  })

  it('shows password visibility toggle on all fields', () => {
    wrap(<EditPasswordPage />)
    const toggles = screen.getAllByRole('button', { name: /show|hide password/i })
    expect(toggles).toHaveLength(3)
  })
})

describe('EditUserPage', () => {
  it('shows character counter', () => {
    wrap(<EditUserPage />)
    expect(screen.getByText(/\/50/)).toBeInTheDocument()
  })

  it('counter turns amber at 45 chars', async () => {
    wrap(<EditUserPage />)
    const input = screen.getByLabelText(/name/i)
    await userEvent.clear(input)
    await userEvent.type(input, 'a'.repeat(45))
    const counter = screen.getByText('45/50')
    expect(counter).toHaveStyle({ color: '#d97706' })
  })
})
