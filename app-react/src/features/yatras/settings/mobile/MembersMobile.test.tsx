import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setViewportWidth } from '../../../../test/viewport'
import { useToastStore } from '../../../../hooks/useToast'
import { mockAdmin, renderAdmin } from './adminTestUtils'

vi.mock('../../../../api/yatras', async (importOriginal) => {
  const { yatrasApi } = await importOriginal<typeof import('../../../../api/yatras')>()
  return { yatrasApi: Object.fromEntries(Object.keys(yatrasApi).map((k) => [k, vi.fn()])) }
})
import { yatrasApi } from '../../../../api/yatras'
const api = vi.mocked(yatrasApi)

describe('MembersMobile', () => {
  beforeEach(() => { vi.clearAllMocks(); setViewportWidth(390); useToastStore.setState({ toasts: [] }) })

  it('lists members with You and Admin badges', async () => {
    mockAdmin(api)
    renderAdmin('/yatra/y1/admin/members')
    expect(await screen.findByText('3 members · 2 admins. A yatra always keeps at least one admin.')).toBeInTheDocument()
    const me = screen.getByRole('button', { name: /Alex das/ })
    expect(within(me).getByText('You')).toBeInTheDocument()
    expect(within(me).getByText('Admin')).toBeInTheDocument()
    expect(within(screen.getByRole('button', { name: /Madhava das/ })).queryByText('Admin')).toBeNull()
  })

  it('makes a member admin, with Undo', async () => {
    mockAdmin(api)
    renderAdmin('/yatra/y1/admin/members')
    fireEvent.click(await screen.findByRole('button', { name: /Madhava das/ }))
    const sheet = screen.getByRole('dialog', { name: 'Madhava das' })
    fireEvent.click(within(sheet).getByRole('switch', { name: 'Admin' }))
    await waitFor(() => expect(within(sheet).getByRole('switch', { name: 'Admin' })).toHaveAttribute('aria-checked', 'true'))
    await waitFor(() => expect(api.toggleAdmin).toHaveBeenCalledWith('y1', 'u3'))
    expect(await screen.findByRole('button', { name: 'Undo' })).toBeInTheDocument()
  })

  it('removes a member after asking', async () => {
    mockAdmin(api)
    renderAdmin('/yatra/y1/admin/members')
    fireEvent.click(await screen.findByRole('button', { name: /Madhava das/ }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Remove from yatra' }))
    const confirm = screen.getByRole('dialog', { name: 'Remove Madhava das?' })
    fireEvent.click(within(confirm).getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(api.removeMember).toHaveBeenCalledWith('y1', 'u3'))
  })

  it("the only admin can't drop the role or remove themselves", async () => {
    mockAdmin(api, { users: [{ user_id: 'u1', user_name: 'Alex das', is_admin: true }, { user_id: 'u3', user_name: 'Madhava das', is_admin: false }] })
    renderAdmin('/yatra/y1/admin/members')
    fireEvent.click(await screen.findByRole('button', { name: /Alex das/ }))
    const sheet = screen.getByRole('dialog', { name: 'Alex das' })
    expect(within(sheet).getByRole('switch', { name: 'Admin' })).toBeDisabled()
    expect(within(sheet).getByText('The only admin. Make someone else admin first.')).toBeInTheDocument()
    expect(within(sheet).queryByRole('button', { name: 'Remove from yatra' })).toBeNull()
  })
})
