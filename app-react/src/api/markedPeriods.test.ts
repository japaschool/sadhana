import { describe, it, expect, vi, afterEach } from 'vitest'
import { markedPeriodsApi } from './markedPeriods'
import { apiClient } from './client'

const form = { name: 'Illness', start_date: '2026-10-01', end_date: null, exclude_from_usual: true }

describe('markedPeriodsApi', () => {
  afterEach(() => vi.restoreAllMocks())

  it('list reads the periods', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { periods: [{ id: 'a', ...form }] } })
    await expect(markedPeriodsApi.list()).resolves.toEqual([{ id: 'a', ...form }])
    expect(get).toHaveBeenCalledWith('/marked-periods')
  })

  it('create posts the form and returns the id', async () => {
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: { id: 'new' } })
    await expect(markedPeriodsApi.create(form)).resolves.toBe('new')
    expect(post).toHaveBeenCalledWith('/marked-periods', form)
  })

  it('update puts the form', async () => {
    const put = vi.spyOn(apiClient, 'put').mockResolvedValue({ data: null })
    await markedPeriodsApi.update('a', form)
    expect(put).toHaveBeenCalledWith('/marked-period/a', form)
  })

  it('remove deletes the period', async () => {
    const del = vi.spyOn(apiClient, 'delete').mockResolvedValue({ data: null })
    await markedPeriodsApi.remove('a')
    expect(del).toHaveBeenCalledWith('/marked-period/a')
  })
})
