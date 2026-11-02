import { cleanup, render, screen } from '@testing-library/react'
import { cloneElement, type ReactElement } from 'react'
import i18n from 'i18next'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ru from '../../../public/locales/ru/translation.json'
import { toDateStr } from '../today/date'
import { exampleSummary } from './examples'
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
const KINDS: GuideKind[] = ['sleep', 'count', 'time', 'days']

describe('MiniReport', () => {
  afterEach(async () => { cleanup(); await i18n.changeLanguage('en') })

  it.each(KINDS)('%s shows the example band and is an image named by its summary', (kind) => {
    render(<MiniReport kind={kind} compact />)
    expect(screen.getByText('Example · not your data')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: exampleSummary(kind, today(), i18n.t.bind(i18n)) })).toBeInTheDocument()
  })

  it('draws with the real renderer: sleep has its charts, days its month grids', () => {
    const { container, unmount } = render(<MiniReport kind="sleep" compact />)
    expect(container.querySelectorAll('.recharts-surface')).toHaveLength(2)
    unmount()
    render(<MiniReport kind="days" compact />)
    expect(document.querySelectorAll('[data-cob]').length).toBeGreaterThan(60)
  })

  it('compact sleep shows two figures where the wide one shows four', () => {
    const { unmount } = render(<MiniReport kind="sleep" compact />)
    expect(screen.getByText('Nights in range')).toBeInTheDocument()
    const compact = screen.getAllByText('Average bedtime').length
    unmount()
    render(<MiniReport kind="sleep" />)
    expect(screen.getAllByText('Average bedtime').length).toBe(compact + 1)
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
