import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

export const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  token: 'mock-token',
  name: 'Test User',
}

export const server = setupServer(
  http.post('/api/users/login', () =>
    HttpResponse.json({ user: mockUser })
  ),
  http.get('/api/user', () =>
    HttpResponse.json({ user: mockUser })
  ),
  http.post('/api/users', () =>
    HttpResponse.json({ user: mockUser })
  ),
  http.post('/api/users/confirmation', () =>
    HttpResponse.json({})
  ),
  http.get('/api/users/confirmation/:id', () =>
    HttpResponse.json({
      confirmation: {
        id: 'conf-1',
        email: 'test@example.com',
        expires_at: new Date(Date.now() + 86400000).toISOString(),
      },
    })
  ),
  http.put('/api/password-reset', () =>
    HttpResponse.json({})
  ),
)
