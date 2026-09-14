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
