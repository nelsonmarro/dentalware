import { render, screen, within } from '@testing-library/react'
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

  // M-1 (revisión Tarea 13): el patrón combobox de la APG espera que ↓ abra el desplegable con
  // foco en el disparador (como ya hacía el `Select` de Radix que este componente sustituye);
  // Enter/Espacio ya funcionaban (activación nativa del `<button>`), pero ↓ no hacía nada.
  it('ArrowDown con foco en el disparador abre el desplegable', async () => {
    const user = userEvent.setup()
    render(<Combobox items={items} value={null} onChange={vi.fn()} placeholder="Clínica" />)

    const trigger = screen.getByRole('combobox', { name: 'Clínica' })
    trigger.focus()
    await user.keyboard('{ArrowDown}')

    expect(screen.getByRole('dialog', { name: 'Clínica' })).toBeInTheDocument()
  })

  // M-2 (revisión Tarea 13): sin esto cmdk resalta siempre el primer ítem renderizado al
  // (re)montar la lista; con muchas opciones, quien reabre para corregir no ve resaltado (ni
  // `aria-selected`, que es lo único que anuncia un lector de pantalla — el check visual no)
  // el valor que ya tenía elegido, sino el primero del listado.
  it('al reabrir con un valor ya elegido, resalta esa opción (no la primera)', async () => {
    const user = userEvent.setup()
    render(<Combobox items={items} value="c2" onChange={vi.fn()} placeholder="Clínica" />)

    await user.click(screen.getByRole('combobox', { name: 'Clínica' }))

    expect(screen.getByRole('option', { name: 'Clínica Dental Andina' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByRole('option', { name: 'Sonrisas del Valle' })).toHaveAttribute(
      'aria-selected',
      'false',
    )
  })

  // M-4 (revisión Tarea 13): las opciones medían ~36 px (py-2 text-sm) — el técnico con
  // guantes elige producto en el móvil y este es un componente nuevo, no hereda la deuda del
  // `SelectItem` existente. Mismo mecanismo que `button.tsx` (altura fija, no derivada del
  // padding): `min-h-11`.
  it('cada opción mide al menos 44 px', async () => {
    const user = userEvent.setup()
    render(<Combobox items={items} value={null} onChange={vi.fn()} placeholder="Clínica" />)

    await user.click(screen.getByRole('combobox', { name: 'Clínica' }))

    for (const option of screen.getAllByRole('option')) {
      expect(option).toHaveClass('min-h-11')
    }
  })

  // M-3 (revisión Tarea 13, verificado primero en Chrome real): el popover de cmdk dentro de
  // `PopoverPrimitive.Content` es el único elemento con foco tabulable dentro del contenido
  // (los `Command.Item` no llevan `tabIndex`, se navegan con flechas); el `FocusScope` de Radix
  // fija `loop` a `true` sin importar `modal` (código propio de Radix, no configurable desde
  // aquí), así que con un solo elemento tabulable dentro, Tab se reenfoca a sí mismo en un
  // bucle en vez de salir del campo — confirmado en Chrome (`document.activeElement` seguía
  // siendo el buscador tras Tab, el popover seguía abierto). Se corta ese bucle a mano: Tab
  // cierra el desplegable y devuelve el foco al disparador, de modo que el siguiente Tab siga
  // el orden natural del formulario.
  it('Tab en el buscador cierra el desplegable y devuelve el foco al disparador', async () => {
    const user = userEvent.setup()
    render(<Combobox items={items} value={null} onChange={vi.fn()} placeholder="Clínica" />)

    const trigger = screen.getByRole('combobox', { name: 'Clínica' })
    await user.click(trigger)
    expect(screen.getByPlaceholderText('Buscar…')).toHaveFocus()

    await user.tab()

    expect(trigger).toHaveFocus()
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  // UX5-11: un ítem puede llevar un código (en monoespaciada, como en toda la app) y un detalle
  // secundario; se busca por cualquiera de los tres.
  describe('ítems con código y detalle', () => {
    const cases: ComboboxItem[] = [
      { value: 't1', code: '26-00101', label: 'Ana Ruiz', detail: 'Cobrado' },
      { value: 't2', code: '26-00102', label: 'Luis Paz', detail: 'Debe $ 120.00' },
    ]

    it('la opción dice código, etiqueta y detalle, con el código en monoespaciada', async () => {
      const user = userEvent.setup()
      render(<Combobox items={cases} value={null} onChange={vi.fn()} placeholder="Trabajo" />)
      await user.click(screen.getByRole('combobox', { name: 'Trabajo' }))
      const option = screen.getByRole('option', { name: '26-00101 Ana Ruiz · Cobrado' })
      expect(within(option).getByText('26-00101')).toHaveClass('font-mono')
      expect(within(option).getByText('Ana Ruiz')).not.toHaveClass('font-mono')
    })

    it.each([
      ['el código', '00102'],
      ['la etiqueta', 'luis'],
      ['el detalle', '120'],
    ])('filtra por %s', async (_what, text) => {
      const user = userEvent.setup()
      render(<Combobox items={cases} value={null} onChange={vi.fn()} placeholder="Trabajo" />)
      await user.click(screen.getByRole('combobox', { name: 'Trabajo' }))
      await user.type(screen.getByPlaceholderText('Buscar…'), text)
      expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
        '26-00102 Luis Paz · Debe $ 120.00',
      ])
    })

    it('el disparador muestra el elegido igual, con el código en monoespaciada', () => {
      render(<Combobox items={cases} value="t1" onChange={vi.fn()} placeholder="Trabajo" />)
      const trigger = screen.getByRole('combobox', { name: 'Trabajo' })
      expect(trigger).toHaveTextContent('26-00101 Ana Ruiz · Cobrado')
      expect(within(trigger).getByText('26-00101')).toHaveClass('font-mono')
    })
  })
})
