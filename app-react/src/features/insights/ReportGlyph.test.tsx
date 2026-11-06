import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ReportGlyph } from './ReportGlyph'

describe('ReportGlyph', () => {
  it('a table report is the table glyph, laid out as a grid', () => {
    const { container } = render(<ReportGlyph report={{ id: 'g', name: 'G', definition: { Grid: { practices: [] } } }} />)
    const g = container.firstElementChild!
    expect(g).toHaveAttribute('data-glyph', 'table')
    expect(g).toHaveClass('inline-grid', 'shrink-0')
    expect(g).not.toHaveClass('inline-flex')
  })

  it('a Goals report is the goals glyph', () => {
    const definition = { Panels: { version: 1, template: { Goals: { goals: [] } }, required: [], panels: [] } }
    const { container } = render(<ReportGlyph report={{ id: 'g', name: 'G', definition }} />)
    expect(container.firstElementChild).toHaveAttribute('data-glyph', 'goals')
    expect(container.querySelectorAll('[data-glyph] > span')).toHaveLength(6)
    expect(container.querySelectorAll('[data-glyph] > span.border')).toHaveLength(1)
  })
})
