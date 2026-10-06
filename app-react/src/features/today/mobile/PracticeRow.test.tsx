import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { PracticeRow } from './PracticeRow'
import type { PracticeValue, UserPractice } from '../../../types/api'

function hideApp() {
  Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
  document.dispatchEvent(new Event('visibilitychange'))
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
}

function setup(p: Partial<UserPractice> & Pick<UserPractice, 'practice' | 'data_type'>, value?: PracticeValue) {
  const onSave = vi.fn()
  render(<PracticeRow practice={{ id: '1', is_active: true, ...p }} value={value} failed={false} onSave={onSave} />)
  return onSave
}

describe('PracticeRow', () => {
  it('Time: required+empty shows Required; typing formats and saves on blur', () => {
    const onSave = setup({ practice: 'Wake up', data_type: 'Time', is_required: true })
    expect(screen.getByText('Required')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Edit Wake up' }))
    const input = screen.getByRole('textbox', { name: 'Wake up' })
    fireEvent.change(input, { target: { value: '0410' } })
    expect(input).toHaveValue('04:10')
    fireEvent.blur(input)
    expect(onSave).toHaveBeenCalledWith({ Time: { h: 4, m: 10 } })
  })

  it('Time: backspace steps back over the colon into the hours', () => {
    setup({ practice: 'Wake up', data_type: 'Time' }, { Time: { h: 4, m: 10 } })
    fireEvent.click(screen.getByRole('button', { name: 'Edit Wake up' }))
    const input = screen.getByRole('textbox', { name: 'Wake up' })
    for (const [typed, shown] of [['04:1', '04:1'], ['04:', '04:'], ['04', '0'], ['', '']]) {
      fireEvent.change(input, { target: { value: typed } })
      expect(input).toHaveValue(shown)
    }
  })

  it('saves an inline value when the app is hidden without a blur (iOS PWA close)', () => {
    const onSave = setup({ practice: 'Rounds', data_type: 'Int' })
    fireEvent.click(screen.getByRole('button', { name: 'Edit Rounds' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Rounds' }), { target: { value: '16' } })
    act(() => hideApp())
    expect(onSave).toHaveBeenCalledWith({ Int: 16 })
  })

  it('Int: shows the value; clearing saves null', () => {
    const onSave = setup({ practice: 'Rounds', data_type: 'Int' }, { Int: 17 })
    fireEvent.click(screen.getByRole('button', { name: 'Edit Rounds' }))
    const input = screen.getByRole('textbox', { name: 'Rounds' })
    expect(input).toHaveValue('17')
    fireEvent.change(input, { target: { value: '' } })
    fireEvent.blur(input)
    expect(onSave).toHaveBeenCalledWith(null)
  })

  it('Int: empty and optional shows + Add', () => {
    setup({ practice: 'Rounds', data_type: 'Int' })
    expect(screen.getByText('+ Add')).toBeInTheDocument()
  })

  it('Bool: toggles', () => {
    const onSave = setup({ practice: 'Attunement', data_type: 'Bool' }, { Bool: false })
    fireEvent.click(screen.getByRole('switch', { name: 'Attunement' }))
    expect(onSave).toHaveBeenCalledWith({ Bool: true })
  })

  it('Int with options: anchored menu selects and clears', () => {
    const onSave = setup({ practice: 'Quality', data_type: 'Int', dropdown_variants: '1,2,3' }, { Int: 2 })
    fireEvent.click(screen.getByRole('button', { name: 'Edit Quality' }))
    expect(screen.getByRole('menuitemradio', { name: /2/ })).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(screen.getByRole('menuitemradio', { name: '3' }))
    expect(onSave).toHaveBeenCalledWith({ Int: 3 })
    fireEvent.click(screen.getByRole('button', { name: 'Edit Quality' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Clear' }))
    expect(onSave).toHaveBeenLastCalledWith(null)
  })

  it('Text with newline options saves the text option', () => {
    const onSave = setup({ practice: 'Mood', data_type: 'Text', dropdown_variants: 'Low\nCalm' })
    fireEvent.click(screen.getByRole('button', { name: 'Edit Mood' }))
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Calm' }))
    expect(onSave).toHaveBeenCalledWith({ Text: 'Calm' })
  })

  it('shows a value missing from the options without selecting one', () => {
    setup({ practice: 'Mood', data_type: 'Text', dropdown_variants: 'Low,Calm' }, { Text: 'Joyful' })
    expect(screen.getByText('Joyful')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Edit Mood' }))
    expect(screen.getAllByRole('menuitemradio').every((el) => el.getAttribute('aria-checked') === 'false')).toBe(true)
  })

  it('Duration: the value edits inline in minutes; + opens the add sheet', () => {
    const onSave = setup({ practice: 'Audiobooks', data_type: 'Duration' }, { Duration: 30 })
    expect(screen.getByText('30 min')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Edit Audiobooks' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    const input = screen.getByRole('textbox', { name: 'Audiobooks' })
    expect(input).toHaveValue('30')
    fireEvent.change(input, { target: { value: '45' } })
    fireEvent.blur(input)
    expect(onSave).toHaveBeenCalledWith({ Duration: 45 })
    fireEvent.click(screen.getByRole('button', { name: 'Add time to Audiobooks' }))
    expect(screen.getByRole('radio', { name: 'Add' })).toHaveAttribute('aria-checked', 'true')
  })

  it('Duration: empty edits inline, with no add sheet', () => {
    const onSave = setup({ practice: 'Audiobooks', data_type: 'Duration' })
    expect(screen.queryByRole('button', { name: 'Add time to Audiobooks' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Edit Audiobooks' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox', { name: 'Audiobooks' }), { target: { value: '20' } })
    fireEvent.blur(screen.getByRole('textbox', { name: 'Audiobooks' }))
    expect(onSave).toHaveBeenCalledWith({ Duration: 20 })
  })

  it('Text without options renders the text row with no placeholder', () => {
    setup({ practice: 'Gratitude', data_type: 'Text' })
    expect(screen.getByText('+ Add')).toBeInTheDocument()
    expect(screen.queryByText(/on your mind/)).not.toBeInTheDocument()
  })
})
