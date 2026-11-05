import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import type { MarkedPeriod } from '../../../api/markedPeriods'
import { addDays, fromDateStr, toDateStr } from '../../today/date'
import { BdaCards } from './BdaCard'
import { entries, FOUR, TODAY } from './fixtures'
import { insightRows, rowSeries } from './series'

const day = (offset: number) => toDateStr(addDays(fromDateStr(TODAY), offset))
const T = (h: number, m: number) => ({ Time: { h, m } })

/** 60 steady days (wake 4:20, 16 rounds); the 10 days before the last 5 run 24 rounds. */
function setup(periods: MarkedPeriod[]) {
  const days: Record<string, Record<string, unknown>> = {}
  for (let i = 90; i >= 1; i--) days[day(-i)] = { 'Подъём': T(4, 20), 'Кругов за день': i <= 15 && i > 5 ? 24 : 16 }
  const rows = insightRows(FOUR, null)
  const series = rowSeries(rows, entries(days), FOUR, null, TODAY)
  return render(<MemoryRouter><BdaCards rows={rows} series={series} periods={periods} practices={FOUR} todayCob={TODAY} /></MemoryRouter>)
}
const period = (id: string, start: number, end: number | null): MarkedPeriod => ({
  id, name: id, start_date: day(-start), end_date: end === null ? null : day(-end), exclude_from_usual: true,
})

describe('BdaCards', () => {
  it('card_for_a_recent_period_not_for_a_single_day', () => {
    setup([period('Retreat', 15, 6), period('Single', 3, 3)])
    const card = screen.getByRole('region', { name: 'Retreat' })
    expect(within(card).getByRole('link', { name: /Open/ })).toHaveAttribute('href', '/insights/period/Retreat')
    expect(within(card).getByText('Still settling')).toBeInTheDocument()
    const rounds = within(card).getByRole('row', { name: /Кругов за день/ })
    expect(within(rounds).getAllByRole('cell').map((c) => c.textContent)).toEqual(['16', '24', '16'])
    expect(screen.queryByRole('region', { name: 'Single' })).toBeNull()
  })

  it('names_overlapping_periods', () => {
    setup([period('Retreat', 15, 6), period('Fast', 20, 10)])
    expect(within(screen.getByRole('region', { name: 'Retreat' })).getByText('Overlaps: Fast')).toBeInTheDocument()
  })

  it('shows_the_three_most_changed_rows', () => {
    setup([period('Retreat', 15, 6)])
    const card = screen.getByRole('region', { name: 'Retreat' })
    // only rounds changed among the rows that have a usual, so it comes first
    expect(within(card).getAllByRole('row').length).toBeLessThanOrEqual(4)
    expect(within(card).getAllByRole('row')[1]).toHaveTextContent('Кругов за день')
  })
})
