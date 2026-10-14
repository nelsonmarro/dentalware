import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Clinic } from './api'
import { ClinicForm } from './clinic-form'

const clinic = {
  id: 'c1',
  name: 'Clínica Sur',
  ruc: null,
  address: null,
  city: 'Quito',
  phone: null,
  whatsapp: null,
  email: null,
  paymentTermsDays: 30,
  notes: null,
  active: true,
} as unknown as Clinic

function setup(props: Partial<React.ComponentProps<typeof ClinicForm>> = {}) {
  const onSubmit = vi.fn()
  render(
    <ClinicForm
      open
      onOpenChange={() => {}}
      clinic={clinic}
      onSubmit={onSubmit}
      pending={false}
      {...props}
    />,
  )
  return onSubmit
}

describe('ClinicForm', () => {
  it('con focusField="whatsapp" enfoca el WhatsApp', async () => {
    setup({ focusField: 'whatsapp' })
    await waitFor(() => expect(screen.getByLabelText('WhatsApp')).toHaveFocus())
  })

  it('sin focusField enfoca el nombre con el cursor al final', async () => {
    setup()
    const name = screen.getByLabelText('Nombre') as HTMLInputElement
    await waitFor(() => expect(name).toHaveFocus())
    expect(name.selectionStart).toBe('Clínica Sur'.length)
    expect(name.selectionEnd).toBe('Clínica Sur'.length)
  })

  it('el WhatsApp tiene ayuda como descripción y no tiene placeholder', () => {
    setup()
    const input = screen.getByLabelText('WhatsApp')
    expect(input).toHaveAccessibleDescription(
      'Ej.: 099 123 4567 o +593 99 123 4567. Se usa para los avisos.',
    )
    expect(input).not.toHaveAttribute('placeholder')
  })

  it('una clínica inactiva lo dice en la descripción del diálogo', () => {
    setup({ clinic: { ...clinic, active: false } })
    expect(screen.getByRole('dialog')).toHaveAccessibleDescription(
      'Clínica Sur Clínica inactiva: actívala para que vuelva a salir en las listas.',
    )
  })

  it('al editar, la descripción del diálogo dice qué clínica se edita', () => {
    setup()
    expect(screen.getByRole('dialog')).toHaveAccessibleDescription('Clínica Sur')
  })

  it('en «Nueva clínica» el diálogo no lleva descripción', () => {
    setup({ clinic: undefined })
    expect(screen.getByRole('dialog', { name: 'Nueva clínica' })).not.toHaveAccessibleDescription()
  })

  it('envía el WhatsApp normalizado', async () => {
    const user = userEvent.setup()
    const onSubmit = setup()
    await user.type(screen.getByLabelText('WhatsApp'), '099 123 4567')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ whatsapp: '+593991234567' })
  })
})
