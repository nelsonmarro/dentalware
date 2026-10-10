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
  // Cerró 26-00101 y 26-00102; a 26-00107 le pagó una parte (UX5-03).
  allocations: [
    { caseId: 'c1', code: '26-00101', amount: '50.00', reopens: true },
    { caseId: 'c2', code: '26-00102', amount: '40.00', reopens: true },
    { caseId: 'c7', code: '26-00107', amount: '30.00', reopens: false },
  ],
}

function renderDialog(payment: Partial<typeof PAYMENT> = {}) {
  const onOpenChange = vi.fn()
  const utils = renderWithProviders(
    <VoidPaymentDialog
      clinic={{ id: 'k1', name: 'Clínica Sur' }}
      payment={{ ...PAYMENT, ...payment }}
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
  it('nombra el pago y la consecuencia, con la acción en destructivo sólido y «Volver»', () => {
    renderDialog()
    const dialog = screen.getByRole('dialog', { name: 'Anular pago' })
    expect(dialog).toHaveTextContent('$ 120.00 · Efectivo del 05/10/2026 · Clínica Sur')
    expect(dialog).toHaveTextContent(
      'El pago deja de contar en el saldo y queda tachado en los movimientos.',
    )
    expect(within(dialog).getByRole('button', { name: 'Volver' })).toBeInTheDocument()
    // UX5-07: el que confirma va en destructivo sólido, no en el suave que parece deshabilitado.
    expect(within(dialog).getByRole('button', { name: 'Anular pago' })).toHaveAttribute(
      'data-variant',
      'destructive-solid',
    )
  })

  it('nombra lo que quita a cada trabajo y los que vuelven a «Entregado» (UX5-03)', () => {
    renderDialog()
    const dialog = screen.getByRole('dialog', { name: 'Anular pago' })
    expect(dialog).toHaveTextContent(
      'Se quita lo aplicado a 26-00101 ($ 50.00), 26-00102 ($ 40.00) y 26-00107 ($ 30.00).',
    )
    expect(dialog).toHaveTextContent('Vuelven a «Entregado»: 26-00101 y 26-00102.')
    expect(within(dialog).getAllByText('26-00101')[0]).toHaveClass('font-mono')
  })

  it('con uno solo que reabre, en singular; sin ninguno que reabra, no lo dice', () => {
    const { unmount } = renderDialog({ allocations: [PAYMENT.allocations[0]!] })
    expect(screen.getByRole('dialog')).toHaveTextContent('Vuelve a «Entregado»: 26-00101.')
    unmount()
    renderDialog({ allocations: [PAYMENT.allocations[2]!] })
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent('Se quita lo aplicado a 26-00107 ($ 30.00).')
    expect(dialog).not.toHaveTextContent('«Entregado»')
  })

  it('sin asignaciones vigentes: «No estaba aplicado a ningún trabajo»', () => {
    renderDialog({ allocations: [] })
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent('No estaba aplicado a ningún trabajo.')
    expect(dialog).not.toHaveTextContent('Se quita')
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

  // M4 de la revisión final del PR 2: un 422 no se traga. En el motivo, bajo el campo; si no tiene
  // campo (un id inválido), con un aviso.
  it('un 422 en el motivo se pinta bajo el campo y el diálogo sigue abierto', async () => {
    vi.mocked(voidPayment).mockRejectedValue(
      new ApiError('Datos inválidos', 422, [{ path: 'motivo', message: 'Máximo 500 caracteres' }]),
    )
    const { user, onOpenChange } = renderDialog()
    await user.type(screen.getByLabelText('Motivo'), 'Duplicado')
    await user.click(screen.getByRole('button', { name: 'Anular pago' }))
    expect(await screen.findByText('Máximo 500 caracteres')).toBeInTheDocument()
    expect(screen.getByLabelText('Motivo')).toHaveAttribute('aria-invalid', 'true')
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('un 422 sin campo en el formulario avisa con un toast', async () => {
    vi.mocked(voidPayment).mockRejectedValue(
      new ApiError('Datos inválidos', 422, [{ path: 'id', message: 'Identificador inválido' }]),
    )
    const { user } = renderDialog()
    await user.type(screen.getByLabelText('Motivo'), 'Duplicado')
    await user.click(screen.getByRole('button', { name: 'Anular pago' }))
    await vi.waitFor(() => expect(toast.error).toHaveBeenCalledWith('Datos inválidos'))
  })

  // UX5-20: solo el issue de `motivo` va bajo el campo. Uno de otro campo (p. ej. de un reparto,
  // que este formulario no tiene) no se pinta bajo «Motivo»: va al aviso.
  it('un 422 que no es del motivo no se pinta bajo «Motivo»: avisa con un toast', async () => {
    vi.mocked(voidPayment).mockRejectedValue(
      new ApiError('Datos inválidos', 422, [
        { path: 'asignaciones', message: 'Lo aplicado no puede superar el pago' },
      ]),
    )
    const { user } = renderDialog()
    await user.type(screen.getByLabelText('Motivo'), 'Duplicado')
    await user.click(screen.getByRole('button', { name: 'Anular pago' }))
    await vi.waitFor(() => expect(toast.error).toHaveBeenCalledWith('Datos inválidos'))
    expect(screen.queryByText('Lo aplicado no puede superar el pago')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Motivo')).not.toHaveAttribute('aria-invalid', 'true')
  })

  it('un 422 con el motivo y otro campo pinta el motivo y avisa del resto', async () => {
    vi.mocked(voidPayment).mockRejectedValue(
      new ApiError('Datos inválidos', 422, [
        { path: 'motivo', message: 'Máximo 500 caracteres' },
        { path: 'id', message: 'Identificador inválido' },
      ]),
    )
    const { user } = renderDialog()
    await user.type(screen.getByLabelText('Motivo'), 'Duplicado')
    await user.click(screen.getByRole('button', { name: 'Anular pago' }))
    expect(await screen.findByText('Máximo 500 caracteres')).toBeInTheDocument()
    expect(toast.error).toHaveBeenCalledWith('Datos inválidos')
  })
})
