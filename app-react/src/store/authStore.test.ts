import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act } from '@testing-library/react'
import { readToken, useAuthStore } from './authStore'

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
    expect(localStorage.getItem('yew.token')).toBe('"tok"')
    expect(useAuthStore.getState().token).toBe('tok')
    expect(useAuthStore.getState().user?.name).toBe('Alice')
  })

  it('reads the Rust UI token (JSON-quoted) and a raw one', () => {
    localStorage.setItem('yew.token', '"eyJ.a.b"')
    expect(readToken()).toBe('eyJ.a.b')
    localStorage.setItem('yew.token', 'eyJ.a.b')
    expect(readToken()).toBe('eyJ.a.b')
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

  it('setAuth saves the user and logout removes it', () => {
    act(() => useAuthStore.getState().setAuth({ id: '1', email: 'a@b.com', token: 'tok', name: 'Alice' }))
    expect(JSON.parse(localStorage.getItem('sadhana.user')!).name).toBe('Alice')
    act(() => useAuthStore.getState().logout())
    expect(localStorage.getItem('sadhana.user')).toBeNull()
  })

  it('starts with the saved user when a token is present, and ignores it without one', async () => {
    localStorage.setItem('yew.token', '"tok"')
    localStorage.setItem('sadhana.user', JSON.stringify({ id: '1', email: 'a@b.com', token: 'tok', name: 'Alice' }))
    vi.resetModules()
    expect((await import('./authStore')).useAuthStore.getState().user?.name).toBe('Alice')
    localStorage.removeItem('yew.token')
    vi.resetModules()
    expect((await import('./authStore')).useAuthStore.getState().user).toBeNull()
  })

  it('survives a corrupt saved user', async () => {
    localStorage.setItem('yew.token', '"tok"')
    localStorage.setItem('sadhana.user', '{oops')
    vi.resetModules()
    expect((await import('./authStore')).useAuthStore.getState().user).toBeNull()
  })

  it('ignores a saved user that belongs to another token', async () => {
    localStorage.setItem('yew.token', '"tok2"')
    localStorage.setItem('sadhana.user', JSON.stringify({ id: '1', email: 'a@b.com', token: 'tok', name: 'Alice' }))
    vi.resetModules()
    expect((await import('./authStore')).useAuthStore.getState().user).toBeNull()
  })
})
