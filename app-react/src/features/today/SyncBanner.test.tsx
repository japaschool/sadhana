import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { SyncBanner } from './SyncBanner'
import { useNetStore } from '../../hooks/useNetworkStatus'

describe('SyncBanner', () => {
  beforeEach(() => useNetStore.setState({ online: true, pending: 0 }))

  it('is hidden online with nothing pending', () => {
    const { container } = render(<SyncBanner />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the plain offline text with nothing pending', () => {
    useNetStore.setState({ online: false, pending: 0 })
    render(<SyncBanner />)
    expect(screen.getByRole('status')).toHaveTextContent("You're offline — changes will sync when reconnected")
  })

  it('counts pending changes offline and while syncing', () => {
    useNetStore.setState({ online: false, pending: 2 })
    const { rerender } = render(<SyncBanner />)
    expect(screen.getByRole('status')).toHaveTextContent('Offline — 2 changes will sync')
    useNetStore.setState({ online: true, pending: 2 })
    rerender(<SyncBanner />)
    expect(screen.getByRole('status')).toHaveTextContent('Syncing 2…')
  })
})
