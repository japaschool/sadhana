import { apiClient, authHeaders, handleUnauthorized } from './client'
import type { UserPractice, DiaryEntry, PracticeDataType, PracticeValue } from '../types/api'

export const practicesApi = {
  async getUserPractices(): Promise<UserPractice[]> {
    const res = await apiClient.get<{ user_practices: UserPractice[] }>('/user/practices')
    return res.data.user_practices
  },
  async createUserPractice(data: { practice: string; data_type: PracticeDataType; is_required?: boolean; dropdown_variants?: string }): Promise<void> {
    await apiClient.post('/user/practices', {
      user_practice: { ...data, is_active: true },
    })
  },
  async updateUserPractice(id: string, data: { practice?: string; data_type?: PracticeDataType; is_active?: boolean; is_required?: boolean; dropdown_variants?: string }): Promise<void> {
    await apiClient.put(`/user/practice/${id}`, {
      user_practice: { id, ...data },
    })
  },
  async deleteUserPractice(id: string): Promise<void> {
    await apiClient.delete(`/user/practice/${id}`)
  },
  async reorderUserPractices(ids: string[]): Promise<void> {
    await apiClient.put('/user/practices/reorder', { practices: ids })
  },
  async getDiaryEntries(date: string): Promise<DiaryEntry[]> {
    const res = await apiClient.get<{ diary_day: DiaryEntry[] }>(`/diary/${date}`)
    return res.data.diary_day
  },
  async saveDiaryEntry(date: string, practice: string, value: PracticeValue | null): Promise<void> {
    // With a worker in control it writes the value to its outbox before trying the network, and answers 202
    // (X-Queued) when it couldn't send it, so keepalive adds nothing. Without one: a home-screen app on iOS that
    // is swiped away is killed before an XHR completes, but a keepalive fetch is still delivered.
    const res = await fetch(`${apiClient.defaults.baseURL}/diary/${date}/entry`, {
      method: 'PUT',
      keepalive: !navigator.serviceWorker?.controller,
      signal: AbortSignal.timeout(15_000),
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ entry: { practice, value } }),
    })
    if (res.status === 401) handleUnauthorized()
    if (!res.ok) throw new Error(`Saving ${practice} failed: ${res.status}`)
  },
  /** Upserts the given practices' values for one day (null clears); others are left alone. */
  async saveDiaryDay(date: string, entries: { practice: string; value: PracticeValue | null }[]): Promise<void> {
    await apiClient.put(`/diary/${date}`, { diary_day: entries })
  },
  async getIncompleteDays(from: string, to: string): Promise<string[]> {
    const res = await apiClient.get<{ days: string[] }>('/diary/incomplete-days', {
      params: { from, to },
    })
    return res.data.days
  },
}
