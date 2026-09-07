import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LabSettingsForm } from './lab-settings-form'

describe('LabSettingsForm', () => {
  it('el botón "Guardar cambios" ocupa el ancho completo en móvil (UX1-05)', () => {
    render(<LabSettingsForm initial={null} onSubmit={vi.fn()} pending={false} />)

    const button = screen.getByRole('button', { name: 'Guardar cambios' })
    // `w-full` (por defecto, en móvil) y `sm:w-auto` (recupera el ancho de contenido
    // desde el breakpoint `sm`) — antes solo tenía `flex justify-end`, que no ocupaba
    // el ancho del formulario en móvil.
    expect(button.className).toMatch(/(?:^|\s)w-full(?:\s|$)/)
    expect(button.className).toMatch(/(?:^|\s)sm:w-auto(?:\s|$)/)
  })

  it('fija autoComplete en nombre, RUC, dirección y teléfonos (UX1-08)', () => {
    render(<LabSettingsForm initial={null} onSubmit={vi.fn()} pending={false} />)

    expect(screen.getByLabelText('Nombre del laboratorio')).toHaveAttribute(
      'autocomplete',
      'organization',
    )
    expect(screen.getByLabelText('RUC')).toHaveAttribute('autocomplete', 'off')
    expect(screen.getByLabelText('Dirección')).toHaveAttribute('autocomplete', 'street-address')
    expect(screen.getByLabelText('Teléfonos')).toHaveAttribute('autocomplete', 'tel')
  })
})
