import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Combobox, type ComboboxItem } from './combobox'

const items: ComboboxItem[] = [
  { value: 'c1', label: 'Sonrisas del Valle' },
  { value: 'c2', label: 'Clínica Dental Andina' },
  { value: 'c3', label: 'Consultorio Núñez' },
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

  // I-1 (revisión Tarea 13): la sensibilidad real está en la tilde del TEXTO buscado sin
  // tilde ("clinica" → "Clínica…") o al revés ("NUÑEZ" con tilde → escrito "nunez" sin
  // ella): "ANDINA" arriba no ejercita `normalize` (ninguna de las dos formas lleva tilde),
  // así que ese test seguía en verde con la mutación que borraba
  // `.replace(/\p{Diacritic}/gu, '')` de `combobox.tsx`. Reproducido: con esa línea borrada
  // los dos `it` de abajo fallaban («Consultorio Núñez»/«Clínica Dental Andina» no
  // aparecían); restaurada la línea, vuelven a pasar.
  it('filtra "clinica" (sin tilde) contra una etiqueta con tilde', async () => {
    const user = userEvent.setup()
    render(<Combobox items={items} value={null} onChange={vi.fn()} placeholder="Clínica" />)

    await user.click(screen.getByRole('combobox', { name: 'Clínica' }))
    await user.type(screen.getByPlaceholderText('Buscar…'), 'clinica')

    expect(screen.getByRole('option', { name: 'Clínica Dental Andina' })).toBeInTheDocument()
  })

  it('filtra "nunez"/"NUÑEZ" contra "Consultorio Núñez" sin importar tilde ni caja', async () => {
    const user = userEvent.setup()
    render(<Combobox items={items} value={null} onChange={vi.fn()} placeholder="Clínica" />)

    await user.click(screen.getByRole('combobox', { name: 'Clínica' }))
    await user.type(screen.getByPlaceholderText('Buscar…'), 'nunez')
    expect(screen.getByRole('option', { name: 'Consultorio Núñez' })).toBeInTheDocument()

    await user.clear(screen.getByPlaceholderText('Buscar…'))
    await user.type(screen.getByPlaceholderText('Buscar…'), 'NUÑEZ')
    expect(screen.getByRole('option', { name: 'Consultorio Núñez' })).toBeInTheDocument()
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

  // I-2 (revisión Tarea 13): el disparador debe anunciar que abre un diálogo (`aria-haspopup=
  // "dialog"`, el que trae Radix por defecto) y ese diálogo debe tener nombre — antes
  // `aria-haspopup="listbox"` puesto a mano en el disparador pisaba el "dialog" de Radix (el
  // spread de Radix va antes que los props propios), y `PopoverPrimitive.Content` no llevaba
  // nombre, así que un lector de pantalla caía en un "diálogo" anónimo tras un anuncio de
  // "lista" que no correspondía a lo que se abre.
  it('el disparador anuncia un diálogo con nombre, no una lista', async () => {
    const user = userEvent.setup()
    render(<Combobox items={items} value={null} onChange={vi.fn()} placeholder="Clínica" />)

    const trigger = screen.getByRole('combobox', { name: 'Clínica' })
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog')

    await user.click(trigger)

    expect(screen.getByRole('dialog', { name: 'Clínica' })).toBeInTheDocument()
  })

  // I-3 (revisión Tarea 13): cmdk pone `aria-label="Suggestions"` en `Command.List` por
  // defecto (inglés); la regla 5 pide español en toda la UI, incluidos los nombres accesibles.
  it('la lista de resultados se anuncia en español', async () => {
    const user = userEvent.setup()
    render(<Combobox items={items} value={null} onChange={vi.fn()} placeholder="Clínica" />)

    await user.click(screen.getByRole('combobox', { name: 'Clínica' }))

    expect(screen.getByRole('listbox', { name: 'Resultados' })).toBeInTheDocument()
  })
})
