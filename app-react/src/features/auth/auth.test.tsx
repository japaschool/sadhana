import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { GuestRoute } from '../../layouts/GuestRoute'
import { ProtectedRoute } from '../../layouts/ProtectedRoute'
import { useAuthStore } from '../../store/authStore'
import { server } from '../../test/handlers/auth.handlers'
import { setViewportWidth } from '../../test/viewport'
import { Login } from './Login'
import { ConfirmRegistration, mismatch, Register } from './Register'

function renderAt(path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<GuestRoute />}>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/register/:id" element={<ConfirmRegistration />} />
          </Route>
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<p>Today</p>} />
            <Route path="/yatra/:id/join" element={<p>Invite page</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const signIn = async () => {
  await userEvent.type(screen.getByLabelText('Email'), 'test@example.com')
  await userEvent.type(screen.getByLabelText('Password'), 'secret')
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
}

describe('auth screens', () => {
  beforeEach(() => {
    setViewportWidth(390)
    useAuthStore.setState({ user: null, token: null, isLoading: false })
  })

  it('an invite opened signed out goes through Sign in and back to the invite', async () => {
    renderAt('/yatra/y1/join')
    await signIn()
    expect(await screen.findByText('Invite page')).toBeInTheDocument()
    expect(useAuthStore.getState().token).toBe('mock-token')
  })

  it('wrong credentials: a banner and both fields outlined', async () => {
    server.use(http.post('/api/users/login', () => HttpResponse.json({}, { status: 401 })))
    renderAt('/login')
    await signIn()
    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password')
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true')
  })

  it('a server error is a banner, not outlined fields', async () => {
    server.use(http.post('/api/users/login', () => HttpResponse.json({}, { status: 500 })))
    renderAt('/login')
    await signIn()
    expect(await screen.findByRole('alert')).toHaveTextContent('Server error')
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'false')
  })

  it('Show reveals the password as text', async () => {
    renderAt('/login')
    await userEvent.type(screen.getByLabelText('Password'), 'secret')
    await userEvent.click(screen.getByRole('button', { name: 'Show' }))
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text')
    expect(screen.getByRole('button', { name: 'Hide' })).toBeInTheDocument()
  })

  it('sign up sends a link, then counts down to Resend', async () => {
    renderAt('/register')
    await userEvent.type(screen.getByLabelText('Email'), 'new@example.com')
    await userEvent.click(screen.getByRole('button', { name: /send/i }))
    expect(await screen.findByText('Check your inbox.')).toBeInTheDocument()
    expect(screen.getByText('new@example.com')).toBeInTheDocument()
    expect(screen.getByRole('timer')).toHaveTextContent(/Resend in\s*60s/)
  })

  it('step 2: the confirmed email, and a mismatch blocks Create account', async () => {
    renderAt('/register/conf-1')
    expect(await screen.findByDisplayValue('test@example.com')).toHaveAttribute('readonly')
    await userEvent.type(screen.getByLabelText('Your name'), 'Alex')
    await userEvent.type(screen.getByLabelText('Password'), 'secret1')
    await userEvent.type(screen.getByLabelText('Confirm password'), 'secret2')
    expect(screen.getByRole('alert')).toHaveTextContent('Passwords do not match')
    expect(screen.getByRole('button', { name: /create account/i })).toBeDisabled()
  })

  it('an expired link offers Sign up again', async () => {
    server.use(http.get('/api/users/confirmation/:id', () => HttpResponse.json({}, { status: 404 })))
    renderAt('/register/old')
    expect(await screen.findByText('This link has expired.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sign up' })).toHaveAttribute('href', '/register')
  })

  it('a mismatch waits while the confirmation is still being typed toward a match', () => {
    expect(mismatch('secret', 'sec')).toBe(false)
    expect(mismatch('secret', 'sex')).toBe(true)
    expect(mismatch('secret', 'secret1')).toBe(true)
  })
})
