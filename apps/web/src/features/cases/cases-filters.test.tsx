import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { setMatchMedia } from '@/test/match-media'
import type { Clinic } from '@/features/clinics/api'
import { CasesFilters } from './cases-filters'

const clinics = [
  { id: 'c1', name: 'Sonrisas del Valle' },
  { id: 'c2', name: 'Clínica Dental Andina' },
] as unknown as Clinic[]

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

  // UX3-14: la clínica es un catálogo largo que se busca; el filtro usa `Combobox`, como el
  // formulario del trabajo.
  it('el filtro de clínica busca sin tildes y al elegir limpia el doctor', async () => {
    setMatchMedia(true)
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<CasesFilters value={{}} onChange={onChange} clinics={clinics} doctors={[]} />)

    const trigger = screen.getByRole('combobox', { name: 'Clínica' })
    expect(trigger).toHaveTextContent('Todas')
    await user.click(trigger)
    await user.type(screen.getByPlaceholderText('Buscar clínica'), 'clinica')
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Clínica Dental Andina',
    ])
    await user.click(screen.getByRole('option', { name: 'Clínica Dental Andina' }))
    expect(onChange).toHaveBeenCalledWith({ clinicId: 'c2', doctorId: undefined })
  })

  it('«Todas» en el filtro de clínica quita el filtro', async () => {
    setMatchMedia(true)
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <CasesFilters
        value={{ clinicId: 'c1' }}
        onChange={onChange}
        clinics={clinics}
        doctors={[]}
      />,
    )

    const trigger = screen.getByRole('combobox', { name: 'Clínica' })
    expect(trigger).toHaveTextContent('Sonrisas del Valle')
    await user.click(trigger)
    await user.click(screen.getByRole('option', { name: 'Todas' }))
    expect(onChange).toHaveBeenCalledWith({ clinicId: undefined, doctorId: undefined })
  })
})
