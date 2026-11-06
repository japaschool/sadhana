import { cleanup, render, screen } from '@testing-library/react'
import { cloneElement, type ReactElement } from 'react'
import i18n from 'i18next'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ru from '../../../public/locales/ru/translation.json'
import { toDateStr } from '../today/date'
import { exampleDay, exampleSummary } from './examples'
import { MiniReport } from './MiniReport'
import type { GuideKind } from './guideLogic'
import { PanelsReportView } from '../insights/panels/PanelsReportView'
import { exampleReport } from './examples'

vi.mock('recharts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('recharts')>()),
  ResponsiveContainer: ({ children }: { children: ReactElement<{ width: number; height: number }> }) =>
    cloneElement(children, { width: 600, height: 300 }),
}))

const today = () => toDateStr(new Date())
const KINDS: GuideKind[] = ['sleep', 'count', 'time', 'days', 'gaps', 'goals']

describe('MiniReport', () => {
  afterEach(async () => { cleanup(); await i18n.changeLanguage('en') })

  it.each(KINDS)('%s shows the example band and is an image named by its summary', (kind) => {
    render(<MiniReport kind={kind} compact />)
    expect(screen.getByText('Example · not your data')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: exampleSummary(kind, exampleDay(kind, today()), i18n.t.bind(i18n)) })).toBeInTheDocument()
  })

  it('days is a full month’s example on the first of the month, and its summary says the same', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 1, 12))
    try {
      render(<MiniReport kind="days" compact />)
      const cells = [...document.querySelectorAll<HTMLElement>('[data-cob]')]
      expect(cells.every((c) => c.dataset.cob!.startsWith('2026-10'))).toBe(true)
      const day = exampleDay('days', '2026-11-01')
      expect(screen.getByRole('img', { name: exampleSummary('days', day, i18n.t.bind(i18n)) })).toBeInTheDocument()
    } finally { vi.useRealTimers() }
  })

  it('keeps the month legend under the grids, as in every example frame', () => {
    render(<MiniReport kind="days" compact />)
    const cell = document.querySelector('[data-cob]')!
    expect(cell.compareDocumentPosition(screen.getByRole('list', { name: 'Key' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('a real report has the month legend above its sections', () => {
    const e = exampleReport('days', today(), i18n.t.bind(i18n))
    render(<PanelsReportView report={{ id: 'r', name: 'Days', definition: { Panels: e.definition } }} definition={e.definition} entries={e.entries} previous={undefined} practices={e.practices} todayCob={today()} chartHeight={100} formLink={null} />)
    const cell = document.querySelector('[data-cob]')!
    expect(cell.compareDocumentPosition(screen.getByRole('list', { name: 'Key' })) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy()
  })

  it('draws with the real renderer: sleep has its charts, days its month grids', () => {
    const { container, unmount } = render(<MiniReport kind="sleep" compact />)
    expect(container.querySelectorAll('.recharts-surface')).toHaveLength(2)
    unmount()
    render(<MiniReport kind="days" compact />)
    const cells = document.querySelectorAll('[data-cob]').length
    expect(cells).toBeGreaterThanOrEqual(28)
    expect(cells).toBeLessThanOrEqual(31) // one practice in a card, so it sits beside the other cards
  })

  it('wide, and with the person’s own practices, days shows each one', () => {
    const { unmount } = render(<MiniReport kind="days" />)
    expect(document.querySelectorAll('[data-cob]').length).toBeGreaterThan(60)
    unmount()
    render(<MiniReport kind="days" compact applied={{ names: ['Walk', 'Read'] }} />)
    expect(document.querySelectorAll('[data-cob]').length).toBeGreaterThan(40)
  })

  it.each([true, false])('shows no summary figures or time label (compact: %s)', (compact) => {
    render(<MiniReport kind="sleep" compact={compact} />)
    expect(screen.queryByText('Nights in range')).toBeNull()
    expect(screen.queryByText('Average sleep')).toBeNull()
    expect(screen.queryByText('After 4 weeks')).toBeNull()
  })

  it.each(['count', 'time'] as const)('%s shows its chart without the daily average above it', (kind) => {
    const { container } = render(<MiniReport kind={kind} />)
    expect(container.querySelector('.recharts-bar-rectangle')).not.toBeNull()
    expect(screen.queryByText(/^Daily average/)).toBeNull()
    expect(screen.queryByText('Days on target')).toBeNull()
  })

  it('days shows its grids without the month figures; a real report keeps them', () => {
    const { unmount } = render(<MiniReport kind="days" />)
    expect(screen.queryByText('This month')).toBeNull()
    expect(screen.queryByText('Last 90 days')).toBeNull()
    expect(document.querySelectorAll('[data-cob]').length).toBeGreaterThan(0)
    unmount()
    const e = exampleReport('days', today(), i18n.t.bind(i18n))
    render(<PanelsReportView report={{ id: 'r', name: 'Days', definition: { Panels: e.definition } }} definition={e.definition} entries={e.entries} previous={undefined} practices={e.practices} todayCob={today()} chartHeight={100} formLink={null} />)
    expect(screen.getAllByText('This month').length).toBeGreaterThan(0)
  })

  it('is not interactive: no tooltip', () => {
    const { container } = render(<MiniReport kind="count" compact />)
    expect(container.querySelector('.recharts-tooltip-wrapper')).toBeNull()
  })

  it('PanelsReportView still has a tooltip by default', () => {
    const e = exampleReport('count', today(), i18n.t.bind(i18n))
    const { container } = render(
      <PanelsReportView report={{ id: 'x', name: 'x', definition: { Panels: e.definition } }} definition={e.definition} entries={e.entries}
        previous={undefined} practices={e.practices} todayCob={today()} chartHeight={150} formLink={null} />,
    )
    expect(container.querySelector('.recharts-tooltip-wrapper')).not.toBeNull()
  })

  it('follows the language', async () => {
    i18n.addResourceBundle('ru', 'translation', ru, true, true)
    await i18n.changeLanguage('ru')
    render(<MiniReport kind="sleep" compact />)
    expect(screen.getByText('Пример · не ваши данные')).toBeInTheDocument()
  })
})
