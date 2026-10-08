import { screen } from '@testing-library/react'
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

describe('ManageYatraMobile', () => {
  beforeEach(() => { vi.clearAllMocks(); setViewportWidth(390); useToastStore.setState({ toasts: [] }) })

  it('lists the sections with live summaries', async () => {
    mockAdmin(api)
    renderAdmin('/yatra/y1/admin/settings')
    expect(await screen.findByRole('link', { name: /General/ })).toHaveAttribute('href', '/yatra/y1/admin/general')
    expect(screen.getByRole('heading', { name: 'Manage yatra' })).toBeInTheDocument()
    expect(screen.getByText('5 · order, colours, score')).toBeInTheDocument()
    expect(screen.getByText('3 members · 2 admins')).toBeInTheDocument()
    expect(screen.getByText('2 tiles · visible to everyone')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Danger zone/ })).toHaveAttribute('href', '/yatra/y1/admin/danger')
    expect(screen.getByRole('link', { name: /Link your practices/ })).toHaveAttribute('href', '/yatra/y1/settings')
  })

  it('sends a member who opens an admin URL to the link page', async () => {
    mockAdmin(api, { admin: false })
    renderAdmin('/yatra/y1/admin/members')
    expect(await screen.findByText('Link page')).toBeInTheDocument()
  })
})
