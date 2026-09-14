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
