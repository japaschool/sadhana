import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AppShell } from './AppShell'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/charts/manage" element={<p>legacy editor</p>} />
          <Route path="/charts" element={<p>charts</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('AppShell', () => {
  // Mobile reaches /charts/manage from Insights ⋯ → Edit; with no bottom nav it needs a way back.
  it('shows a back button on /charts/manage', async () => {
    renderAt('/charts/manage')
    expect(await screen.findByText('legacy editor')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Go back' })).toBeInTheDocument()
  })

  it('keeps the plain header on top-level pages', async () => {
    renderAt('/charts')
    expect(await screen.findByText('charts')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Go back' })).toBeNull()
  })
})
