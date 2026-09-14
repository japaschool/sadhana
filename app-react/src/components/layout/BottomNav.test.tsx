import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { BottomNav } from './BottomNav'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <BottomNav />
    </MemoryRouter>,
  )
}

describe('BottomNav', () => {
  it('renders the four destinations with correct hrefs', () => {
    renderAt('/')
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Charts' })).toHaveAttribute('href', '/charts')
    expect(screen.getByRole('link', { name: 'Yatras' })).toHaveAttribute('href', '/yatras')
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings')
  })

  it('center button links to Edit practices off the charts route', () => {
    renderAt('/')
    expect(screen.getByRole('link', { name: 'Edit practices' })).toHaveAttribute('href', '/user/practices')
  })

  it('center becomes a logout button on the settings route', () => {
    renderAt('/settings')
    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Edit practices' })).toBeNull()
  })

  it('center becomes a create-yatra button on the yatras route', () => {
    renderAt('/yatras')
    expect(screen.getByRole('button', { name: 'Create new yatra' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Edit practices' })).toBeNull()
  })

  it('center button becomes New report on the charts route', () => {
    renderAt('/charts')
    expect(screen.getByRole('link', { name: 'New report' })).toHaveAttribute('href', '/charts/new')
    expect(screen.queryByRole('link', { name: 'Edit practices' })).toBeNull()
  })

  it('marks the active tab with aria-current', () => {
    renderAt('/charts')
    expect(screen.getByRole('link', { name: 'Charts' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current')
  })
})
