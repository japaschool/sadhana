import { apiClient } from './client'

export const supportApi = {
  /** Emailed to support from the signed-in user; the reply goes to their address. */
  async sendMessage(data: { subject: string; message: string }): Promise<void> {
    await apiClient.post('/support-form', data)
  },
}
