import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { PracticeRow } from './PracticeRow'
import type { PracticeValue, UserPractice } from '../../../types/api'

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

  it('Duration: + opens Add mode, the value opens Set total', () => {
    setup({ practice: 'Audiobooks', data_type: 'Duration' }, { Duration: 30 })
    expect(screen.getByText('30 min')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Add time to Audiobooks' }))
    expect(screen.getByRole('radio', { name: 'Add' })).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit Audiobooks' }))
    expect(screen.getByRole('radio', { name: 'Set total' })).toHaveAttribute('aria-checked', 'true')
  })

  it('Text without options renders the text row', () => {
    setup({ practice: 'Gratitude', data_type: 'Text' })
    expect(screen.getByText("What's on your mind today?")).toBeInTheDocument()
  })
})
