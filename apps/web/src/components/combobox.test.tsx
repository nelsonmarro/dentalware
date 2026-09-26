import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Combobox, type ComboboxItem } from './combobox'

const items: ComboboxItem[] = [
  { value: 'c1', label: 'Sonrisas del Valle' },
  { value: 'c2', label: 'Clínica Dental Andina' },
]

describe('Combobox', () => {
  it('filtra las opciones al escribir y selecciona con teclado', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Combobox items={items} value={null} onChange={onChange} placeholder="Clínica" />)

    await user.click(screen.getByRole('combobox', { name: 'Clínica' }))
    await user.type(screen.getByPlaceholderText('Buscar…'), 'sonr')

    expect(screen.getAllByRole('option')).toHaveLength(1)

    await user.keyboard('{Enter}')
    expect(onChange).toHaveBeenCalledWith('c1')
  })

  it('filtra sin distinguir mayúsculas ni tildes', async () => {
    const user = userEvent.setup()
    render(<Combobox items={items} value={null} onChange={vi.fn()} placeholder="Clínica" />)

    await user.click(screen.getByRole('combobox', { name: 'Clínica' }))
    await user.type(screen.getByPlaceholderText('Buscar…'), 'ANDINA')

    expect(screen.getByRole('option', { name: 'Clínica Dental Andina' })).toBeInTheDocument()
  })

  it('sin coincidencias muestra el mensaje de vacío', async () => {
    const user = userEvent.setup()
    render(<Combobox items={items} value={null} onChange={vi.fn()} placeholder="Clínica" />)

    await user.click(screen.getByRole('combobox', { name: 'Clínica' }))
    await user.type(screen.getByPlaceholderText('Buscar…'), 'zzz')

    expect(screen.getByText('Sin resultados')).toBeInTheDocument()
  })

  it('el disparador mide al menos 44 px', () => {
    render(<Combobox items={items} value={null} onChange={vi.fn()} placeholder="Clínica" />)
    expect(screen.getByRole('combobox')).toHaveClass('h-11')
  })

  it('muestra en el disparador la etiqueta de la opción elegida, con el nombre accesible fijo', () => {
    render(<Combobox items={items} value="c2" onChange={vi.fn()} placeholder="Clínica" />)
    const trigger = screen.getByRole('combobox', { name: 'Clínica' })
    expect(trigger).toHaveTextContent('Clínica Dental Andina')
  })
})
