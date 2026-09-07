import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { setMatchMedia } from '@/test/match-media'
import { CasesFilters } from './cases-filters'

describe('CasesFilters', () => {
  it('el buscador tiene una etiqueta <label> visible asociada, no solo aria-label (UX1-09)', () => {
    setMatchMedia(true)
    render(<CasesFilters value={{}} onChange={vi.fn()} clinics={[]} doctors={[]} />)

    const input = screen.getByLabelText('Buscar por código, paciente o caja')
    const label = document.querySelector(`label[for="${input.id}"]`)
    expect(label).not.toBeNull()
    expect(label).toBeVisible()
    expect(label).toHaveTextContent('Buscar por código, paciente o caja')
  })
})
