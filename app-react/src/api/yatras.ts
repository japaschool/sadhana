import { apiClient } from './client'
import type { Yatra, PracticeDataType, YatraDataResponse, YatraUserPracticeItem, YatraPractice, YatraUser, YatraStatisticsConfig } from '../types/api'

export const yatrasApi = {
  async getYatras(): Promise<Yatra[]> {
    const res = await apiClient.get<{ yatras: Yatra[] }>('/yatras')
    return res.data.yatras
  },
  async getYatra(id: string): Promise<Yatra> {
    const res = await apiClient.get<{ yatra: Yatra }>(`/yatra/${id}`)
    return res.data.yatra
  },
  async joinYatra(id: string): Promise<void> {
    await apiClient.put(`/yatra/${id}/join`)
  },
  async leaveYatra(id: string): Promise<void> {
    await apiClient.put(`/yatra/${id}/leave`)
  },
  async isAdmin(id: string): Promise<boolean> {
    const res = await apiClient.get<{ is_admin: boolean }>(`/yatra/${id}/is_admin`)
    return res.data.is_admin
  },
  async getYatraUsers(id: string): Promise<YatraUser[]> {
    const res = await apiClient.get<{ users: YatraUser[] }>(`/yatra/${id}/users`)
    return res.data.users
  },
  async getYatraPractices(id: string): Promise<YatraPractice[]> {
    const res = await apiClient.get<{ practices: YatraPractice[] }>(`/yatra/${id}/practices`)
    return res.data.practices
  },
  async removeMember(yatraId: string, userId: string): Promise<void> {
    await apiClient.delete(`/yatra/${yatraId}/users/${userId}`)
  },
  async getYatraUserPractices(id: string): Promise<YatraUserPracticeItem[]> {
    const res = await apiClient.get<{ practices: YatraUserPracticeItem[] }>(`/yatra/${id}/user-practices`)
    return res.data.practices
  },
  async updateYatraUserPractices(id: string, practices: YatraUserPracticeItem[]): Promise<void> {
    await apiClient.put(`/yatra/${id}/user-practices`, { practices })
  },
  async updateYatra(id: string, updates: { name: string; show_stability_metrics: boolean; statistics?: YatraStatisticsConfig | null }): Promise<void> {
    await apiClient.put(`/yatra/${id}`, { yatra: { id, ...updates } })
  },
  async deleteYatra(id: string): Promise<void> {
    await apiClient.delete(`/yatra/${id}`)
  },
  async toggleAdmin(yatraId: string, userId: string): Promise<void> {
    await apiClient.put(`/yatra/${yatraId}/users/${userId}/is_admin`)
  },
  async reorderPractices(yatraId: string, practiceIds: string[]): Promise<void> {
    await apiClient.put(`/yatra/${yatraId}/practices/reorder`, { practices: practiceIds })
  },
  async createYatraPractice(yatraId: string, data: { practice: string; data_type: PracticeDataType }): Promise<void> {
    await apiClient.post(`/yatra/${yatraId}/practices`, {
      practice: { yatra_id: yatraId, practice: data.practice, data_type: data.data_type },
    })
  },
  async getYatraPractice(yatraId: string, practiceId: string): Promise<YatraPractice> {
    const res = await apiClient.get<{ practice: YatraPractice }>(`/yatra/${yatraId}/practice/${practiceId}`)
    return res.data.practice
  },
  async updateYatraPractice(yatraId: string, practice: YatraPractice): Promise<void> {
    await apiClient.put(`/yatra/${yatraId}/practice/${practice.id}`, { practice })
  },
  async deleteYatraPractice(yatraId: string, practiceId: string): Promise<void> {
    await apiClient.delete(`/yatra/${yatraId}/practice/${practiceId}`)
  },
  async getYatraData(id: string, date: string): Promise<YatraDataResponse> {
    const res = await apiClient.get<YatraDataResponse>(`/yatra/${id}/data`, {
      params: { cob_date: date },
    })
    return res.data
  },
  async createYatra(name: string): Promise<Yatra> {
    const res = await apiClient.post<{ yatra: Yatra }>('/yatras', { name })
    return res.data.yatra
  },
}
