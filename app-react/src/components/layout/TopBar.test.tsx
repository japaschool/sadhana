import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { TopBar } from './TopBar'

function wrapAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <TopBar />
    </MemoryRouter>,
  )
}

describe('TopBar', () => {
  it('shows Home, the home actions, and Settings-as-text on the home route; no Yatras nav link', () => {
    wrapAt('/')
    expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Practices/ })).toBeInTheDocument()
    expect(screen.getByText('Settings')).toBeInTheDocument() // reverted to a text label
    expect(screen.queryByRole('link', { name: 'Yatras' })).not.toBeInTheDocument()
  })

  it('shows the same header actions on other routes too', () => {
    wrapAt('/charts/new')
    expect(screen.getByRole('button', { name: /Practices/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Charts/ })).toBeInTheDocument()
  })
})
