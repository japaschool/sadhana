import { fireEvent, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setViewportWidth } from '../../../../test/viewport'
import { useToastStore } from '../../../../hooks/useToast'
import { mockAdmin, renderAdmin } from './adminTestUtils'

vi.mock('../../../../api/yatras', async (importOriginal) => {
  const { yatrasApi } = await importOriginal<typeof import('../../../../api/yatras')>()
  return { yatrasApi: Object.fromEntries(Object.keys(yatrasApi).map((k) => [k, vi.fn()])) }
})
import { yatrasApi } from '../../../../api/yatras'
const api = vi.mocked(yatrasApi)

describe('InviteMobile', () => {
  beforeEach(() => { vi.clearAllMocks(); setViewportWidth(390); useToastStore.setState({ toasts: [] }); mockAdmin(api) })
  afterEach(() => { delete (navigator as { share?: unknown }).share })

  it('shows the join link and copies it', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    renderAdmin('/yatra/y1/admin/invite')
    expect(await screen.findByText(`${window.location.host}/yatra/y1/join`)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Share link' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }))
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/yatra/y1/join`)
    expect(await screen.findByText('Link copied')).toBeInTheDocument()
  })

  it('shares through the phone when it can', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'share', { value: share, configurable: true })
    renderAdmin('/yatra/y1/admin/invite')
    fireEvent.click(await screen.findByRole('button', { name: 'Share link' }))
    expect(share).toHaveBeenCalledWith({ title: "Balarama's League", url: `${window.location.origin}/yatra/y1/join` })
  })
})

describe('DangerZoneMobile', () => {
  beforeEach(() => { vi.clearAllMocks(); setViewportWidth(390); useToastStore.setState({ toasts: [] }); mockAdmin(api) })

  it('deletes only after the exact name is typed', async () => {
    renderAdmin('/yatra/y1/admin/danger')
    fireEvent.click(await screen.findByRole('button', { name: 'Delete yatra…' }))
    const sheet = screen.getByRole('dialog', { name: "Delete Balarama's League?" })
    expect(within(sheet).getByText('This deletes the yatra for all 3 members and can\'t be undone.')).toBeInTheDocument()
    const forever = within(sheet).getByRole('button', { name: 'Delete forever' })
    expect(forever).toBeDisabled()
    const input = within(sheet).getByLabelText('Type the yatra name to confirm')
    fireEvent.change(input, { target: { value: "Balarama's Lea" } })
    expect(forever).toBeDisabled()
    fireEvent.change(input, { target: { value: "Balarama's League" } })
    expect(forever).toBeEnabled()
    fireEvent.click(forever)
    expect(await screen.findByText('Yatras page')).toBeInTheDocument()
    expect(api.deleteYatra).toHaveBeenCalledWith('y1')
  })
})
