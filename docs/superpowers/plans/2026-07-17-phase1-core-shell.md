# Sadhana Pro — Phase 1: Core Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working React app in `/app-react/` where users can log in, register, and reset their password, with the tabbed shell (TopBar + BottomNav) rendering after authentication. Tab pages are placeholder stubs — fleshed out in later phases.

**Architecture:** New `/app-react/` directory. Auth state lives in Zustand, hydrated on load via `GET /api/user` using the `yew.token` localStorage key (same key the existing Yew app uses — seamless migration for existing users). React Router v7 handles routing; ProtectedRoute guards authenticated pages; GuestRoute redirects logged-in users away from auth pages.

**Tech Stack:** React 19, TypeScript 5.x, Tailwind CSS v4 (`@tailwindcss/vite`), React Router DOM v7, TanStack Query v5, Zustand v5, Axios, Framer Motion v12, react-i18next + i18next, react-icons v5, Vitest, React Testing Library, MSW v2

## Global Constraints

- Tailwind v4 — no `tailwind.config.js`; all configuration in CSS via `@theme` in `index.css`
- Token localStorage key: `yew.token` (must match existing Yew app for seamless migration)
- **Do NOT touch `static-react/`** — that is the separate marketing/landing site, leave it entirely alone
- API base URL from `VITE_API_BASE_URL` env var, default `/api`
- API response envelopes: login/register return `{ user: UserInfo }`, writable requests send matching envelope
- Rust serde default enum serialization — `PracticeDataType` variants are PascalCase strings (`"Int"`, `"Bool"`, etc.); `Value` variants serialize as `{ "Int": 5 }`, `{ "Bool": true }`, `{ "Time": { h, m } }`, etc.
- All user-visible strings via react-i18next — no hardcoded English in components
- Mobile-first — design for 375px viewport up; desktop is an enhancement
- Never touch `/static-react/` (the lander)
- Directory for this app: `/Users/antonona/Web_Dev/sadhana/app-react/`
- **Performance — React.memo:** Wrap `BottomNav`, `TopBar`, `Card`, `ErrorBanner`, `Spinner` with `memo()`. Do NOT memo `Button` or `Input` (they re-render with form state anyway).
- **Performance — Code splitting:** All page components in `router.tsx` use `React.lazy()` + named-export `.then(m => ({ default: m.PageName }))`. Wrap `<RouterProvider>` in `main.tsx` with `<Suspense fallback={<Spinner />}>`.
- **Performance — QueryClient:** Include `gcTime: 5 * 60_000` and `networkMode: 'offlineFirst'` in `defaultOptions.queries`.

---

## File Map

```
app-react/
  index.html
  vite.config.ts
  tsconfig.json
  tsconfig.app.json
  tsconfig.node.json
  vitest.config.ts
  .env.development
  public/
    locales/
      en/translation.json
      ru/translation.json
      uk/translation.json
  src/
    main.tsx                        # React root, QueryClient, i18n init
    router.tsx                      # All routes in one place
    index.css                       # Tailwind v4 + @theme tokens
    test/
      setup.ts                      # jest-dom + MSW server
      handlers/
        auth.handlers.ts            # MSW request handlers for auth endpoints
    types/
      api.ts                        # All TypeScript interfaces mirroring Rust models
    api/
      client.ts                     # Axios instance — auth header + 401 redirect
      auth.ts                       # login, register, getUser, sendConfirmation, etc.
    store/
      authStore.ts                  # Zustand store: user, token, isLoading, setToken, logout
    hooks/
      useAuth.ts                    # Thin hook over authStore
      useNetworkStatus.ts           # online/offline boolean — implemented in Phase 2
    components/
      ui/
        Button.tsx                  # primary (gold filled) | secondary (ghost teal)
        Input.tsx                   # dark surface input with label + error
        Spinner.tsx                 # centered loading indicator
        ErrorBanner.tsx             # inline API error display
        Card.tsx                    # rounded-2xl surface-1 card wrapper
      layout/
        TopBar.tsx                  # 56px fixed top bar
        BottomNav.tsx               # 64px fixed bottom nav — 4 tabs
        ProtectedRoute.tsx          # redirect to /login if no token
        GuestRoute.tsx              # redirect to / if already authenticated
        AppShell.tsx                # wraps authenticated pages with TopBar + BottomNav
    pages/
      auth/
        LoginPage.tsx
        RegisterPage.tsx            # sends confirmation email
        ConfirmationPage.tsx        # /register/:id — confirms email, then register form
        PwdResetRequestPage.tsx     # /reset — request reset link
        PwdResetPage.tsx            # /reset/:id — set new password
      home/
        HomePage.tsx                # placeholder
      charts/
        ChartsPage.tsx              # placeholder
      yatras/
        YatrasPage.tsx              # placeholder
      settings/
        SettingsPage.tsx            # placeholder
      NotFoundPage.tsx
```

---

### Task 1: Project Scaffold

**Files:**
- Create: `app-react/index.html`
- Create: `app-react/vite.config.ts`
- Create: `app-react/tsconfig.json`
- Create: `app-react/tsconfig.app.json`
- Create: `app-react/tsconfig.node.json`
- Create: `app-react/vitest.config.ts`
- Create: `app-react/.env.development`
- Create: `app-react/src/test/setup.ts`

**Interfaces:**
- Produces: `npm run dev`, `npm run build`, `npm run test` all work from `app-react/`

- [ ] **Step 1: Create the directory and install dependencies**

Run from `/Users/antonona/Web_Dev/sadhana/`:
```bash
mkdir app-react && cd app-react
npm create vite@latest . -- --template react-ts
```
When prompted, confirm overwrite of existing files (there are none — just confirm).

Then install all dependencies:
```bash
npm install react-router-dom @tanstack/react-query zustand axios framer-motion \
  react-i18next i18next i18next-browser-languagedetector i18next-http-backend \
  react-icons recharts

npm install -D tailwindcss @tailwindcss/vite vitest @vitest/ui \
  @testing-library/react @testing-library/user-event @testing-library/jest-dom \
  jsdom msw
```

- [ ] **Step 2: Write `vite.config.ts`**

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
})
```

- [ ] **Step 3: Write `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
})
```

- [ ] **Step 4: Update `tsconfig.app.json` to include vitest types**

Open `tsconfig.app.json` and add `"vitest/globals"` to the `types` array (create the `compilerOptions.types` array if it doesn't exist):
```json
{
  "compilerOptions": {
    "types": ["vitest/globals"]
  }
}
```
Keep all other generated fields.

- [ ] **Step 5: Write `src/test/setup.ts`**

```ts
import '@testing-library/jest-dom'
import { afterEach, beforeAll, afterAll } from 'vitest'
import { cleanup } from '@testing-library/react'
import { server } from './handlers/auth.handlers'

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
afterEach(() => { cleanup(); server.resetHandlers() })
afterAll(() => server.close())
```

- [ ] **Step 6: Write `.env.development`**

```
VITE_API_BASE_URL=/api
```

- [ ] **Step 7: Update `package.json` scripts**

Add `"test": "vitest run"` and `"test:watch": "vitest"` to the `scripts` section.

- [ ] **Step 8: Verify scaffold works**

```bash
npm run build
```
Expected: build succeeds with no errors (default Vite template App).

- [ ] **Step 9: Commit**

```bash
git add app-react/
git commit -m "feat(app-react): scaffold Vite + React + TS + Tailwind v4 project"
```

---

### Task 2: Design System

**Files:**
- Create: `app-react/src/index.css`
- Modify: `app-react/src/main.tsx` (import index.css)

**Interfaces:**
- Produces: custom Tailwind tokens available as `bg-surface-0`, `text-gold`, `border-teal`, etc. throughout the app

- [ ] **Step 1: Write `src/index.css`**

Replace the generated `index.css` entirely:
```css
@import "tailwindcss";

@theme {
  /* Surfaces */
  --color-surface-0: #0d1b2a;
  --color-surface-1: #1a2d42;
  --color-surface-2: #243d57;

  /* Accents */
  --color-teal: #2dd4bf;
  --color-gold: #f59e0b;
  --color-gold-light: #fbbf24;

  /* Text */
  --color-text-primary: #f1f5f9;
  --color-text-secondary: #94a3b8;
  --color-text-muted: #475569;

  /* Status */
  --color-danger: #ef4444;
  --color-success: #22c55e;

  /* Typography */
  --font-serif: Georgia, "Times New Roman", serif;
  --font-sans: ui-sans-serif, system-ui, sans-serif;
}

html, body, #root {
  height: 100%;
  background-color: #0d1b2a;
  color: #f1f5f9;
}

* {
  -webkit-tap-highlight-color: transparent;
}
```

- [ ] **Step 2: Verify tokens appear in dev server**

```bash
npm run dev
```
Open `http://localhost:5173`. The page should have a dark navy background (the `body` bg-color token). No build errors in terminal.

- [ ] **Step 3: Commit**

```bash
git add app-react/src/index.css app-react/src/main.tsx
git commit -m "feat(app-react): add Tailwind v4 design system tokens"
```

---

### Task 3: API Types

**Files:**
- Create: `app-react/src/types/api.ts`

**Interfaces:**
- Produces: `UserInfo`, `PracticeDataType`, `PracticeValue`, `UserPractice`, `DiaryEntry` — used by all API modules and components

- [ ] **Step 1: Write `src/types/api.ts`**

```ts
// Mirrors Rust model structs; serde default serialization (PascalCase enum variants)

export interface UserInfo {
  id: string
  email: string
  token: string
  name: string
}

export type PracticeDataType = 'Int' | 'Bool' | 'Time' | 'Text' | 'Duration'

// Rust serde default: enum variants with data serialize as { "VariantName": payload }
export type PracticeValue =
  | { Int: number }
  | { Bool: boolean }
  | { Time: { h: number; m: number } }
  | { Text: string }
  | { Duration: number }

export interface UserPractice {
  id: string
  practice: string
  data_type: PracticeDataType
  is_active: boolean
  is_required?: boolean
  dropdown_variants?: string
}

export interface DiaryEntry {
  practice: string
  data_type: PracticeDataType
  dropdown_variants?: string
  value?: PracticeValue
}

export interface Confirmation {
  id: string
  email: string
  expires_at: string
}

// API response envelopes
export interface UserInfoWrapper { user: UserInfo }
export interface SignupLinkDetailsWrapper { confirmation: Confirmation }
```

- [ ] **Step 2: Confirm TypeScript compiles**

```bash
npm run build
```
Expected: build succeeds, zero type errors.

- [ ] **Step 3: Commit**

```bash
git add app-react/src/types/
git commit -m "feat(app-react): add TypeScript API types mirroring Rust models"
```

---

### Task 4: API Client + Auth API

**Files:**
- Create: `app-react/src/api/client.ts`
- Create: `app-react/src/api/auth.ts`
- Create: `app-react/src/test/handlers/auth.handlers.ts`

**Interfaces:**
- Consumes: `UserInfo`, `UserInfoWrapper`, `Confirmation`, `SignupLinkDetailsWrapper` from `types/api.ts`
- Produces:
  - `apiClient` — Axios instance with auth header injection
  - `authApi.login(email, password): Promise<UserInfo>`
  - `authApi.register(confirmationId, email, password, name, lang): Promise<UserInfo>`
  - `authApi.getUser(): Promise<UserInfo>`
  - `authApi.sendConfirmationLink(email, type): Promise<void>` — type: `'Registration' | 'PasswordReset'`
  - `authApi.getConfirmationDetails(id): Promise<Confirmation>`
  - `authApi.resetPassword(confirmationId, password): Promise<void>`
  - `authApi.updateUser(name: string): Promise<void>`
  - `authApi.updatePassword(currentPassword: string, newPassword: string): Promise<void>`

- [ ] **Step 1: Write `src/api/client.ts`**

```ts
import axios from 'axios'

const TOKEN_KEY = 'yew.token'

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api',
  headers: { 'Content-Type': 'application/json' },
})

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) config.headers.Authorization = `Token ${token}`
  return config
})

apiClient.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY)
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)
```

- [ ] **Step 2: Write `src/api/auth.ts`**

```ts
import { apiClient } from './client'
import type { UserInfo, Confirmation } from '../types/api'

export const authApi = {
  async login(email: string, password: string): Promise<UserInfo> {
    const res = await apiClient.post<{ user: UserInfo }>('/users/login', {
      user: { email, password },
    })
    return res.data.user
  },

  async register(
    confirmationId: string,
    email: string,
    password: string,
    name: string,
    lang: string,
  ): Promise<UserInfo> {
    const res = await apiClient.post<{ user: UserInfo }>('/users', {
      user: { confirmation_id: confirmationId, email, password, name, lang },
    })
    return res.data.user
  },

  async getUser(): Promise<UserInfo> {
    const res = await apiClient.get<{ user: UserInfo }>('/user')
    return res.data.user
  },

  async sendConfirmationLink(
    email: string,
    confirmationType: 'Registration' | 'PasswordReset',
  ): Promise<void> {
    await apiClient.post('/users/confirmation', {
      data: {
        email,
        confirmation_type: confirmationType,
        server_address: window.location.origin,
      },
    })
  },

  async getConfirmationDetails(id: string): Promise<Confirmation> {
    const res = await apiClient.get<{ confirmation: Confirmation }>(
      `/users/confirmation/${id}`,
    )
    return res.data.confirmation
  },

  async resetPassword(confirmationId: string, password: string): Promise<void> {
    await apiClient.put('/password-reset', {
      data: { confirmation_id: confirmationId, password },
    })
  },

  async updateUser(name: string): Promise<void> {
    await apiClient.put('/user', { user: { name } })
  },

  async updatePassword(currentPassword: string, newPassword: string): Promise<void> {
    await apiClient.put('/user/password', {
      current_password: currentPassword,
      new_password: newPassword,
    })
  },
}
```

- [ ] **Step 3: Write MSW handlers `src/test/handlers/auth.handlers.ts`**

```ts
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

export const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  token: 'mock-token',
  name: 'Test User',
}

export const server = setupServer(
  http.post('/api/users/login', () =>
    HttpResponse.json({ user: mockUser })
  ),
  http.get('/api/user', () =>
    HttpResponse.json({ user: mockUser })
  ),
  http.post('/api/users', () =>
    HttpResponse.json({ user: mockUser })
  ),
  http.post('/api/users/confirmation', () =>
    HttpResponse.json({})
  ),
  http.get('/api/users/confirmation/:id', () =>
    HttpResponse.json({
      confirmation: {
        id: 'conf-1',
        email: 'test@example.com',
        expires_at: new Date(Date.now() + 86400000).toISOString(),
      },
    })
  ),
  http.put('/api/password-reset', () =>
    HttpResponse.json({})
  ),
)
```

- [ ] **Step 4: Write tests for `authApi`**

Create `src/api/auth.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { authApi } from './auth'
import { mockUser } from '../test/handlers/auth.handlers'

describe('authApi.login', () => {
  it('returns user info on success', async () => {
    const user = await authApi.login('test@example.com', 'password')
    expect(user).toEqual(mockUser)
  })
})

describe('authApi.getUser', () => {
  beforeEach(() => localStorage.setItem('yew.token', 'mock-token'))

  it('returns current user', async () => {
    const user = await authApi.getUser()
    expect(user.id).toBe('user-1')
    expect(user.email).toBe('test@example.com')
  })
})

describe('authApi.sendConfirmationLink', () => {
  it('resolves without error for Registration', async () => {
    await expect(
      authApi.sendConfirmationLink('test@example.com', 'Registration')
    ).resolves.toBeUndefined()
  })
})
```

- [ ] **Step 5: Run tests**

```bash
npm run test
```
Expected: 3 tests pass. If any fail due to MSW/jsdom version mismatch, check MSW v2 requires `TextEncoder` — add to `src/test/setup.ts` if needed:
```ts
import { TextEncoder, TextDecoder } from 'util'
Object.assign(global, { TextEncoder, TextDecoder })
```

- [ ] **Step 6: Commit**

```bash
git add app-react/src/api/ app-react/src/test/
git commit -m "feat(app-react): add axios API client and auth API module with MSW tests"
```

---

### Task 5: Auth Store

**Files:**
- Create: `app-react/src/store/authStore.ts`
- Create: `app-react/src/hooks/useAuth.ts`
- Create: `app-react/src/store/authStore.test.ts`

**Interfaces:**
- Consumes: `UserInfo` from `types/api.ts`; `authApi.getUser` from `api/auth.ts`
- Produces:
  - `useAuthStore()` — Zustand store with `{ user, token, isLoading, setAuth, logout, hydrate }`
  - `useAuth()` — convenience hook returning `{ user, token, isLoading, isAuthenticated, logout }`
  - `TOKEN_KEY = 'yew.token'` — exported constant

- [ ] **Step 1: Write failing test**

Create `src/store/authStore.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { act } from '@testing-library/react'
import { useAuthStore } from './authStore'

describe('authStore', () => {
  beforeEach(() => {
    localStorage.clear()
    useAuthStore.setState({ user: null, token: null, isLoading: false })
  })

  it('starts with null user and token', () => {
    const { user, token } = useAuthStore.getState()
    expect(user).toBeNull()
    expect(token).toBeNull()
  })

  it('setAuth stores token in localStorage and updates state', () => {
    act(() => {
      useAuthStore.getState().setAuth({
        id: '1', email: 'a@b.com', token: 'tok', name: 'Alice',
      })
    })
    expect(localStorage.getItem('yew.token')).toBe('tok')
    expect(useAuthStore.getState().token).toBe('tok')
    expect(useAuthStore.getState().user?.name).toBe('Alice')
  })

  it('logout clears token from localStorage and state', () => {
    localStorage.setItem('yew.token', 'tok')
    act(() => {
      useAuthStore.getState().setAuth({
        id: '1', email: 'a@b.com', token: 'tok', name: 'Alice',
      })
      useAuthStore.getState().logout()
    })
    expect(localStorage.getItem('yew.token')).toBeNull()
    expect(useAuthStore.getState().user).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test
```
Expected: FAIL — `Cannot find module './authStore'`

- [ ] **Step 3: Write `src/store/authStore.ts`**

```ts
import { create } from 'zustand'
import type { UserInfo } from '../types/api'

export const TOKEN_KEY = 'yew.token'

interface AuthState {
  user: UserInfo | null
  token: string | null
  isLoading: boolean
  setAuth: (user: UserInfo) => void
  logout: () => void
  setLoading: (v: boolean) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem(TOKEN_KEY),
  isLoading: true,
  setAuth: (user) => {
    localStorage.setItem(TOKEN_KEY, user.token)
    set({ user, token: user.token })
  },
  logout: () => {
    localStorage.removeItem(TOKEN_KEY)
    set({ user: null, token: null })
  },
  setLoading: (isLoading) => set({ isLoading }),
}))
```

- [ ] **Step 4: Write `src/hooks/useAuth.ts`**

```ts
import { useAuthStore } from '../store/authStore'

export function useAuth() {
  const { user, token, isLoading, logout } = useAuthStore()
  return { user, token, isLoading, isAuthenticated: !!token, logout }
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm run test
```
Expected: all tests pass (3 from Task 4 + 3 new).

- [ ] **Step 6: Commit**

```bash
git add app-react/src/store/ app-react/src/hooks/useAuth.ts
git commit -m "feat(app-react): add Zustand auth store and useAuth hook"
```

---

### Task 6: Shared UI Primitives

**Files:**
- Create: `app-react/src/components/ui/Button.tsx`
- Create: `app-react/src/components/ui/Input.tsx`
- Create: `app-react/src/components/ui/Spinner.tsx`
- Create: `app-react/src/components/ui/ErrorBanner.tsx`
- Create: `app-react/src/components/ui/Card.tsx`
- Create: `app-react/src/components/ui/Button.test.tsx`
- Create: `app-react/src/components/ui/Input.test.tsx`

**Interfaces:**
- Produces:
  - `<Button variant="primary"|"secondary" loading? disabled? onClick? type?>children</Button>`
  - `<Input label name value onChange error? type? placeholder? />`
  - `<Spinner />` — centered, gold color
  - `<ErrorBanner message? />` — null-safe, renders nothing if no message
  - `<Card className?>children</Card>`

- [ ] **Step 1: Write failing Button test**

Create `src/components/ui/Button.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from './Button'

describe('Button', () => {
  it('renders children', () => {
    render(<Button variant="primary">Save</Button>)
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
  })

  it('shows loading spinner and disables when loading', () => {
    render(<Button variant="primary" loading>Save</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
    expect(screen.getByRole('button').querySelector('svg')).toBeInTheDocument()
  })

  it('calls onClick when clicked', async () => {
    const onClick = vi.fn()
    render(<Button variant="primary" onClick={onClick}>Click me</Button>)
    await userEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
npm run test
```
Expected: FAIL — `Cannot find module './Button'`

- [ ] **Step 3: Write `src/components/ui/Button.tsx`**

```tsx
interface ButtonProps {
  variant: 'primary' | 'secondary'
  children: React.ReactNode
  loading?: boolean
  disabled?: boolean
  onClick?: () => void
  type?: 'button' | 'submit' | 'reset'
  className?: string
}

export function Button({
  variant,
  children,
  loading,
  disabled,
  onClick,
  type = 'button',
  className = '',
}: ButtonProps) {
  const base = 'flex items-center justify-center gap-2 rounded-full font-semibold transition-all duration-200 px-6 py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed'
  const variants = {
    primary: 'bg-gold text-surface-0 hover:bg-gold-light active:scale-95',
    secondary: 'border border-teal text-teal hover:bg-teal/10 active:scale-95',
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${base} ${variants[variant]} ${className}`}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      )}
      {children}
    </button>
  )
}
```

- [ ] **Step 4: Write `src/components/ui/Input.tsx`**

```tsx
interface InputProps {
  label: string
  name: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  error?: string
  type?: string
  placeholder?: string
  autoComplete?: string
}

export function Input({
  label,
  name,
  value,
  onChange,
  error,
  type = 'text',
  placeholder,
  autoComplete,
}: InputProps) {
  return (
    <div className="flex flex-col gap-1 w-full">
      <label htmlFor={name} className="text-sm font-medium text-text-secondary">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={`
          w-full rounded-xl bg-surface-2 border px-4 py-3 text-text-primary
          placeholder:text-text-muted outline-none transition-colors
          ${error ? 'border-danger' : 'border-white/8 focus:border-teal'}
        `}
      />
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 5: Write `src/components/ui/Spinner.tsx`**

```tsx
export function Spinner() {
  return (
    <div className="flex items-center justify-center p-8">
      <svg className="animate-spin h-8 w-8 text-gold" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
      </svg>
    </div>
  )
}
```

- [ ] **Step 6: Write `src/components/ui/ErrorBanner.tsx`**

```tsx
interface ErrorBannerProps {
  message?: string | null
}

export function ErrorBanner({ message }: ErrorBannerProps) {
  if (!message) return null
  return (
    <div role="alert" className="rounded-xl bg-danger/15 border border-danger/30 text-danger px-4 py-3 text-sm">
      {message}
    </div>
  )
}
```

- [ ] **Step 7: Write `src/components/ui/Card.tsx`**

```tsx
interface CardProps {
  children: React.ReactNode
  className?: string
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div className={`rounded-2xl bg-surface-1 border border-white/10 ${className}`}>
      {children}
    </div>
  )
}
```

- [ ] **Step 8: Write failing Input test**

Create `src/components/ui/Input.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Input } from './Input'

describe('Input', () => {
  it('renders label and input', () => {
    render(<Input label="Email" name="email" value="" onChange={vi.fn()} />)
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
  })

  it('shows error message', () => {
    render(<Input label="Email" name="email" value="" onChange={vi.fn()} error="Required" />)
    expect(screen.getByText('Required')).toBeInTheDocument()
  })

  it('calls onChange when user types', async () => {
    const onChange = vi.fn()
    render(<Input label="Email" name="email" value="" onChange={onChange} />)
    await userEvent.type(screen.getByLabelText('Email'), 'a')
    expect(onChange).toHaveBeenCalled()
  })
})
```

- [ ] **Step 9: Run all tests**

```bash
npm run test
```
Expected: all tests pass (6 from prior tasks + 6 new).

- [ ] **Step 10: Commit**

```bash
git add app-react/src/components/ui/
git commit -m "feat(app-react): add shared UI primitives — Button, Input, Spinner, ErrorBanner, Card"
```

---

### Task 7: Layout Components

**Files:**
- Create: `app-react/src/components/layout/TopBar.tsx`
- Create: `app-react/src/components/layout/BottomNav.tsx`
- Create: `app-react/src/components/layout/ProtectedRoute.tsx`
- Create: `app-react/src/components/layout/GuestRoute.tsx`
- Create: `app-react/src/components/layout/AppShell.tsx`
- Create: `app-react/src/components/layout/BottomNav.test.tsx`

**Interfaces:**
- Consumes: `useAuth()` from `hooks/useAuth.ts`
- Produces:
  - `<TopBar title? showBack? />` — renders logo on home tab, back arrow + title on sub-pages
  - `<BottomNav />` — 4 tabs: Home / Charts / Yatras / Settings, active tab highlighted gold
  - `<ProtectedRoute />` — renders `<Outlet />` if authenticated, else `<Navigate to="/login" />`
  - `<GuestRoute />` — renders `<Outlet />` if NOT authenticated, else `<Navigate to="/" />`
  - `<AppShell title? showBack? />` — composes TopBar + `<Outlet />` + BottomNav

- [ ] **Step 1: Write failing BottomNav test**

Create `src/components/layout/BottomNav.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { BottomNav } from './BottomNav'

function renderWithRouter(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <BottomNav />
    </MemoryRouter>
  )
}

describe('BottomNav', () => {
  it('renders all 4 tabs', () => {
    renderWithRouter('/')
    expect(screen.getByRole('link', { name: /home/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /charts/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /yatras/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /settings/i })).toBeInTheDocument()
  })

  it('highlights the active tab based on current path', () => {
    renderWithRouter('/charts')
    const chartsLink = screen.getByRole('link', { name: /charts/i })
    expect(chartsLink).toHaveClass('text-gold')
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
npm run test
```
Expected: FAIL — `Cannot find module './BottomNav'`

- [ ] **Step 3: Write `src/components/layout/BottomNav.tsx`**

```tsx
import { NavLink } from 'react-router-dom'
import { FaHome, FaChartBar, FaUsers, FaCog } from 'react-icons/fa'

const tabs = [
  { to: '/', label: 'Home', icon: FaHome, exact: true },
  { to: '/charts', label: 'Charts', icon: FaChartBar, exact: false },
  { to: '/yatras', label: 'Yatras', icon: FaUsers, exact: false },
  { to: '/settings', label: 'Settings', icon: FaCog, exact: false },
]

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 h-16 bg-surface-1 border-t border-white/10 flex items-center justify-around z-40 pb-safe">
      {tabs.map(({ to, label, icon: Icon, exact }) => (
        <NavLink
          key={to}
          to={to}
          end={exact}
          aria-label={label}
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 px-4 py-2 text-xs transition-colors ${
              isActive ? 'text-gold' : 'text-text-muted hover:text-text-secondary'
            }`
          }
        >
          <Icon className="w-5 h-5" />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
```

- [ ] **Step 4: Write `src/components/layout/TopBar.tsx`**

```tsx
import { useNavigate } from 'react-router-dom'
import { FaChevronLeft } from 'react-icons/fa'

interface TopBarProps {
  title?: string
  showBack?: boolean
}

export function TopBar({ title, showBack }: TopBarProps) {
  const navigate = useNavigate()

  return (
    <header className="fixed top-0 left-0 right-0 h-14 bg-surface-1/90 backdrop-blur-md border-b border-white/10 flex items-center px-4 z-40">
      {showBack ? (
        <button
          onClick={() => navigate(-1)}
          aria-label="Go back"
          className="mr-3 text-text-secondary hover:text-text-primary transition-colors"
        >
          <FaChevronLeft className="w-5 h-5" />
        </button>
      ) : (
        <span className="font-serif text-lg text-gold mr-3">Sadhana Pro</span>
      )}
      {title && (
        <h1 className="text-text-primary font-semibold text-base">{title}</h1>
      )}
    </header>
  )
}
```

- [ ] **Step 5: Write `src/components/layout/ProtectedRoute.tsx`**

```tsx
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { Spinner } from '../ui/Spinner'

export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return <Spinner />
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <Outlet />
}
```

- [ ] **Step 6: Write `src/components/layout/GuestRoute.tsx`**

```tsx
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { Spinner } from '../ui/Spinner'

export function GuestRoute() {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return <Spinner />
  if (isAuthenticated) return <Navigate to="/" replace />
  return <Outlet />
}
```

- [ ] **Step 7: Write `src/components/layout/AppShell.tsx`**

```tsx
import { Outlet } from 'react-router-dom'
import { TopBar } from './TopBar'
import { BottomNav } from './BottomNav'

interface AppShellProps {
  title?: string
  showBack?: boolean
}

export function AppShell({ title, showBack }: AppShellProps) {
  return (
    <div className="min-h-screen bg-surface-0">
      <TopBar title={title} showBack={showBack} />
      <main className="pt-14 pb-16">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
```

- [ ] **Step 8: Run all tests**

```bash
npm run test
```
Expected: all tests pass (12 prior + 2 new).

- [ ] **Step 9: Commit**

```bash
git add app-react/src/components/layout/
git commit -m "feat(app-react): add layout components — TopBar, BottomNav, ProtectedRoute, GuestRoute, AppShell"
```

---

### Task 8: i18n Setup + Placeholder Tab Pages

**Files:**
- Create: `app-react/public/locales/en/translation.json`
- Create: `app-react/public/locales/ru/translation.json`
- Create: `app-react/public/locales/uk/translation.json`
- Create: `app-react/src/i18n.ts`
- Create: `app-react/src/pages/home/HomePage.tsx`
- Create: `app-react/src/pages/charts/ChartsPage.tsx`
- Create: `app-react/src/pages/yatras/YatrasPage.tsx`
- Create: `app-react/src/pages/settings/SettingsPage.tsx`
- Create: `app-react/src/pages/NotFoundPage.tsx`

**Interfaces:**
- Produces: `useTranslation()` available in all components; 4 stub tab pages that render their tab name

- [ ] **Step 1: Write `src/i18n.ts`**

```ts
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import HttpBackend from 'i18next-http-backend'

i18n
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    supportedLngs: ['en', 'ru', 'uk'],
    backend: { loadPath: '/locales/{{lng}}/translation.json' },
    detection: { order: ['localStorage', 'navigator'], caches: ['localStorage'] },
    interpolation: { escapeValue: false },
  })

export default i18n
```

- [ ] **Step 2: Write `public/locales/en/translation.json`**

```json
{
  "nav": {
    "home": "Home",
    "charts": "Charts",
    "yatras": "Yatras",
    "settings": "Settings"
  },
  "auth": {
    "login": "Sign In",
    "register": "Create Account",
    "email": "Email",
    "password": "Password",
    "name": "Your name",
    "forgotPassword": "Forgot password?",
    "noAccount": "Don't have an account?",
    "hasAccount": "Already have an account?",
    "signUp": "Sign up",
    "signIn": "Sign in",
    "sendLink": "Send reset link",
    "newPassword": "New password",
    "confirmPassword": "Confirm password",
    "setPassword": "Set new password",
    "checkEmail": "Check your email for a confirmation link.",
    "passwordMismatch": "Passwords do not match",
    "resetSent": "Reset link sent — check your email.",
    "confirmationExpired": "This link has expired."
  },
  "common": {
    "loading": "Loading…",
    "error": "Something went wrong",
    "save": "Save",
    "cancel": "Cancel",
    "back": "Back"
  }
}
```

- [ ] **Step 3: Write `public/locales/ru/translation.json` and `public/locales/uk/translation.json`**

`ru/translation.json` (minimal — auth only):
```json
{
  "nav": { "home": "Главная", "charts": "Графики", "yatras": "Ятры", "settings": "Настройки" },
  "auth": {
    "login": "Войти", "register": "Создать аккаунт", "email": "Email",
    "password": "Пароль", "name": "Ваше имя", "forgotPassword": "Забыли пароль?",
    "noAccount": "Нет аккаунта?", "hasAccount": "Уже есть аккаунт?",
    "signUp": "Зарегистрироваться", "signIn": "Войти",
    "sendLink": "Отправить ссылку", "newPassword": "Новый пароль",
    "confirmPassword": "Подтвердить пароль", "setPassword": "Установить пароль",
    "checkEmail": "Проверьте почту — мы отправили вам ссылку.",
    "passwordMismatch": "Пароли не совпадают",
    "resetSent": "Ссылка отправлена — проверьте почту.",
    "confirmationExpired": "Ссылка устарела."
  },
  "common": { "loading": "Загрузка…", "error": "Что-то пошло не так", "save": "Сохранить", "cancel": "Отмена", "back": "Назад" }
}
```

`uk/translation.json`:
```json
{
  "nav": { "home": "Головна", "charts": "Графіки", "yatras": "Ятри", "settings": "Налаштування" },
  "auth": {
    "login": "Увійти", "register": "Створити акаунт", "email": "Email",
    "password": "Пароль", "name": "Ваше ім'я", "forgotPassword": "Забули пароль?",
    "noAccount": "Немає акаунту?", "hasAccount": "Вже є акаунт?",
    "signUp": "Зареєструватися", "signIn": "Увійти",
    "sendLink": "Надіслати посилання", "newPassword": "Новий пароль",
    "confirmPassword": "Підтвердити пароль", "setPassword": "Встановити пароль",
    "checkEmail": "Перевірте пошту — ми надіслали вам посилання.",
    "passwordMismatch": "Паролі не збігаються",
    "resetSent": "Посилання надіслано — перевірте пошту.",
    "confirmationExpired": "Посилання застаріло."
  },
  "common": { "loading": "Завантаження…", "error": "Щось пішло не так", "save": "Зберегти", "cancel": "Скасувати", "back": "Назад" }
}
```

- [ ] **Step 4: Write placeholder tab pages**

`src/pages/home/HomePage.tsx`:
```tsx
import { useTranslation } from 'react-i18next'

export function HomePage() {
  const { t } = useTranslation()
  return (
    <div className="flex items-center justify-center h-64 text-text-muted">
      {t('nav.home')} — coming in Phase 2
    </div>
  )
}
```

Repeat the same pattern for `ChartsPage.tsx` (key: `nav.charts`), `YatrasPage.tsx` (key: `nav.yatras`), `SettingsPage.tsx` (key: `nav.settings`).

`src/pages/NotFoundPage.tsx`:
```tsx
import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center h-screen gap-4 text-text-secondary">
      <p className="text-4xl font-serif text-gold">404</p>
      <p>Page not found</p>
      <Link to="/" className="text-teal underline">Go home</Link>
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add app-react/public/locales/ app-react/src/i18n.ts app-react/src/pages/
git commit -m "feat(app-react): add i18n setup (EN/RU/UK) and placeholder tab pages"
```

---

### Task 9: Router + App Wiring

**Files:**
- Create: `app-react/src/router.tsx`
- Modify: `app-react/src/main.tsx`

**Interfaces:**
- Consumes: All pages and layout components from prior tasks
- Produces: Fully wired app where navigating to `/login` shows the login page and `/` requires auth

- [ ] **Step 1: Write `src/router.tsx`**

```tsx
import { createBrowserRouter } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { ProtectedRoute } from './components/layout/ProtectedRoute'
import { GuestRoute } from './components/layout/GuestRoute'
import { HomePage } from './pages/home/HomePage'
import { ChartsPage } from './pages/charts/ChartsPage'
import { YatrasPage } from './pages/yatras/YatrasPage'
import { SettingsPage } from './pages/settings/SettingsPage'
import { LoginPage } from './pages/auth/LoginPage'
import { RegisterPage } from './pages/auth/RegisterPage'
import { ConfirmationPage } from './pages/auth/ConfirmationPage'
import { PwdResetRequestPage } from './pages/auth/PwdResetRequestPage'
import { PwdResetPage } from './pages/auth/PwdResetPage'
import { NotFoundPage } from './pages/NotFoundPage'

export const router = createBrowserRouter([
  {
    element: <GuestRoute />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
      { path: '/register/:id', element: <ConfirmationPage /> },
      { path: '/reset', element: <PwdResetRequestPage /> },
      { path: '/reset/:id', element: <PwdResetPage /> },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: '/', element: <HomePage /> },
          { path: '/charts', element: <ChartsPage /> },
          { path: '/yatras', element: <YatrasPage /> },
          { path: '/settings', element: <SettingsPage /> },
        ],
      },
    ],
  },
  { path: '/shared/:id', element: <div>Shared chart — Phase 4</div> },
  { path: '*', element: <NotFoundPage /> },
])
```

- [ ] **Step 2: Write `src/main.tsx`**

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './i18n'
import './index.css'
import { router } from './router'
import { useAuthStore } from './store/authStore'
import { authApi } from './api/auth'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, retry: 1, refetchOnWindowFocus: true },
  },
})

async function hydrateAuth() {
  const { setAuth, setLoading, token } = useAuthStore.getState()
  if (!token) { setLoading(false); return }
  try {
    const user = await authApi.getUser()
    setAuth(user)
  } catch {
    // token invalid — logout happens via 401 interceptor
  } finally {
    setLoading(false)
  }
}

hydrateAuth().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </React.StrictMode>
  )
})
```

- [ ] **Step 3: Run tests**

```bash
npm run test
```
Expected: all existing tests pass. The auth stub pages (LoginPage etc.) don't exist yet — add temporary stubs so the router import doesn't fail:

Create `src/pages/auth/LoginPage.tsx` (stub):
```tsx
export function LoginPage() { return <div>Login — Task 10</div> }
```
Do the same for `RegisterPage.tsx`, `ConfirmationPage.tsx`, `PwdResetRequestPage.tsx`, `PwdResetPage.tsx`.

- [ ] **Step 4: Verify dev server shows the app shell**

```bash
npm run dev
```
Open `http://localhost:5173`. Expected: dark navy background, redirected to `/login` (stub text visible). Navigating to `/login` shows "Login — Task 10". No console errors.

- [ ] **Step 5: Commit**

```bash
git add app-react/src/router.tsx app-react/src/main.tsx app-react/src/pages/auth/
git commit -m "feat(app-react): wire router and app entry point — auth hydration on startup"
```

---

### Task 10: Login Page

**Files:**
- Modify: `app-react/src/pages/auth/LoginPage.tsx`
- Create: `app-react/src/pages/auth/LoginPage.test.tsx`

**Interfaces:**
- Consumes: `authApi.login` from `api/auth.ts`; `useAuthStore.setAuth` from store; `Button`, `Input`, `ErrorBanner`, `Card` from `components/ui`
- Produces: Working login form — on success stores token and navigates to `/`

- [ ] **Step 1: Write failing test**

Create `src/pages/auth/LoginPage.test.tsx`:
```tsx
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
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
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
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
npm run test -- --reporter=verbose src/pages/auth/LoginPage.test.tsx
```
Expected: tests fail — LoginPage is a stub.

- [ ] **Step 3: Write `src/pages/auth/LoginPage.tsx`**

```tsx
import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { authApi } from '../../api/auth'
import { useAuthStore } from '../../store/authStore'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { ErrorBanner } from '../../components/ui/ErrorBanner'
import { Card } from '../../components/ui/Card'

export function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const user = await authApi.login(email, password)
      setAuth(user)
      navigate('/', { replace: true })
    } catch {
      setError(t('common.error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-0 flex items-center justify-center px-4">
      <Card className="w-full max-w-sm p-6 flex flex-col gap-5">
        <h1 className="font-serif text-2xl text-gold text-center">Sadhana Pro</h1>
        <h2 className="font-semibold text-text-primary text-center text-lg">{t('auth.login')}</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label={t('auth.email')}
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          <Input
            label={t('auth.password')}
            name="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          <ErrorBanner message={error} />
          <Button variant="primary" type="submit" loading={loading} className="w-full">
            {t('auth.signIn')}
          </Button>
        </form>
        <div className="text-center text-sm text-text-secondary flex flex-col gap-2">
          <Link to="/reset" className="text-teal hover:underline">{t('auth.forgotPassword')}</Link>
          <span>
            {t('auth.noAccount')}{' '}
            <Link to="/register" className="text-teal hover:underline">{t('auth.signUp')}</Link>
          </span>
        </div>
      </Card>
    </div>
  )
}
```

- [ ] **Step 4: Run tests**

```bash
npm run test
```
Expected: all tests pass including the 3 new LoginPage tests.

- [ ] **Step 5: Commit**

```bash
git add app-react/src/pages/auth/LoginPage.tsx app-react/src/pages/auth/LoginPage.test.tsx
git commit -m "feat(app-react): implement Login page with tests"
```

---

### Task 11: Register + Confirmation + Password Reset Pages

**Files:**
- Modify: `app-react/src/pages/auth/RegisterPage.tsx`
- Modify: `app-react/src/pages/auth/ConfirmationPage.tsx`
- Modify: `app-react/src/pages/auth/PwdResetRequestPage.tsx`
- Modify: `app-react/src/pages/auth/PwdResetPage.tsx`
- Create: `app-react/src/pages/auth/RegisterPage.test.tsx`

**Interfaces:**
- Consumes: `authApi.sendConfirmationLink`, `authApi.getConfirmationDetails`, `authApi.register`, `authApi.resetPassword`
- Produces: All auth flows working end-to-end

- [ ] **Step 1: Write failing RegisterPage test**

Create `src/pages/auth/RegisterPage.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { RegisterPage } from './RegisterPage'

function renderRegister() {
  return render(
    <MemoryRouter initialEntries={['/register']}>
      <Routes>
        <Route path="/register" element={<RegisterPage />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('RegisterPage', () => {
  it('renders email field and submit button', () => {
    renderRegister()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument()
  })

  it('shows confirmation message after submitting email', async () => {
    renderRegister()
    await userEvent.type(screen.getByLabelText(/email/i), 'new@example.com')
    await userEvent.click(screen.getByRole('button', { name: /send/i }))
    await waitFor(() => {
      expect(screen.getByText(/check your email/i)).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 2: Write `src/pages/auth/RegisterPage.tsx`**

```tsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { authApi } from '../../api/auth'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { ErrorBanner } from '../../components/ui/ErrorBanner'
import { Card } from '../../components/ui/Card'

export function RegisterPage() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await authApi.sendConfirmationLink(email, 'Registration')
      setSent(true)
    } catch {
      setError(t('common.error'))
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen bg-surface-0 flex items-center justify-center px-4">
        <Card className="w-full max-w-sm p-6 text-center flex flex-col gap-4">
          <h1 className="font-serif text-2xl text-gold">Sadhana Pro</h1>
          <p className="text-text-primary">{t('auth.checkEmail')}</p>
          <Link to="/login" className="text-teal hover:underline text-sm">{t('auth.signIn')}</Link>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-0 flex items-center justify-center px-4">
      <Card className="w-full max-w-sm p-6 flex flex-col gap-5">
        <h1 className="font-serif text-2xl text-gold text-center">Sadhana Pro</h1>
        <h2 className="font-semibold text-text-primary text-center text-lg">{t('auth.register')}</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label={t('auth.email')}
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          <ErrorBanner message={error} />
          <Button variant="primary" type="submit" loading={loading} className="w-full">
            {t('auth.sendLink')}
          </Button>
        </form>
        <p className="text-center text-sm text-text-secondary">
          {t('auth.hasAccount')}{' '}
          <Link to="/login" className="text-teal hover:underline">{t('auth.signIn')}</Link>
        </p>
      </Card>
    </div>
  )
}
```

- [ ] **Step 3: Write `src/pages/auth/ConfirmationPage.tsx`**

This page is linked from the confirmation email: `/register/:id`. It fetches the confirmation details, then shows the name + password form to complete registration.

```tsx
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import i18n from '../../i18n'
import { authApi } from '../../api/auth'
import { useAuthStore } from '../../store/authStore'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { ErrorBanner } from '../../components/ui/ErrorBanner'
import { Card } from '../../components/ui/Card'
import { Spinner } from '../../components/ui/Spinner'

export function ConfirmationPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)

  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingDetails, setLoadingDetails] = useState(true)
  const [expired, setExpired] = useState(false)

  useEffect(() => {
    if (!id) return
    authApi.getConfirmationDetails(id)
      .then((c) => setEmail(c.email))
      .catch(() => setExpired(true))
      .finally(() => setLoadingDetails(false))
  }, [id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirmPassword) { setError(t('auth.passwordMismatch')); return }
    setError(null)
    setLoading(true)
    try {
      const lang = (i18n.resolvedLanguage || 'en').slice(0, 2)
      const user = await authApi.register(id!, email, password, name, lang)
      setAuth(user)
      navigate('/', { replace: true })
    } catch {
      setError(t('common.error'))
    } finally {
      setLoading(false)
    }
  }

  if (loadingDetails) return <Spinner />
  if (expired) {
    return (
      <div className="min-h-screen bg-surface-0 flex items-center justify-center px-4">
        <Card className="w-full max-w-sm p-6 text-center">
          <p className="text-danger">{t('auth.confirmationExpired')}</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-0 flex items-center justify-center px-4">
      <Card className="w-full max-w-sm p-6 flex flex-col gap-5">
        <h1 className="font-serif text-2xl text-gold text-center">Sadhana Pro</h1>
        <h2 className="font-semibold text-text-primary text-center text-lg">{t('auth.register')}</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input label={t('auth.email')} name="email" type="email" value={email} onChange={() => {}} />
          <Input label={t('auth.name')} name="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          <Input label={t('auth.password')} name="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          <Input label={t('auth.confirmPassword')} name="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" />
          <ErrorBanner message={error} />
          <Button variant="primary" type="submit" loading={loading} className="w-full">{t('auth.register')}</Button>
        </form>
      </Card>
    </div>
  )
}
```

- [ ] **Step 4: Write `src/pages/auth/PwdResetRequestPage.tsx`**

```tsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { authApi } from '../../api/auth'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { ErrorBanner } from '../../components/ui/ErrorBanner'
import { Card } from '../../components/ui/Card'

export function PwdResetRequestPage() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await authApi.sendConfirmationLink(email, 'PasswordReset')
      setSent(true)
    } catch {
      setError(t('common.error'))
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen bg-surface-0 flex items-center justify-center px-4">
        <Card className="w-full max-w-sm p-6 text-center flex flex-col gap-4">
          <h1 className="font-serif text-2xl text-gold">Sadhana Pro</h1>
          <p className="text-text-primary">{t('auth.resetSent')}</p>
          <Link to="/login" className="text-teal hover:underline text-sm">{t('auth.signIn')}</Link>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-0 flex items-center justify-center px-4">
      <Card className="w-full max-w-sm p-6 flex flex-col gap-5">
        <h1 className="font-serif text-2xl text-gold text-center">Sadhana Pro</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input label={t('auth.email')} name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          <ErrorBanner message={error} />
          <Button variant="primary" type="submit" loading={loading} className="w-full">{t('auth.sendLink')}</Button>
        </form>
        <Link to="/login" className="text-center text-sm text-teal hover:underline">{t('auth.signIn')}</Link>
      </Card>
    </div>
  )
}
```

- [ ] **Step 5: Write `src/pages/auth/PwdResetPage.tsx`**

```tsx
import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { authApi } from '../../api/auth'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { ErrorBanner } from '../../components/ui/ErrorBanner'
import { Card } from '../../components/ui/Card'

export function PwdResetPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirmPassword) { setError(t('auth.passwordMismatch')); return }
    setError(null)
    setLoading(true)
    try {
      await authApi.resetPassword(id!, password)
      navigate('/login', { replace: true })
    } catch {
      setError(t('common.error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-0 flex items-center justify-center px-4">
      <Card className="w-full max-w-sm p-6 flex flex-col gap-5">
        <h1 className="font-serif text-2xl text-gold text-center">Sadhana Pro</h1>
        <h2 className="font-semibold text-text-primary text-center text-lg">{t('auth.setPassword')}</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input label={t('auth.newPassword')} name="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          <Input label={t('auth.confirmPassword')} name="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" />
          <ErrorBanner message={error} />
          <Button variant="primary" type="submit" loading={loading} className="w-full">{t('auth.setPassword')}</Button>
        </form>
      </Card>
    </div>
  )
}
```

- [ ] **Step 6: Run all tests**

```bash
npm run test
```
Expected: all tests pass (prior tests + 2 new RegisterPage tests).

- [ ] **Step 7: Full build check**

```bash
npm run build
```
Expected: build succeeds, zero TypeScript errors.

- [ ] **Step 8: Manual smoke test**

```bash
npm run dev
```
Verify in browser:
- `/login` — dark card, email + password fields, Sign In button (gold)
- `/register` — email field, Send Link button
- Navigating to `/` without token → redirects to `/login`
- After mock login (if pointing at real backend) → BottomNav appears with 4 tabs

- [ ] **Step 9: Commit**

```bash
git add app-react/src/pages/auth/
git commit -m "feat(app-react): implement all auth screens — Register, Confirmation, Password Reset"
```

---

## Phase 1 Complete

At this point the app has:
- Working authentication (login, register, password reset)
- Dark navy/gold design system
- TopBar + BottomNav shell with 4 tabs
- Protected routing
- i18n in EN/RU/UK
- Test suite covering auth store, API client, UI primitives, and auth pages

**Next:** `docs/superpowers/plans/2026-07-17-phase2-home-screen.md` — daily practice logging screen.
