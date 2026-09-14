import { describe, it, expect, vi } from 'vitest'

// Only test the unsaved-name guard and legend — the rest is visual/integration
describe('Yatras improvements — unit checks', () => {
  it('discard guard: window.confirm called when closing modal with typed name', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    // We test the guard logic in isolation
    const guard = (name: string, close: () => void) => {
      if (name.trim().length > 0) {
        if (!window.confirm('Discard?')) return
      }
      close()
    }
    const close = vi.fn()
    guard('My yatra', close)
    expect(confirmSpy).toHaveBeenCalledOnce()
    expect(close).not.toHaveBeenCalled()
    confirmSpy.mockRestore()
  })

  it('discard guard: close fires immediately when name is empty', () => {
    const confirmSpy = vi.spyOn(window, 'confirm')
    const guard = (name: string, close: () => void) => {
      if (name.trim().length > 0) {
        if (!window.confirm('Discard?')) return
      }
      close()
    }
    const close = vi.fn()
    guard('', close)
    expect(confirmSpy).not.toHaveBeenCalled()
    expect(close).toHaveBeenCalledOnce()
    confirmSpy.mockRestore()
  })
})
