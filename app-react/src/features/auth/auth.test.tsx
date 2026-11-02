import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GuestRoute } from '../../layouts/GuestRoute'
import { ProtectedRoute } from '../../layouts/ProtectedRoute'
import { useAuthStore } from '../../store/authStore'
import { mockUser, server } from '../../test/handlers/auth.handlers'
import { setViewportWidth } from '../../test/viewport'
import { Login } from './Login'
import { ConfirmRegistration, mismatch, Register } from './Register'

// Google's popup is replaced by an immediate token.
vi.mock('@react-oauth/google', () => ({
  GoogleOAuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useGoogleLogin: ({ onSuccess }: { onSuccess: (r: { access_token: string }) => void }) => () => onSuccess({ access_token: 'g-token' }),
}))
vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-client')

/** The guide route arrives in a later task: show where we landed. */
function Landed() {
  const { pathname, state } = useLocation()
  return <p>{`landed ${pathname} ${JSON.stringify(state)}`}</p>
}

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
          <Route path="/guide" element={<Landed />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/settings" element={<p>Settings</p>} />
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
    localStorage.clear()
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
      expect(await screen.findByText(/^landed \/guide/)).toBeInTheDocument()
    })

    it('an expired emailed link keeps the invite', async () => {
      server.use(http.get('/api/users/confirmation/:id', () => HttpResponse.json({}, { status: 404 })))
      renderAt(`/register/old?next=${encodeURIComponent(INVITE)}`)
      await userEvent.click(await screen.findByRole('link', { name: 'Sign up' }))
      expect(await sentNext()).toBe(INVITE)
    })
  })

  describe('after sign-up', () => {
    const google = async () => userEvent.click(await screen.findByRole('button', { name: /google/i }))
    const GUIDE = 'landed /guide {"firstRun":true}'

    it('a new email account opens the guide as first run', async () => {
      renderAt('/register/conf-1')
      await userEvent.type(await screen.findByLabelText('Your name'), 'Alex')
      await userEvent.type(screen.getByLabelText('Password'), 'secret1')
      await userEvent.type(screen.getByLabelText('Confirm password'), 'secret1')
      await userEvent.click(screen.getByRole('button', { name: /create account/i }))
      expect(await screen.findByText(GUIDE)).toBeInTheDocument()
    })

    it('registration asks the server to skip the default practices', async () => {
      let body: { user: { skip_defaults?: boolean } } | undefined
      server.use(http.post('/api/users', async ({ request }) => {
        body = (await request.json()) as typeof body
        return HttpResponse.json({ user: { id: 'u', email: 'a@b.c', token: 't', name: 'A' } })
      }))
      renderAt('/register/conf-1')
      await userEvent.type(await screen.findByLabelText('Your name'), 'Alex')
      await userEvent.type(screen.getByLabelText('Password'), 'secret1')
      await userEvent.type(screen.getByLabelText('Confirm password'), 'secret1')
      await userEvent.click(screen.getByRole('button', { name: /create account/i }))
      await screen.findByText(GUIDE)
      expect(body?.user.skip_defaults).toBe(true)
    })

    it('a new Google account opens the guide, and created is not stored', async () => {
      let sent: { skip_defaults?: boolean } | undefined
      server.use(http.post('/api/oauth/google', async ({ request }) => {
        sent = (await request.json()) as typeof sent
        return HttpResponse.json({ user: { ...mockUser, created: true } })
      }))
      renderAt('/register')
      await google()
      expect(await screen.findByText(GUIDE)).toBeInTheDocument()
      expect(sent?.skip_defaults).toBe(true)
      expect(localStorage.getItem('sadhana.user')).not.toContain('created')
      expect(useAuthStore.getState().user).not.toHaveProperty('created')
    })

    it('a returning Google user goes to Today', async () => {
      server.use(http.post('/api/oauth/google', () => HttpResponse.json({ user: mockUser })))
      renderAt('/login')
      await google()
      expect(await screen.findByText('Today')).toBeInTheDocument()
      expect(useAuthStore.getState().newAccount).toBe(false)
    })

    it('a new account with an invite goes to the join screen', async () => {
      server.use(http.post('/api/oauth/google', () => HttpResponse.json({ user: { ...mockUser, created: true } })))
      renderAt('/yatra/0f8fad5b-d9cb-469f-a165-70867728950e/join')
      await google()
      expect(await screen.findByText('Invite page')).toBeInTheDocument()
    })

    it('a new Google account that came from /settings still opens the guide', async () => {
      server.use(http.post('/api/oauth/google', () => HttpResponse.json({ user: { ...mockUser, created: true } })))
      renderAt('/settings')
      await google()
      expect(await screen.findByText(GUIDE)).toBeInTheDocument()
    })

    it('a returning user who came from /settings goes back to it', async () => {
      renderAt('/settings')
      await signIn()
      expect(await screen.findByText('Settings')).toBeInTheDocument()
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
