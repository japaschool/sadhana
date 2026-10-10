import { apiClient } from './client'
import type { UserInfo, Confirmation } from '../types/api'

export const authApi = {
  async login(email: string, password: string): Promise<UserInfo> {
    const res = await apiClient.post<{ user: UserInfo }>('/users/login', {
      user: { email, password },
    })
    return res.data.user
  },

  async register(
    confirmationId: string,
    email: string,
    password: string,
    name: string,
    lang: string,
  ): Promise<UserInfo> {
    const res = await apiClient.post<{ user: UserInfo }>('/users', {
      user: { confirmation_id: confirmationId, email, password, name, lang },
    })
    return res.data.user
  },

  async getUser(): Promise<UserInfo> {
    const res = await apiClient.get<{ user: UserInfo }>('/user')
    return res.data.user
  },

  async sendConfirmationLink(
    email: string,
    confirmationType: 'Registration' | 'PasswordReset',
  ): Promise<void> {
    await apiClient.post('/users/confirmation', {
      data: {
        email,
        confirmation_type: confirmationType,
        server_address: window.location.origin,
      },
    })
  },

  async getConfirmationDetails(id: string): Promise<Confirmation> {
    const res = await apiClient.get<{ confirmation: Confirmation }>(
      `/users/confirmation/${id}`,
    )
    return res.data.confirmation
  },

  async resetPassword(confirmationId: string, password: string): Promise<void> {
    await apiClient.put('/password-reset', {
      data: { confirmation_id: confirmationId, password },
    })
  },

  async updateUser(name: string): Promise<void> {
    await apiClient.put('/user', { user: { name } })
  },

  async updatePassword(currentPassword: string, newPassword: string): Promise<void> {
    await apiClient.put('/user/password', {
      current_password: currentPassword,
      new_password: newPassword,
    })
  },

  /** lang picks the default practices of a new account. */
  async googleSignin(accessToken: string, lang: string): Promise<UserInfo> {
    const res = await apiClient.post<{ user: UserInfo }>('/oauth/google', {
      access_token: accessToken,
      lang,
    })
    return res.data.user
  },
}
