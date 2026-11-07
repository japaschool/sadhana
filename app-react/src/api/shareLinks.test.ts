import { describe, it, expect, vi, afterEach } from 'vitest'
import { shareLinksApi } from './shareLinks'
import { chartsApi } from './charts'
import { apiClient } from './client'

const form = { name: 'Mentor', start_date: '2026-10-01', report_ids: ['r1'] }

describe('shareLinksApi', () => {
  afterEach(() => vi.restoreAllMocks())

  it('list reads share links', async () => {
    const data = { links: [], reports: [], legacy_enabled: false }
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({ data })
    await expect(shareLinksApi.list()).resolves.toEqual(data)
    expect(get).toHaveBeenCalledWith('/share-links')
  })

  it('create posts the form and returns the id', async () => {
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: { id: 'new' } })
    await expect(shareLinksApi.create(form)).resolves.toBe('new')
    expect(post).toHaveBeenCalledWith('/share-links', form)
  })

  it('update, remove and setLegacy hit their routes', async () => {
    const put = vi.spyOn(apiClient, 'put').mockResolvedValue({ data: null })
    const del = vi.spyOn(apiClient, 'delete').mockResolvedValue({ data: null })
    await shareLinksApi.update('a', form)
    await shareLinksApi.remove('a')
    await shareLinksApi.setLegacy(true)
    expect(put).toHaveBeenCalledWith('/share-link/a', form)
    expect(del).toHaveBeenCalledWith('/share-link/a')
    expect(put).toHaveBeenCalledWith('/share-links/legacy', { enabled: true })
  })
})

describe('chartsApi.getSharedUser', () => {
  afterEach(() => vi.restoreAllMocks())

  it('defaults kind to legacy when an old server omits it', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { user: { id: 'u', email: '', token: '', name: 'A' } } })
    await expect(chartsApi.getSharedUser('u')).resolves.toEqual({ id: 'u', name: 'A', kind: 'legacy', start_date: null })
  })

  it('passes kind and start_date through', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { user: { id: 'u', name: 'A' }, kind: 'link', start_date: '2026-10-01' } })
    await expect(chartsApi.getSharedUser('u')).resolves.toEqual({ id: 'u', name: 'A', kind: 'link', start_date: '2026-10-01' })
  })
})
