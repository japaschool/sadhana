import { describe, it, expect, vi, afterEach } from 'vitest'
import { chartsApi } from './charts'
import { apiClient } from './client'

describe('chartsApi', () => {
  afterEach(() => vi.restoreAllMocks())

  it('asks for panels reports on both lists', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { reports: [] } })
    await chartsApi.getReports()
    await chartsApi.getSharedReports('u1')
    expect(get).toHaveBeenNthCalledWith(1, '/reports', { params: { panels: 4, months: true } })
    expect(get).toHaveBeenNthCalledWith(2, '/share/u1/reports', { params: { panels: true, months: true } })
  })
})
