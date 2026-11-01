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
            <Route path="/yatras" element={<p>Yatras</p>} />
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

  describe('a new user with an invite', () => {
    const INVITE = '/yatra/0f8fad5b-d9cb-469f-a165-70867728950e/join'
    const finishSignUp = async () => {
      await userEvent.type(await screen.findByLabelText('Your name'), 'Alex')
      await userEvent.type(screen.getByLabelText('Password'), 'secret1')
      await userEvent.type(screen.getByLabelText('Confirm password'), 'secret1')
      await userEvent.click(screen.getByRole('button', { name: /create account/i }))
    }
    /** Sends the link from Register and resolves with the request's `next`. */
    const sentNext = async () => {
      let next: unknown = 'not sent'
      server.use(http.post('/api/users/confirmation', async ({ request }) => {
        next = ((await request.json()) as { data: { next?: string } }).data.next
        return HttpResponse.json({})
      }))
      await userEvent.type(screen.getByLabelText('Email'), 'new@example.com')
      await userEvent.click(screen.getByRole('button', { name: /send/i }))
      await screen.findByText('Check your inbox.')
      return next
    }

    it('the invite goes from Sign in through Sign up into the emailed link', async () => {
      renderAt(INVITE)
      await userEvent.click(await screen.findByRole('link', { name: 'Sign up' }))
      expect(await sentNext()).toBe(INVITE)
    })

    it('a sign-up with no invite sends no next', async () => {
      renderAt('/register')
      expect(await sentNext()).toBeUndefined()
    })

    it('a page other than an invite is not put in the email', async () => {
      renderAt('/yatras')
      await userEvent.click(await screen.findByRole('link', { name: 'Sign up' }))
      expect(await sentNext()).toBeUndefined()
    })

    it('the emailed link ends on the invite', async () => {
      renderAt(`/register/conf-1?next=${encodeURIComponent(INVITE)}`)
      await finishSignUp()
      expect(await screen.findByText('Invite page')).toBeInTheDocument()
    })

    it.each(['https://evil.example/', '//evil.example', '/settings', `${INVITE}/x`, '/yatra/not-a-uuid/join'])('ignores next=%s', async (next) => {
      renderAt(`/register/conf-1?next=${encodeURIComponent(next)}`)
      await finishSignUp()
      expect(await screen.findByText('Today')).toBeInTheDocument()
    })

    it('an expired emailed link keeps the invite', async () => {
      server.use(http.get('/api/users/confirmation/:id', () => HttpResponse.json({}, { status: 404 })))
      renderAt(`/register/old?next=${encodeURIComponent(INVITE)}`)
      await userEvent.click(await screen.findByRole('link', { name: 'Sign up' }))
      expect(await sentNext()).toBe(INVITE)
    })
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
