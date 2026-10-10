import { QueryClientProvider } from '@tanstack/react-query'
import { screen, within } from '@testing-library/react'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api-error'
import { renderWithProviders } from '@/test/render'
import { applyCredit, type ClinicAccount } from './api'
import { ApplyCreditDialog } from './apply-credit-dialog'

vi.mock('./api', () => ({ applyCredit: vi.fn() }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const K1 = '11111111-1111-4111-8111-111111111111'
const T1 = '22222222-2222-4222-8222-222222222222'
const T2 = '33333333-3333-4333-8333-333333333333'

type OpenCase = ClinicAccount['openCases'][number]
const openCase = (o: Partial<OpenCase>) =>
  ({ charge: '0.00', adjustments: '0.00', allocated: '0.00', days: 10, ...o }) as OpenCase

const OPEN = [
  openCase({
    id: T2,
    code: '26-00002',
    patientRef: 'Luis Mora',
    deliveredAt: '2026-09-20T15:00:00.000Z' as unknown as OpenCase['deliveredAt'],
    outstanding: '30.00',
  }),
  openCase({
    id: T1,
    code: '26-00001',
    patientRef: 'Ana Ruiz',
    deliveredAt: '2026-09-01T15:00:00.000Z' as unknown as OpenCase['deliveredAt'],
    outstanding: '50.00',
  }),
]

const PAYMENT = {
  id: 'p1',
  date: '2026-10-05',
  amount: '-120.00',
  method: 'transferencia' as const,
  remaining: '40.00',
  allocations: [],
}

function renderDialog() {
  const onOpenChange = vi.fn()
  const utils = renderWithProviders(
    <ApplyCreditDialog
      clinic={{ id: K1, name: 'Clínica Sur' }}
      payment={PAYMENT}
      openCases={OPEN}
      open
      onOpenChange={onOpenChange}
    />,
  )
  return { ...utils, onOpenChange }
}

const rowInput = (code: string) => screen.getByRole('textbox', { name: `Monto para ${code}` })

beforeEach(() => {
  vi.mocked(applyCredit).mockReset()
  vi.mocked(toast.success).mockReset()
  vi.mocked(toast.error).mockReset()
})

describe('ApplyCreditDialog («Aplicar saldo a favor» de un pago, CTA-2)', () => {
  it('nombra el pago, la consecuencia y lo que queda a favor, y cierra con «Volver»', () => {
    renderDialog()
    const dialog = screen.getByRole('dialog', { name: 'Aplicar saldo a favor' })
    expect(dialog).toHaveTextContent('$ 120.00 · Transferencia del 05/10/2026 · Clínica Sur')
    expect(dialog).toHaveTextContent(/pasan a «Cobrado»/)
    expect(dialog).toHaveTextContent('Le quedan $ 40.00 a favor')
    expect(within(dialog).getByRole('button', { name: 'Volver' })).toBeInTheDocument()
  })

  it('abre con lo que queda repartido de la entrega más antigua a la más nueva', () => {
    renderDialog()
    expect(rowInput('26-00001')).toHaveValue('40.00')
    expect(rowInput('26-00002')).toHaveValue('')
    expect(screen.getByRole('status')).toHaveTextContent('Aplicado $ 40.00 · Sigue a favor $ 0.00')
  })

  it('aplica el reparto editado y avisa', async () => {
    vi.mocked(applyCredit).mockResolvedValue({
      credit: '10.00',
      settled: [{ id: T2, code: '26-00002' }],
    } as never)
    const { user, onOpenChange } = renderDialog()
    await user.clear(rowInput('26-00001'))
    await user.type(rowInput('26-00002'), '30')
    await user.click(screen.getByRole('button', { name: 'Aplicar saldo a favor' }))

    expect(applyCredit).toHaveBeenCalledWith('p1', {
      asignaciones: [{ trabajoId: T2, monto: '30' }],
    })
    await vi.waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(toast.success).toHaveBeenCalledWith('Saldo a favor aplicado: cobrado 26-00002')
  })

  it('pide al menos un trabajo y no deja pasar de lo que queda a favor', async () => {
    const { user } = renderDialog()
    await user.clear(rowInput('26-00001'))
    await user.click(screen.getByRole('button', { name: 'Aplicar saldo a favor' }))
    expect(await screen.findByText('Asigna un monto a al menos un trabajo')).toBeInTheDocument()

    await user.type(rowInput('26-00001'), '41')
    expect(screen.getByRole('status')).toHaveTextContent('Supera lo disponible en $ 1.00')
    await user.click(screen.getByRole('button', { name: 'Aplicar saldo a favor' }))
    expect(
      await screen.findByText('Lo aplicado no puede superar lo que queda a favor ($ 40.00)'),
    ).toBeInTheDocument()
    expect(applyCredit).not.toHaveBeenCalled()
  })

  it('un 422 de la API se pinta en su fila', async () => {
    vi.mocked(applyCredit).mockRejectedValue(
      new ApiError('Datos inválidos', 422, [
        { path: 'asignaciones.0.trabajoId', message: 'El trabajo ya está cobrado' },
      ]),
    )
    const { user } = renderDialog()
    await user.click(screen.getByRole('button', { name: 'Aplicar saldo a favor' }))
    expect(await screen.findByText('El trabajo ya está cobrado')).toBeInTheDocument()
    expect(rowInput('26-00001')).toHaveAttribute('aria-invalid', 'true')
    expect(toast.error).not.toHaveBeenCalled()
  })

  // I-1 de la revisión final del PR 2: con el diálogo abierto, «Por cobrar» se vuelve a pedir
  // y cambia. Las filas no se mueven: el monto viaja con el trabajo de su fila.
  it('si «Por cobrar» cambia con el diálogo abierto, cada monto va al trabajo rotulado', async () => {
    vi.mocked(applyCredit).mockResolvedValue({ credit: '10.00', settled: [] } as never)
    const utils = renderDialog()
    utils.rerender(
      <QueryClientProvider client={utils.client}>
        <ApplyCreditDialog
          clinic={{ id: K1, name: 'Clínica Sur' }}
          payment={PAYMENT}
          openCases={OPEN.filter((c) => c.id !== T1)}
          open
          onOpenChange={utils.onOpenChange}
        />
      </QueryClientProvider>,
    )
    await utils.user.clear(rowInput('26-00001'))
    await utils.user.type(rowInput('26-00002'), '30')
    await utils.user.click(screen.getByRole('button', { name: 'Aplicar saldo a favor' }))

    await vi.waitFor(() => expect(applyCredit).toHaveBeenCalled())
    expect(applyCredit).toHaveBeenCalledWith('p1', {
      asignaciones: [{ trabajoId: T2, monto: '30' }],
    })
  })

  it('un 409 (el pago ya está anulado) cierra el diálogo', async () => {
    vi.mocked(applyCredit).mockRejectedValue(
      new ApiError('El pago está anulado: no tiene saldo a favor', 409),
    )
    const { user, onOpenChange } = renderDialog()
    await user.click(screen.getByRole('button', { name: 'Aplicar saldo a favor' }))
    await vi.waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(toast.error).toHaveBeenCalledWith('El pago está anulado: no tiene saldo a favor')
  })
})
