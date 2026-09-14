import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { setMatchMedia } from '@/test/match-media'
import { renderWithRouter } from '@/test/router'
import type { Doctor } from './api'
import { DoctorsTable } from './doctors-table'

const DOCTORS = [
  { id: 'd1', name: 'Dra. Ruiz', phone: null, email: null, active: true },
  { id: 'd2', name: 'Dr. Gómez', phone: '0991234567', email: 'g@x.com', active: false },
] as unknown as Doctor[]

describe('DoctorsTable', () => {
  it('ordena por nombre y busca sin acentos', async () => {
    setMatchMedia(true)
    const user = userEvent.setup()
    renderWithRouter(<DoctorsTable doctors={DOCTORS} onEdit={vi.fn()} onToggle={vi.fn()} />)
    await user.click(await screen.findByRole('button', { name: 'Ordenar por Doctor' }))
    const cells = screen
      .getAllByRole('row')
      .slice(1)
      .map((r) => r.querySelector('td')?.textContent)
    expect(cells).toEqual(['Dr. Gómez', 'Dra. Ruiz'])
    await user.type(screen.getByLabelText('Buscar doctor'), 'gomez')
    expect(screen.queryByText('Dra. Ruiz')).not.toBeInTheDocument()
  })

  it('en móvil muestra tarjetas con nombre, contacto combinado y acciones de 44 px', async () => {
    setMatchMedia(false)
    const { container } = renderWithRouter(
      <DoctorsTable doctors={DOCTORS} onEdit={vi.fn()} onToggle={vi.fn()} />,
    )
    expect(await screen.findByRole('list')).toBeInTheDocument()
    // Contacto de Dr. Gómez (el único con teléfono y correo): subtítulos unidos con " · ",
    // separador incluido en un `<span aria-hidden>` entre los dos, por eso se lee el `<p>`
    // completo (`textContent`) en vez de `getByText` con la cadena exacta.
    // Dra. Ruiz no tiene teléfono ni correo, así que su tarjeta no aporta ningún `<p>` de
    // subtítulo (`cards.tsx` filtra las celdas vacías): el único `<p>` es el de Dr. Gómez.
    const subtitle = container.querySelectorAll('li p')[0]
    expect(subtitle?.textContent).toBe('0991234567 · g@x.com')
    // 44 px: `size="icon"` (Button) y el `Switch` por defecto miden 44 px (docs/conventions.md §5).
    expect(screen.getByRole('button', { name: 'Editar Dr. Gómez' })).toHaveAttribute(
      'data-size',
      'icon',
    )
    expect(screen.getByRole('switch', { name: 'Dr. Gómez activo' })).toHaveAttribute(
      'data-size',
      'default',
    )
  })
})
