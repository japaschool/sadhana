import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from './client'
import { yatrasApi } from './yatras'

describe('yatrasApi', () => {
  afterEach(() => vi.restoreAllMocks())

  it("toggles a member's admin role on the server's is_admin route", async () => {
    const put = vi.spyOn(apiClient, 'put').mockResolvedValue({ data: null } as never)
    await yatrasApi.toggleAdmin('y1', 'u2')
    expect(put).toHaveBeenCalledWith('/yatra/y1/users/u2/is_admin')
  })
})
