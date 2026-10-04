import { screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api-error'
import { renderWithProviders } from '@/test/render'
import { FailDialog } from './fail-dialog'

const { failDelivery } = vi.hoisted(() => ({ failDelivery: vi.fn() }))
vi.mock('./api', () => ({ failDelivery }))

const entrega = { id: 'd1', type: 'entrega' } as const

beforeEach(() => {
  failDelivery.mockReset()
  // Viernes 2026-10-02: el siguiente día hábil es el lunes 2026-10-05.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-02T12:00:00'))
})
afterEach(() => {
  vi.useRealTimers()
})

describe('FailDialog', () => {
  it('propone como nueva fecha el siguiente día hábil (un viernes, el lunes)', () => {
    renderWithProviders(<FailDialog delivery={entrega} open onOpenChange={() => {}} />)
    expect(screen.getByLabelText('Nueva fecha')).toHaveValue('2026-10-05')
    expect(screen.getByLabelText('Nueva fecha')).toHaveAttribute('min', '2026-10-02')
  })

  it('el título dice qué no se pudo hacer según el tipo', () => {
    renderWithProviders(
      <FailDialog delivery={{ id: 'd2', type: 'recogida' }} open onOpenChange={() => {}} />,
    )
    expect(screen.getByRole('dialog', { name: 'No se pudo recoger' })).toBeInTheDocument()
  })

  it('el motivo es obligatorio: sin él no se envía', async () => {
    const { user } = renderWithProviders(
      <FailDialog delivery={entrega} open onOpenChange={() => {}} />,
    )
    await user.click(screen.getByRole('button', { name: 'Reprogramar' }))
    expect(await screen.findByText('Escribe el motivo')).toBeInTheDocument()
    expect(screen.getByLabelText('Motivo')).toHaveAttribute('aria-invalid', 'true')
    expect(failDelivery).not.toHaveBeenCalled()
  })

  it('envía el motivo y la nueva fecha y se cierra', async () => {
    failDelivery.mockResolvedValue({ id: 'd9' })
    const onOpenChange = vi.fn()
    const { user } = renderWithProviders(
      <FailDialog delivery={entrega} open onOpenChange={onOpenChange} />,
    )
    await user.type(screen.getByLabelText('Motivo'), 'Clínica cerrada')
    await user.click(screen.getByRole('button', { name: 'Reprogramar' }))
    await waitFor(() =>
      expect(failDelivery).toHaveBeenCalledWith('d1', {
        motivo: 'Clínica cerrada',
        nuevaFecha: '2026-10-05',
      }),
    )
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
  })

  it('si la entrega ya no estaba pendiente (409) avisa y refresca la lista', async () => {
    failDelivery.mockRejectedValue(new ApiError('Esta entrega ya no está pendiente.', 409))
    const { user, client } = renderWithProviders(
      <FailDialog delivery={entrega} open onOpenChange={() => {}} />,
    )
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    await user.type(screen.getByLabelText('Motivo'), 'Clínica cerrada')
    await user.click(screen.getByRole('button', { name: 'Reprogramar' }))
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['trabajos'] }))
  })
})
