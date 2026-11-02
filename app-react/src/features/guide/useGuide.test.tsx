import { act, renderHook } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '../../store/authStore'
import { useGuide } from './useGuide'

vi.mock('../../api/guide', () => ({ guideApi: { start: vi.fn(), update: vi.fn() } }))
import { guideApi } from '../../api/guide'
const api = vi.mocked(guideApi)

const wrapper = ({ children }: { children: ReactNode }) => <MemoryRouter initialEntries={['/guide']}>{children}</MemoryRouter>
function setup(firstRun: boolean, carousel = true) {
  return renderHook(() => ({ guide: useGuide({ firstRun, back: '/settings', carousel }), path: useLocation().pathname }), { wrapper })
}

beforeEach(() => {
  vi.clearAllMocks()
  api.start.mockResolvedValue('run-1')
  api.update.mockResolvedValue(undefined)
  useAuthStore.setState({ newAccount: false })
})

describe('useGuide', () => {
  it('clears newAccount when the guide opens, so a later visit to /login does not reopen it', () => {
    useAuthStore.setState({ newAccount: true })
    setup(true)
    expect(useAuthStore.getState().newAccount).toBe(false)
  })

  it('keeps a choice when going back, and moves one position at a time', () => {
    const { result } = setup(true)
    act(() => result.current.guide.decide('sleep', true))
    expect(result.current.guide.pos).toBe(1)
    act(() => result.current.guide.back())
    expect(result.current.guide.pos).toBe(0)
    expect(result.current.guide.tracked).toEqual(['sleep'])
  })

  it('sets up each tracked report in order, then asks about a reader on first run only', () => {
    const first = setup(true).result
    act(() => { first.current.guide.toggle('days'); first.current.guide.toggle('sleep') })
    act(() => first.current.guide.next())
    expect(first.current.guide.step).toEqual({ at: 'setup', kind: 'sleep' })
    act(() => first.current.guide.next())
    expect(first.current.guide.step).toEqual({ at: 'setup', kind: 'days' })
    act(() => first.current.guide.next())
    expect(first.current.guide.step).toEqual({ at: 'reader' })
    act(() => first.current.guide.next())
    expect(first.current.guide.step).toEqual({ at: 'finish' })

    const later = setup(false).result
    act(() => later.current.guide.toggle('count'))
    act(() => later.current.guide.next())
    act(() => later.current.guide.next())
    expect(later.current.guide.step).toEqual({ at: 'finish' })
    act(() => later.current.guide.back())
    expect(later.current.guide.step).toEqual({ at: 'setup', kind: 'count' })
  })

  it('records where the person is, once per mount start', async () => {
    const { result } = setup(false)
    act(() => result.current.guide.toggle('time'))
    act(() => result.current.guide.next())
    await vi.waitFor(() => expect(api.update).toHaveBeenCalledWith('run-1', { last_step: 'setup_time' }))
    expect(api.update).toHaveBeenCalledWith('run-1', { last_step: 'choose' })
    expect(api.start).toHaveBeenCalledTimes(1)
    expect(api.start).toHaveBeenCalledWith('add_practice')
  })

  it('leaves at once when nothing is set up, and marks left', async () => {
    const { result } = setup(true)
    act(() => result.current.guide.leave())
    expect(result.current.guide.confirming).toBe(false)
    expect(result.current.path).toBe('/')
    await vi.waitFor(() => expect(api.update).toHaveBeenCalledWith('run-1', { outcome: 'left' }))
  })

  it('asks first once a report has been set up; keep going stays, leave leaves', () => {
    const { result } = setup(true)
    act(() => result.current.guide.toggle('sleep'))
    act(() => result.current.guide.setChoice('sleep', { bedtime: 'Bed', wake: 'Wake', nap: null, min: null, max: null }))
    act(() => result.current.guide.leave())
    expect(result.current.guide.confirming).toBe(true)
    expect(result.current.path).toBe('/guide')
    act(() => result.current.guide.keepGoing())
    expect(result.current.guide.confirming).toBe(false)
    expect(result.current.path).toBe('/guide')
    act(() => result.current.guide.leave())
    act(() => result.current.guide.confirmLeave())
    expect(result.current.path).toBe('/')
  })

  it('marks finished with whether there is a reader, and leaving afterwards only navigates', async () => {
    const { result } = setup(true)
    act(() => result.current.guide.finished(true))
    expect(result.current.path).toBe('/guide')
    act(() => result.current.guide.finish())
    expect(result.current.path).toBe('/')
    await vi.waitFor(() => expect(api.update).toHaveBeenCalledWith('run-1', { outcome: 'finished', has_reader: true }))
    expect(api.update.mock.calls.filter(([, b]) => b.outcome)).toHaveLength(1)
  })

  it('drops a report from the plan and the confirmation when it is un-chosen, and brings its values back when re-chosen', () => {
    const sleep = { bedtime: 'Bed', wake: 'Wake', nap: null, min: null, max: null }
    const { result } = setup(true)
    act(() => result.current.guide.toggle('sleep'))
    act(() => result.current.guide.setChoice('sleep', sleep))
    expect(result.current.guide.chosen.sleep).toEqual(sleep)
    act(() => result.current.guide.decide('sleep', false))
    expect(result.current.guide.chosen.sleep).toBeNull()
    act(() => result.current.guide.leave())
    expect(result.current.guide.confirming).toBe(false)
    expect(result.current.path).toBe('/')
    act(() => result.current.guide.toggle('sleep'))
    expect(result.current.guide.chosen.sleep).toEqual(sleep)
  })

  it('without the carousel, Back ignores its position', () => {
    const first = setup(true, false).result
    expect(first.current.guide.canBack).toBe(false)
    const later = setup(false, false).result
    act(() => { later.current.guide.toggle('days'); later.current.guide.setPos(3) })
    act(() => later.current.guide.next())
    act(() => later.current.guide.back())
    act(() => later.current.guide.back())
    expect(later.current.path).toBe('/settings')
  })

  it('goes on when guide_runs fails', async () => {
    api.start.mockRejectedValue(new Error('down'))
    const { result } = setup(true)
    act(() => result.current.guide.decide('sleep', true))
    expect(result.current.guide.pos).toBe(1)
    act(() => result.current.guide.leave())
    expect(result.current.path).toBe('/')
  })
})
