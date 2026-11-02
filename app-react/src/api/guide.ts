import { apiClient } from './client'

export type GuideStart = 'signup' | 'add_practice'
export type GuideOutcome = 'finished' | 'left'
export interface GuideRunUpdate { last_step?: string; outcome?: GuideOutcome; has_reader?: boolean }

export const guideApi = {
  async start(started_from: GuideStart): Promise<string> {
    const res = await apiClient.post<{ id: string }>('/user/guide-runs', { started_from })
    return res.data.id
  },
  async update(id: string, body: GuideRunUpdate): Promise<void> {
    await apiClient.put(`/user/guide-run/${id}`, body)
  },
}
