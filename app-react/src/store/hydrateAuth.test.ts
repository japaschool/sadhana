import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAuthStore } from './authStore'
import { hydrateAuth } from './hydrateAuth'

vi.mock('../api/auth', () => ({ authApi: { getUser: vi.fn() } }))
import { authApi } from '../api/auth'
const getUser = vi.mocked(authApi.getUser)

const alice = { id: '1', email: 'a@b.com', token: 'tok', name: 'Alice' }

describe('hydrateAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    useAuthStore.setState({ user: alice, token: 'tok', isLoading: true })
  })

  it('stops loading at once with a saved user, before /api/user answers', async () => {
    getUser.mockReturnValue(new Promise(() => {}))
    void hydrateAuth()
    expect(useAuthStore.getState().isLoading).toBe(false)
  })

  it('keeps the saved user when offline', async () => {
    getUser.mockRejectedValue(new Error('Network Error'))
    await hydrateAuth()
    expect(useAuthStore.getState().user).toEqual(alice)
  })

  it('refreshes the user when online', async () => {
    getUser.mockResolvedValue({ ...alice, name: 'Alicia' })
    await hydrateAuth()
    expect(useAuthStore.getState().user?.name).toBe('Alicia')
  })

  it('does not sign back in if the user logged out meanwhile', async () => {
    let answer!: (u: typeof alice) => void
    getUser.mockReturnValue(new Promise((r) => { answer = r }))
    const done = hydrateAuth()
    useAuthStore.getState().logout()
    answer(alice)
    await done
    expect(useAuthStore.getState().token).toBeNull()
  })
})
