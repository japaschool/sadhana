import { describe, it, expect, beforeEach } from 'vitest'
import { AxiosError, CanceledError } from 'axios'
import { apiClient } from './client'
import { useNetStore } from '../hooks/useNetworkStatus'

describe('apiClient online flag', () => {
  beforeEach(() => useNetStore.setState({ online: true, pending: 0 }))

  it('is offline after a network error and online after any answer', async () => {
    await apiClient.get('/x', { adapter: async (config) => { throw new AxiosError('Network Error', 'ERR_NETWORK', config) } }).catch(() => {})
    expect(useNetStore.getState().online).toBe(false)
    await apiClient.get('/x', { adapter: async (config) => ({ data: null, status: 500, statusText: '', headers: {}, config }) }).catch(() => {})
    expect(useNetStore.getState().online).toBe(true)
  })

  it('treats a timeout as offline', async () => {
    await apiClient.get('/x', { adapter: async (config) => { throw new AxiosError('timeout', 'ECONNABORTED', config) } }).catch(() => {})
    expect(useNetStore.getState().online).toBe(false)
  })

  it('ignores a cancelled request', async () => {
    await apiClient.get('/x', { adapter: async () => { throw new CanceledError() } }).catch(() => {})
    expect(useNetStore.getState().online).toBe(true)
  })

  it('has a 10 s timeout', () => {
    expect(apiClient.defaults.timeout).toBe(10_000)
  })
})
