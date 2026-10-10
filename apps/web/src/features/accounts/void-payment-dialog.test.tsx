import { screen, within } from '@testing-library/react'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api-error'
import { renderWithProviders } from '@/test/render'
import { voidPayment } from './api'
import { VoidPaymentDialog } from './void-payment-dialog'

vi.mock('./api', () => ({ voidPayment: vi.fn() }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const PAYMENT = {
  id: 'p1',
  date: '2026-10-05',
  amount: '-120.00',
  method: 'efectivo' as const,
  remaining: '0.00',
}

function renderDialog() {
  const onOpenChange = vi.fn()
  const utils = renderWithProviders(
    <VoidPaymentDialog
      clinic={{ id: 'k1', name: 'Clínica Sur' }}
      payment={PAYMENT}
      open
      onOpenChange={onOpenChange}
    />,
  )
  return { ...utils, onOpenChange }
}

beforeEach(() => {
  vi.mocked(voidPayment).mockReset()
  vi.mocked(toast.success).mockReset()
  vi.mocked(toast.error).mockReset()
})

describe('VoidPaymentDialog («Anular pago», CTA-2)', () => {
  it('nombra el pago y la consecuencia, con la acción en destructivo y «Volver»', () => {
    renderDialog()
    const dialog = screen.getByRole('dialog', { name: 'Anular pago' })
    expect(dialog).toHaveTextContent('$ 120.00 · Efectivo del 05/10/2026 · Clínica Sur')
    expect(dialog).toHaveTextContent('Los trabajos que cerró este pago vuelven a «Entregado»')
    expect(within(dialog).getByRole('button', { name: 'Volver' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Anular pago' })).toHaveAttribute(
      'data-variant',
      'destructive',
    )
  })

  it('el motivo es obligatorio', async () => {
    const { user } = renderDialog()
    await user.click(screen.getByRole('button', { name: 'Anular pago' }))
    expect(await screen.findByText('Escribe el motivo')).toBeInTheDocument()
    expect(screen.getByLabelText('Motivo')).toHaveAttribute('aria-invalid', 'true')
    expect(voidPayment).not.toHaveBeenCalled()
  })

  it('anula con su motivo, cierra y avisa', async () => {
    vi.mocked(voidPayment).mockResolvedValue({ id: 'p1' } as never)
    const { user, onOpenChange } = renderDialog()
    await user.type(screen.getByLabelText('Motivo'), 'Registrado dos veces')
    await user.click(screen.getByRole('button', { name: 'Anular pago' }))
    expect(voidPayment).toHaveBeenCalledWith('p1', { motivo: 'Registrado dos veces' })
    await vi.waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(toast.success).toHaveBeenCalledWith('Pago anulado')
  })

  it('un 409 (ya estaba anulado) avisa y cierra', async () => {
    vi.mocked(voidPayment).mockRejectedValue(new ApiError('El pago ya está anulado', 409))
    const { user, onOpenChange } = renderDialog()
    await user.type(screen.getByLabelText('Motivo'), 'Duplicado')
    await user.click(screen.getByRole('button', { name: 'Anular pago' }))
    await vi.waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(toast.error).toHaveBeenCalledWith('El pago ya está anulado')
  })
})
