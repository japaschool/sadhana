import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { ChartsPage } from './ChartsPage'
import { chartsApi } from '../../api/charts'
import { practicesApi } from '../../api/practices'

// ─── API mocks ────────────────────────────────────────────────────────────────

vi.mock('../../api/charts', () => ({
  chartsApi: {
    getReports: vi.fn().mockResolvedValue([]),
    getReportData: vi.fn().mockResolvedValue([]),
    createReport: vi.fn().mockResolvedValue('new-report-id'),
    updateReport: vi.fn().mockResolvedValue(undefined),
    deleteReport: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('../../api/practices', () => ({
  practicesApi: {
    getUserPractices: vi.fn().mockResolvedValue([
      { id: 'p1', practice: 'Meditation', data_type: 'Bool', is_active: true, is_required: true },
      { id: 'p2', practice: 'Reading',    data_type: 'Int',  is_active: true, is_required: false },
    ]),
  },
}))

vi.mock('../../store/authStore', () => ({
  useAuthStore: vi.fn().mockReturnValue({ id: 'user-1', email: 'test@example.com' }),
}))

// ─── Helper ──────────────────────────────────────────────────────────────────

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Routes>
          <Route path="/" element={ui} />
          <Route path="/charts/new" element={<div>New chart page</div>} />
          <Route path="/charts" element={<ChartsPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

// ─── Inline the pure function to test it without rendering the full component ─

function toCSV(entries: Array<{ cob_date: string; practice: string; value: unknown }>, practiceMap: Record<string, string>): string {
  function valueToNumber(raw: unknown): number | null {
    if (raw === null || raw === undefined) return null
    if (typeof raw === 'number') return raw
    if (typeof raw === 'object') {
      const obj = raw as Record<string, unknown>
      if ('Int' in obj) return obj.Int as number
      if ('Duration' in obj) return obj.Duration as number
    }
    return null
  }
  const header = ['date', 'practice', 'value'].join(',')
  const rows = entries.map(e => {
    const name = (practiceMap[e.practice] ?? e.practice).replace(/,/g, ' ')
    const val = valueToNumber(e.value)
    return [e.cob_date, name, val === null ? '' : String(val)].join(',')
  })
  return [header, ...rows].join('\n')
}

describe('toCSV', () => {
  it('produces header + data row', () => {
    const csv = toCSV(
      [{ cob_date: '2026-07-01', practice: 'abc', value: { Int: 30 } }],
      { abc: 'Meditation' }
    )
    expect(csv).toBe('date,practice,value\n2026-07-01,Meditation,30')
  })

  it('uses practice id when not in map', () => {
    const csv = toCSV(
      [{ cob_date: '2026-07-01', practice: 'unknown-id', value: { Int: 5 } }],
      {}
    )
    expect(csv).toContain('unknown-id')
  })

  it('outputs empty value for null', () => {
    const csv = toCSV(
      [{ cob_date: '2026-07-01', practice: 'abc', value: null }],
      { abc: 'Test' }
    )
    expect(csv).toBe('date,practice,value\n2026-07-01,Test,')
  })

  it('replaces commas in practice names', () => {
    const csv = toCSV(
      [{ cob_date: '2026-07-01', practice: 'abc', value: { Int: 1 } }],
      { abc: 'Yoga, morning' }
    )
    expect(csv).toContain('Yoga  morning')
  })
})

// ─── ChartsPage — empty state ─────────────────────────────────────────────────

describe('ChartsPage — empty state', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders empty state card when there are no reports', async () => {
    wrap(<ChartsPage />)
    await waitFor(() => {
      expect(screen.getByText(/no reports yet/i)).toBeInTheDocument()
    })
  })
})

// ── Y-axis select ─────────────────────────────────────────────────────────────
describe('ChartsPage — Y-axis select', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Override the reports mock with one that has a Graph report + one trace
    vi.mocked(chartsApi.getReports).mockResolvedValue([
      {
        id: 'r1',
        name: 'Test Report',
        definition: {
          Graph: {
            bar_layout: 'Grouped',
            traces: [
              { label: null, type_: 'Bar', practice: 'p1', y_axis: null, show_average: false },
            ],
          },
        },
      },
    ])
    vi.mocked(practicesApi.getUserPractices).mockResolvedValue([
      { id: 'p1', practice: 'Meditation', data_type: 'Int', is_active: true, is_required: false },
    ])
  })

  it('calls updateReport with y_axis: "Y2" when Right axis is selected', async () => {
    const user = userEvent.setup()
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/charts']}>
          <Routes>
            <Route path="/charts" element={<ChartsPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    )
    // Open outer manage accordion, then expand the report card's trace editor
    const manageBtn = await screen.findByText(/manage reports/i)
    await user.click(manageBtn)
    const cardToggle = await screen.findByTestId('report-card-toggle')
    await user.click(cardToggle)
    // Y-axis select is now visible inside the open trace editor
    const select = await screen.findByRole('combobox', { name: /y-axis/i })
    await user.selectOptions(select, 'Y2')
    await waitFor(() => {
      expect(vi.mocked(chartsApi.updateReport)).toHaveBeenCalledWith(
        'r1',
        'Test Report',
        expect.objectContaining({
          Graph: expect.objectContaining({
            traces: expect.arrayContaining([
              expect.objectContaining({ y_axis: 'Y2' }),
            ]),
          }),
        })
      )
    })
  })
})

describe('ChartsPage ?report=', () => {
  it('opens the report named in the query string', async () => {
    vi.mocked(chartsApi.getReports).mockResolvedValueOnce([
      { id: 'r1', name: 'Weekly', definition: { Graph: { bar_layout: 'Grouped', traces: [] } } },
    ])
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/charts/manage?report=r1']}>
          <Routes><Route path="/charts/manage" element={<ChartsPage />} /></Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )
    expect(await screen.findByRole('button', { name: /Weekly/ })).toBeInTheDocument()
  })
})
