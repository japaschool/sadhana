import { useQuery } from '@tanstack/react-query'
import { apiClient } from './client'

export interface ShareLink {
  id: string
  name: string
  start_date: string | null
  last_opened_at: string | null
  report_ids: string[]
}
export interface ShareableReport {
  id: string
  name: string
  kind: 'Graph' | 'Grid' | 'Panels'
  practices: string[]
}
export interface ShareLinksData {
  links: ShareLink[]
  reports: ShareableReport[]
  legacy_enabled: boolean
}
export interface ShareLinkForm {
  name: string
  start_date: string | null
  report_ids: string[]
}

export const shareLinksApi = {
  async list(): Promise<ShareLinksData> {
    const res = await apiClient.get<ShareLinksData>('/share-links')
    return res.data
  },
  async create(form: ShareLinkForm): Promise<string> {
    const res = await apiClient.post<{ id: string }>('/share-links', form)
    return res.data.id
  },
  async update(id: string, form: ShareLinkForm): Promise<void> {
    await apiClient.put(`/share-link/${id}`, form)
  },
  async remove(id: string): Promise<void> {
    await apiClient.delete(`/share-link/${id}`)
  },
  async setLegacy(enabled: boolean): Promise<void> {
    await apiClient.put('/share-links/legacy', { enabled })
  },
}

export const SHARE_LINKS_KEY = ['share-links'] as const

export function useShareLinks(): { data: ShareLinksData | undefined; isLoading: boolean } {
  const q = useQuery({ queryKey: SHARE_LINKS_KEY, queryFn: shareLinksApi.list })
  return { data: q.data, isLoading: q.isLoading }
}

export const shareLinkUrl = (id: string) => `${window.location.origin}/shared/${id}`
