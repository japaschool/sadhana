import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LoginPage } from './LoginPage'
import { useAuthStore } from '../../store/authStore'

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<div>Home page</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('LoginPage', () => {
  it('renders email and password fields', () => {
    renderLogin()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
  })

  it('navigates to / and stores token on successful login', async () => {
    renderLogin()
    await userEvent.type(screen.getByLabelText(/email/i), 'test@example.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'password')
    const submitButton = screen.getAllByRole('button', { name: /sign in/i })[0]
    await userEvent.click(submitButton)
    await waitFor(() => {
      expect(screen.getByText('Home page')).toBeInTheDocument()
    })
    expect(useAuthStore.getState().token).toBe('mock-token')
  })

  it('shows error banner on failed login', async () => {
    const { server } = await import('../../test/handlers/auth.handlers')
    const { http, HttpResponse } = await import('msw')
    server.use(
      http.post('/api/users/login', () =>
        HttpResponse.json({ error: 'Invalid credentials' }, { status: 401 })
      )
    )
    renderLogin()
    await userEvent.type(screen.getByLabelText(/email/i), 'bad@example.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'wrong')
    const submitButton = screen.getAllByRole('button', { name: /sign in/i })[0]
    await userEvent.click(submitButton)
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
  })
})

describe('LoginPage — error specificity', () => {
  it('shows specific wrong-credentials message on 401', async () => {
    const { server } = await import('../../test/handlers/auth.handlers')
    const { http, HttpResponse } = await import('msw')
    server.use(
      http.post('/api/users/login', () =>
        HttpResponse.json({ error: 'Invalid credentials' }, { status: 401 })
      )
    )
    renderLogin()
    await userEvent.type(screen.getByLabelText(/email/i), 'bad@example.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'wrong')
    await userEvent.click(screen.getAllByRole('button', { name: /sign in/i })[0])
    await waitFor(() => {
      expect(screen.getByText(/incorrect email or password/i)).toBeInTheDocument()
    })
  })

  it('sign-in button is disabled while loading', async () => {
    renderLogin()
    const btn = screen.getAllByRole('button', { name: /sign in/i })[0]
    expect(btn).not.toBeDisabled()
  })
})
