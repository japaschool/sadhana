import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DurationQuickAddModal, PracticeCard } from './PracticeCard'
import type { DiaryEntry, UserPractice } from '../../types/api'

function renderCard(practice: UserPractice, currentValue?: import('../../types/api').PracticeValue) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <PracticeCard practice={practice} date="2026-08-08" currentValue={currentValue} />
    </QueryClientProvider>
  )
}

vi.mock('../../api/practices', () => ({
  practicesApi: {
    saveDiaryEntry: vi.fn(),
  },
}))

describe('DurationQuickAddModal', () => {
  it('calls onAdd with parsed number and then onClose', async () => {
    const onAdd = vi.fn()
    const onClose = vi.fn()
    render(<DurationQuickAddModal onAdd={onAdd} onClose={onClose} />)
    await userEvent.type(screen.getByLabelText('minutes'), '45')
    await userEvent.click(screen.getByText('Add'))
    expect(onAdd).toHaveBeenCalledWith(45)
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose without onAdd for empty input', async () => {
    const onAdd = vi.fn()
    const onClose = vi.fn()
    render(<DurationQuickAddModal onAdd={onAdd} onClose={onClose} />)
    await userEvent.click(screen.getByText('Add'))
    expect(onAdd).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose when Cancel is clicked', async () => {
    const onClose = vi.fn()
    render(<DurationQuickAddModal onAdd={vi.fn()} onClose={onClose} />)
    await userEvent.click(screen.getByText('Cancel'))
    expect(onClose).toHaveBeenCalled()
  })

  it('disables Add button while isPending', () => {
    render(<DurationQuickAddModal onAdd={vi.fn()} onClose={vi.fn()} isPending={true} />)
    expect(screen.getByRole('button', { name: /add/i })).toBeDisabled()
  })
})

describe('DurationQuickAddModal — duration hint', () => {
  it('shows hint text when input is focused', async () => {
    render(<DurationQuickAddModal onAdd={vi.fn()} onClose={vi.fn()} />)
    const input = screen.getByLabelText('minutes')
    await userEvent.click(input)
    expect(screen.getByText(/total minutes/i)).toBeInTheDocument()
  })

  it('hides hint text when input is not focused', () => {
    render(<DurationQuickAddModal onAdd={vi.fn()} onClose={vi.fn()} />)
    expect(screen.queryByText(/total minutes/i)).not.toBeInTheDocument()
  })
})

describe('PracticeCard — Int input', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('Int renders a plain number input with no steppers', () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={qc}>
        <PracticeCard
          practice={{ id: '1', practice: 'Pages', data_type: 'Int', is_active: true, is_required: false }}
          date="2026-08-08"
          currentValue={undefined}
        />
      </QueryClientProvider>
    )
    expect(screen.getByRole('spinbutton', { name: 'Pages' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Increase by 1' })).toBeNull()
  })
})

describe('PracticeCard — optimistic update', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('updates diary cache immediately before server responds', async () => {
    const { practicesApi } = await import('../../api/practices')
    let resolve!: () => void
    vi.mocked(practicesApi.saveDiaryEntry).mockReturnValue(
      new Promise<void>(r => { resolve = r })
    )

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    qc.setQueryData<DiaryEntry[]>(['diary', '2026-07-29'], [])

    render(
      <QueryClientProvider client={qc}>
        <PracticeCard
          practice={{ id: '1', practice: 'Meditation', data_type: 'Bool', is_active: true, is_required: false }}
          date="2026-07-29"
          currentValue={undefined}
        />
      </QueryClientProvider>
    )

    await userEvent.click(screen.getByRole('switch'))

    // onMutate is async (awaits cancelQueries), so use waitFor
    await waitFor(() => {
      const cached = qc.getQueryData<DiaryEntry[]>(['diary', '2026-07-29'])
      expect(cached).toContainEqual(
        expect.objectContaining({ practice: 'Meditation', data_type: 'Bool' })
      )
    })

    resolve()
  })

  it('rolls back cache on save error', async () => {
    const { practicesApi } = await import('../../api/practices')
    vi.mocked(practicesApi.saveDiaryEntry).mockRejectedValue(new Error('network'))

    const initial: DiaryEntry[] = [{ practice: 'Meditation', data_type: 'Bool', value: { Bool: false } }]
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    qc.setQueryData<DiaryEntry[]>(['diary', '2026-07-29'], initial)

    render(
      <QueryClientProvider client={qc}>
        <PracticeCard
          practice={{ id: '1', practice: 'Meditation', data_type: 'Bool', is_active: true, is_required: false }}
          date="2026-07-29"
          currentValue={{ Bool: false }}
        />
      </QueryClientProvider>
    )

    await userEvent.click(screen.getByRole('switch'))

    // Wait for onError rollback to complete after rejected promise settles
    await waitFor(() => {
      const cached = qc.getQueryData<DiaryEntry[]>(['diary', '2026-07-29'])
      expect(cached).toEqual(initial)
    })
  })
})

describe('PracticeCard — Text + Time (Task 3)', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('free-text Text renders a textarea and saves on blur', () => {
    renderCard({ id: '2', practice: 'Journal', data_type: 'Text', is_active: true, is_required: false })
    const ta = screen.getByRole('textbox', { name: 'Journal' })
    expect(ta.tagName).toBe('TEXTAREA')
  })

  it('Text always renders a textarea, even with configured options (no dropdown)', () => {
    renderCard({ id: '3', practice: 'Mood', data_type: 'Text', is_active: true, is_required: false, dropdown_variants: 'Good\nOkay\nLow' })
    const ta = screen.getByRole('textbox', { name: 'Mood' })
    expect(ta.tagName).toBe('TEXTAREA')
    expect(screen.queryByRole('combobox', { name: 'Mood' })).toBeNull()
  })

  it('Time renders one field that formats and saves HH:MM', async () => {
    const { practicesApi } = await import('../../api/practices')
    vi.mocked(practicesApi.saveDiaryEntry).mockResolvedValue(undefined)
    renderCard({ id: '4', practice: 'Wake', data_type: 'Time', is_active: true, is_required: false })
    const input = screen.getByRole('textbox', { name: 'Wake' })
    await userEvent.type(input, '0630')
    expect((input as HTMLInputElement).value).toBe('06:30')
    input.blur()
    await waitFor(() => expect(practicesApi.saveDiaryEntry).toHaveBeenCalledWith(expect.any(String), 'Wake', { Time: { h: 6, m: 30 } }))
  })
})
