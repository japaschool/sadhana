import { apiClient } from './client'
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
    await apiClient.put('/user/practices/reorder', { ids })
  },
  async getDiaryEntries(date: string): Promise<DiaryEntry[]> {
    const res = await apiClient.get<{ diary_day: DiaryEntry[] }>(`/diary/${date}`)
    return res.data.diary_day
  },
  async saveDiaryEntry(date: string, practice: string, value: PracticeValue): Promise<void> {
    await apiClient.put(`/diary/${date}/entry`, { entry: { practice, value } })
  },
  async getIncompleteDays(from: string, to: string): Promise<string[]> {
    const res = await apiClient.get<{ days: string[] }>('/diary/incomplete-days', {
      params: { from, to },
    })
    return res.data.days
  },
}
