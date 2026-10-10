import { QueryClientProvider } from '@tanstack/react-query'
import { screen, within } from '@testing-library/react'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api-error'
import { renderWithProviders } from '@/test/render'
import { registerPayment, type ClinicAccount } from './api'
import { PaymentDialog } from './payment-dialog'

vi.mock('./api', () => ({ registerPayment: vi.fn() }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const K1 = '11111111-1111-4111-8111-111111111111'
const T1 = '22222222-2222-4222-8222-222222222222'
const T2 = '33333333-3333-4333-8333-333333333333'

type OpenCase = ClinicAccount['openCases'][number]
const openCase = (o: Partial<OpenCase>) =>
  ({
    charge: '0.00',
    adjustments: '0.00',
    allocated: '0.00',
    patientRef: 'Paciente',
    days: 10,
    ...o,
  }) as OpenCase

// El más nuevo primero, para comprobar que el reparto va del más antiguo al más nuevo.
const OPEN = [
  openCase({
    id: T2,
    code: '26-00002',
    patientRef: 'Luis Mora',
    deliveredAt: '2026-09-20T15:00:00.000Z' as unknown as OpenCase['deliveredAt'],
    outstanding: '30.00',
    days: 18,
  }),
  openCase({
    id: T1,
    code: '26-00001',
    patientRef: 'Ana Ruiz',
    deliveredAt: '2026-09-01T15:00:00.000Z' as unknown as OpenCase['deliveredAt'],
    outstanding: '50.00',
    days: 37,
  }),
]

function renderDialog(openCases = OPEN) {
  const onOpenChange = vi.fn()
  const utils = renderWithProviders(
    <PaymentDialog
      clinic={{ id: K1, name: 'Clínica Sur' }}
      openCases={openCases}
      open
      onOpenChange={onOpenChange}
    />,
  )
  return { ...utils, onOpenChange }
}

const rowInput = (code: string) => screen.getByRole('textbox', { name: `Monto para ${code}` })

async function chooseMethod(user: ReturnType<typeof renderDialog>['user'], name: string) {
  await user.click(screen.getByRole('combobox', { name: 'Método' }))
  await user.click(await screen.findByRole('option', { name }))
}

beforeEach(() => {
  vi.mocked(registerPayment).mockReset()
  vi.mocked(toast.success).mockReset()
  vi.mocked(toast.error).mockReset()
})

describe('PaymentDialog («Registrar pago», CTA-2)', () => {
  it('nombra la clínica, la consecuencia y cierra con «Volver»', () => {
    renderDialog()
    const dialog = screen.getByRole('dialog', { name: 'Registrar pago' })
    expect(dialog).toHaveTextContent('Clínica Sur')
    expect(dialog).toHaveTextContent(/pasan a «Cobrado»/)
    expect(within(dialog).getByRole('button', { name: 'Volver' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Registrar pago' })).toBeInTheDocument()
  })

  it('al escribir el monto reparte de la entrega más antigua a la más nueva y dice lo que queda', async () => {
    const { user } = renderDialog()
    // Los trabajos van en el orden del reparto: primero el más antiguo.
    const rows = screen.getAllByRole('textbox', { name: /^Monto para/ })
    expect(rows.map((r) => r.getAttribute('aria-label'))).toEqual([
      'Monto para 26-00001',
      'Monto para 26-00002',
    ])
    expect(rows[0]).toHaveAttribute('inputmode', 'decimal')

    await user.type(screen.getByLabelText('Monto'), '60')
    expect(rowInput('26-00001')).toHaveValue('50.00')
    expect(rowInput('26-00002')).toHaveValue('10.00')
    expect(screen.getByRole('status')).toHaveTextContent('Asignado $ 60.00 · Queda a favor $ 0.00')

    await user.clear(screen.getByLabelText('Monto'))
    await user.type(screen.getByLabelText('Monto'), '100')
    expect(rowInput('26-00002')).toHaveValue('30.00')
    expect(screen.getByRole('status')).toHaveTextContent('Asignado $ 80.00 · Queda a favor $ 20.00')
  })

  it('cada monto se edita y el pago viaja sin las filas vacías', async () => {
    vi.mocked(registerPayment).mockResolvedValue({
      credit: '70.00',
      settled: [{ id: T2, code: '26-00002' }],
    } as never)
    const { user, onOpenChange } = renderDialog()
    await user.type(screen.getByLabelText('Monto'), '100')
    await user.clear(rowInput('26-00001'))
    await user.clear(rowInput('26-00002'))
    await user.type(rowInput('26-00002'), '30')
    expect(screen.getByRole('status')).toHaveTextContent('Asignado $ 30.00 · Queda a favor $ 70.00')
    await chooseMethod(user, 'Transferencia')
    await user.type(screen.getByLabelText('Referencia'), 'TRX-9')
    await user.click(screen.getByRole('button', { name: 'Registrar pago' }))

    expect(registerPayment).toHaveBeenCalledWith({
      clinicaId: K1,
      monto: '100',
      metodo: 'transferencia',
      fecha: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) as string,
      referencia: 'TRX-9',
      notas: null,
      asignaciones: [{ trabajoId: T2, monto: '30' }],
    })
    await vi.waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(toast.success).toHaveBeenCalledWith(
      'Pago registrado: cobrado 26-00002 · $ 70.00 a favor',
    )
  })

  it('valida en el formulario: método, y lo asignado contra el monto', async () => {
    const { user } = renderDialog()
    await user.type(screen.getByLabelText('Monto'), '10')
    await user.clear(rowInput('26-00001'))
    await user.type(rowInput('26-00001'), '20')
    expect(screen.getByRole('status')).toHaveTextContent(
      'Asignado $ 20.00 · Supera el pago en $ 10.00',
    )
    await user.click(screen.getByRole('button', { name: 'Registrar pago' }))

    expect(await screen.findByText('Elige un método de pago')).toBeInTheDocument()
    expect(screen.getByText('Lo asignado no puede superar el monto del pago')).toBeInTheDocument()
    expect(registerPayment).not.toHaveBeenCalled()
  })

  it('un 422 de la API se pinta bajo su campo, también en la fila del reparto', async () => {
    vi.mocked(registerPayment).mockRejectedValue(
      new ApiError('Datos inválidos', 422, [
        { path: 'fecha', message: 'La fecha no puede ser posterior a hoy' },
        // Viajó solo la fila del 26-00002 (asignación 0): el error va en esa fila.
        { path: 'asignaciones.0.monto', message: 'Supera lo pendiente del trabajo (25.00)' },
      ]),
    )
    const { user, onOpenChange } = renderDialog()
    await user.type(screen.getByLabelText('Monto'), '30')
    await user.clear(rowInput('26-00001'))
    await user.type(rowInput('26-00002'), '30')
    await chooseMethod(user, 'Efectivo')
    await user.click(screen.getByRole('button', { name: 'Registrar pago' }))

    expect(await screen.findByText('La fecha no puede ser posterior a hoy')).toBeInTheDocument()
    expect(screen.getByLabelText('Fecha')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('Supera lo pendiente del trabajo (25.00)')).toBeInTheDocument()
    expect(rowInput('26-00002')).toHaveAttribute('aria-invalid', 'true')
    expect(rowInput('26-00001')).toHaveAttribute('aria-invalid', 'false')
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('un 422 sin campo en el formulario avisa con un toast', async () => {
    vi.mocked(registerPayment).mockRejectedValue(
      new ApiError('Datos inválidos', 422, [
        { path: 'clinicaId', message: 'La clínica no existe' },
      ]),
    )
    const { user } = renderDialog()
    await user.type(screen.getByLabelText('Monto'), '10')
    await chooseMethod(user, 'Efectivo')
    await user.click(screen.getByRole('button', { name: 'Registrar pago' }))
    await vi.waitFor(() => expect(toast.error).toHaveBeenCalledWith('Datos inválidos'))
  })

  // Convención §5: ante un 409 el hook refresca y avisa; el diálogo no sigue abierto sobre la
  // cuenta vieja.
  it('un 409 cierra el diálogo', async () => {
    vi.mocked(registerPayment).mockRejectedValue(
      new ApiError('La cuenta cambió mientras se registraba el ajuste: vuelve a intentarlo', 409),
    )
    const { user, onOpenChange } = renderDialog()
    await user.type(screen.getByLabelText('Monto'), '10')
    await chooseMethod(user, 'Efectivo')
    await user.click(screen.getByRole('button', { name: 'Registrar pago' }))
    await vi.waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
  })

  // I-1 de la revisión final del PR 2: «Por cobrar» se vuelve a pedir con el diálogo abierto
  // (foco en la ventana, otra recepcionista cobra un trabajo). Las filas no se mueven: cada monto
  // viaja con el trabajo de la fila donde se escribió.
  describe('si «Por cobrar» cambia con el diálogo abierto', () => {
    const NEW = '44444444-4444-4444-8444-444444444444'
    function rerenderWith(
      utils: ReturnType<typeof renderDialog>,
      openCases: OpenCase[],
      open = true,
    ) {
      utils.rerender(
        <QueryClientProvider client={utils.client}>
          <PaymentDialog
            clinic={{ id: K1, name: 'Clínica Sur' }}
            openCases={openCases}
            open={open}
            onOpenChange={utils.onOpenChange}
          />
        </QueryClientProvider>,
      )
    }

    it('un trabajo que desaparece no corre las filas: el monto va al trabajo rotulado', async () => {
      vi.mocked(registerPayment).mockResolvedValue({ credit: '0.00', settled: [] } as never)
      const utils = renderDialog()
      // Otra persona cobró el 26-00001: ya no está por cobrar.
      rerenderWith(
        utils,
        OPEN.filter((c) => c.id !== T1),
      )
      await utils.user.type(screen.getByLabelText('Monto'), '20')
      await utils.user.clear(rowInput('26-00001'))
      await utils.user.clear(rowInput('26-00002'))
      await utils.user.type(rowInput('26-00002'), '20')
      await chooseMethod(utils.user, 'Efectivo')
      await utils.user.click(screen.getByRole('button', { name: 'Registrar pago' }))

      await vi.waitFor(() => expect(registerPayment).toHaveBeenCalled())
      expect(vi.mocked(registerPayment).mock.calls[0]?.[0].asignaciones).toEqual([
        { trabajoId: T2, monto: '20' },
      ])
    })

    it('al volver a abrirlo, el reparto trae los trabajos «Por cobrar» de ese momento', () => {
      const utils = renderDialog()
      const remaining = OPEN.filter((c) => c.id !== T1)
      rerenderWith(utils, remaining, false)
      rerenderWith(utils, remaining, true)
      expect(screen.queryByRole('textbox', { name: 'Monto para 26-00001' })).not.toBeInTheDocument()
      expect(rowInput('26-00002')).toBeInTheDocument()
    })

    it('un trabajo que aparece no deja una fila sin trabajo ni el botón muerto', async () => {
      vi.mocked(registerPayment).mockResolvedValue({ credit: '0.00', settled: [] } as never)
      const utils = renderDialog()
      rerenderWith(utils, [
        ...OPEN,
        openCase({
          id: NEW,
          code: '26-00003',
          deliveredAt: '2026-08-01T15:00:00.000Z' as unknown as OpenCase['deliveredAt'],
          outstanding: '15.00',
        }),
      ])
      await utils.user.type(screen.getByLabelText('Monto'), '60')
      await chooseMethod(utils.user, 'Efectivo')
      await utils.user.click(screen.getByRole('button', { name: 'Registrar pago' }))

      await vi.waitFor(() => expect(registerPayment).toHaveBeenCalled())
      expect(vi.mocked(registerPayment).mock.calls[0]?.[0].asignaciones).toEqual([
        { trabajoId: T1, monto: '50.00' },
        { trabajoId: T2, monto: '10.00' },
      ])
    })
  })

  it('sin trabajos por cobrar, dice que todo el pago queda a favor', () => {
    renderDialog([])
    expect(
      screen.getByText('No hay trabajos por cobrar: todo el pago queda a favor.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: /^Monto para/ })).not.toBeInTheDocument()
  })
})
