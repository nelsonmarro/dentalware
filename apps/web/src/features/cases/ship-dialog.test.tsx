import { toIsoDate } from '@dentalware/shared'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import type { CaseDetail } from './api'
import { formatDate } from './date-format'
import { ShipDialog } from './ship-dialog'

const { postCaseAction, fetchCouriers } = vi.hoisted(() => ({
  postCaseAction: vi.fn(),
  fetchCouriers: vi.fn(),
}))
vi.mock('./api', () => ({ postCaseAction }))
vi.mock('@/features/deliveries/api', () => ({ fetchCouriers }))

beforeEach(() => {
  postCaseAction.mockReset()
  postCaseAction.mockResolvedValue({ id: 'c1', status: 'enviado' })
  fetchCouriers.mockReset()
  fetchCouriers.mockResolvedValue([
    { id: 'm1', name: 'Bruno Mensajero' },
    { id: 'm2', name: 'Zoila Mensajera' },
  ])
})

// El diálogo solo lee el id del trabajo.
const terminado = { id: 'c1', status: 'terminado' } as unknown as CaseDetail
const hoy = toIsoDate(new Date())

/** Quien usa la app (`self`, obligatorio donde un mensajero llega al envío). */
const yo = { id: 'u-yo', name: 'Yo' }

describe('ShipDialog', () => {
  it('sin mensajero «Marcar enviado» está deshabilitado', async () => {
    renderWithProviders(
      <ShipDialog self={yo} case={terminado} role="recepcion" open onOpenChange={() => {}} />,
    )
    const dialog = await screen.findByRole('dialog', { name: 'Marcar enviado' })
    expect(within(dialog).getByRole('button', { name: 'Marcar enviado' })).toBeDisabled()
  })

  it('recepción elige mensajero y fecha: la descripción lo dice y envía el envío', async () => {
    const onOpenChange = vi.fn()
    const { user } = renderWithProviders(
      <ShipDialog self={yo} case={terminado} role="recepcion" open onOpenChange={onOpenChange} />,
    )
    const dialog = await screen.findByRole('dialog', { name: 'Marcar enviado' })
    expect(within(dialog).getByLabelText('Fecha de entrega')).toHaveValue(hoy)

    await user.click(within(dialog).getByRole('combobox', { name: 'Mensajero' }))
    await user.click(await screen.findByRole('option', { name: 'Zoila Mensajera' }))
    expect(
      within(dialog).getByText(
        `El trabajo sale del laboratorio con Zoila Mensajera el ${formatDate(hoy)}.`,
      ),
    ).toBeInTheDocument()

    fireEvent.change(within(dialog).getByLabelText('Fecha de entrega'), {
      target: { value: '2099-01-02' },
    })
    expect(
      within(dialog).getByText(
        'El trabajo sale del laboratorio con Zoila Mensajera el 02/01/2099.',
      ),
    ).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Marcar enviado' }))
    await waitFor(() =>
      expect(postCaseAction).toHaveBeenCalledWith('c1', {
        accion: 'marcar_enviado',
        motivo: null,
        envio: { mensajeroId: 'm2', fecha: '2099-01-02' },
      }),
    )
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
  })

  it('para el mensajero el campo muestra su nombre, no es editable y envía con él', async () => {
    const { user } = renderWithProviders(
      <ShipDialog
        case={terminado}
        role="mensajero"
        self={{ id: 'm7', name: 'Mario Mensajero' }}
        open
        onOpenChange={() => {}}
      />,
    )
    const dialog = await screen.findByRole('dialog', { name: 'Marcar enviado' })
    expect(within(dialog).getByText('Mario Mensajero')).toBeInTheDocument()
    expect(within(dialog).queryByRole('combobox')).not.toBeInTheDocument()
    // La lista de mensajeros es solo de admin y recepción: al mensajero ni se le pide.
    expect(fetchCouriers).not.toHaveBeenCalled()

    await user.click(within(dialog).getByRole('button', { name: 'Marcar enviado' }))
    await waitFor(() =>
      expect(postCaseAction).toHaveBeenCalledWith('c1', {
        accion: 'marcar_enviado',
        motivo: null,
        envio: { mensajeroId: 'm7', fecha: hoy },
      }),
    )
  })
})
