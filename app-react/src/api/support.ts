import { apiClient } from './client'

export const supportApi = {
  async sendMessage(data: { name: string; email: string; message: string }): Promise<void> {
    await apiClient.post('/support-form', data)
  },
}
