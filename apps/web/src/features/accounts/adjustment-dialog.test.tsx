import { screen, within } from '@testing-library/react'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api-error'
import { renderWithProviders } from '@/test/render'
import { AdjustmentDialog } from './adjustment-dialog'
import { registerAdjustment } from './api'

vi.mock('./api', () => ({ registerAdjustment: vi.fn() }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const K1 = '11111111-1111-4111-8111-111111111111'
const T1 = '22222222-2222-4222-8222-222222222222'
const T2 = '33333333-3333-4333-8333-333333333333'

const CASES = [
  { id: T1, code: '26-00001', outstanding: '50.00', allocated: '30.00' },
  { id: T2, code: '26-00002', outstanding: null, allocated: null },
]

function renderDialog() {
  const onOpenChange = vi.fn()
  const utils = renderWithProviders(
    <AdjustmentDialog
      clinic={{ id: K1, name: 'Clínica Sur' }}
      cases={CASES}
      open
      onOpenChange={onOpenChange}
    />,
  )
  return { ...utils, onOpenChange }
}

const signButton = (name: string) => screen.getByRole('button', { name })

beforeEach(() => {
  vi.mocked(registerAdjustment).mockReset()
  vi.mocked(toast.success).mockReset()
  vi.mocked(toast.error).mockReset()
})

describe('AdjustmentDialog («Registrar ajuste», CTA-3)', () => {
  it('nombra la clínica y lo que hace un ajuste, y cierra con «Volver»', () => {
    renderDialog()
    const dialog = screen.getByRole('dialog', { name: 'Registrar ajuste' })
    expect(dialog).toHaveTextContent('Clínica Sur')
    expect(dialog).toHaveTextContent(/descuento baja lo que debe la clínica/)
    expect(within(dialog).getByRole('button', { name: 'Volver' })).toBeInTheDocument()
  })

  it('pide elegir el tipo, el monto y el motivo', async () => {
    const { user } = renderDialog()
    await user.click(screen.getByRole('button', { name: 'Registrar ajuste' }))
    expect(await screen.findByText('Elige si es un descuento o un recargo')).toBeInTheDocument()
    expect(screen.getByText('Escribe el motivo')).toBeInTheDocument()
    expect(registerAdjustment).not.toHaveBeenCalled()
  })

  it('un descuento ligado a un trabajo sale negativo, con su trabajo', async () => {
    vi.mocked(registerAdjustment).mockResolvedValue({ released: '0.00' } as never)
    const { user, onOpenChange } = renderDialog()
    await user.click(signButton('Descuento o nota de crédito'))
    expect(signButton('Descuento o nota de crédito')).toHaveAttribute('aria-pressed', 'true')
    expect(signButton('Recargo')).toHaveAttribute('aria-pressed', 'false')
    await user.type(screen.getByLabelText('Monto'), '10,5')
    await user.type(screen.getByLabelText('Motivo'), 'Acuerdo de precio')
    await user.click(screen.getByRole('combobox', { name: 'Trabajo' }))
    await user.click(await screen.findByRole('option', { name: /26-00001/ }))
    await user.click(screen.getByRole('button', { name: 'Registrar ajuste' }))

    expect(registerAdjustment).toHaveBeenCalledWith({
      clinicaId: K1,
      trabajoId: T1,
      monto: '-10.5',
      motivo: 'Acuerdo de precio',
      fecha: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) as string,
    })
    await vi.waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(toast.success).toHaveBeenCalledWith('Ajuste registrado')
  })

  // UX5-15: antes de confirmar, el descuento que deja pagado de más un trabajo dice que ese
  // dinero vuelve al saldo a favor (antes solo lo decía el toast).
  describe('aviso del descuento que vuelve al saldo a favor', () => {
    async function choose(
      user: ReturnType<typeof renderDialog>['user'],
      sign: string,
      code: string,
    ) {
      await user.click(signButton(sign))
      await user.click(screen.getByRole('combobox', { name: 'Trabajo' }))
      await user.click(await screen.findByRole('option', { name: new RegExp(code) }))
    }
    const COBRADO = 'Este trabajo ya está cobrado: lo que le descuentes vuelve al saldo a favor.'

    it('un descuento sobre un trabajo cobrado lo avisa', async () => {
      const { user } = renderDialog()
      await choose(user, 'Descuento o nota de crédito', '26-00002')
      expect(screen.getByText(COBRADO)).toBeInTheDocument()
    })

    it('un recargo sobre un trabajo cobrado no avisa nada', async () => {
      const { user } = renderDialog()
      await choose(user, 'Recargo', '26-00002')
      expect(screen.queryByText(COBRADO)).toBeNull()
      expect(screen.queryByText(/vuelve.? al saldo a favor/)).toBeNull()
    })

    it('un descuento mayor que lo que debe dice cuánto de lo pagado vuelve', async () => {
      const { user } = renderDialog()
      await choose(user, 'Descuento o nota de crédito', '26-00001')
      await user.type(screen.getByLabelText('Monto'), '70')
      expect(
        screen.getByText('$ 20.00 de lo ya pagado por este trabajo vuelven al saldo a favor.'),
      ).toBeInTheDocument()
    })

    it('un descuento que no pasa de lo que debe, o sin trabajo, no avisa nada', async () => {
      const { user } = renderDialog()
      await choose(user, 'Descuento o nota de crédito', '26-00001')
      await user.type(screen.getByLabelText('Monto'), '50')
      expect(screen.queryByText(/vuelve.? al saldo a favor/)).toBeNull()
      await user.click(screen.getByRole('combobox', { name: 'Trabajo' }))
      await user.click(await screen.findByRole('option', { name: /Sin trabajo/ }))
      await user.clear(screen.getByLabelText('Monto'))
      await user.type(screen.getByLabelText('Monto'), '500')
      expect(screen.queryByText(/vuelve.? al saldo a favor/)).toBeNull()
    })
  })

  it('«Saldo inicial» rellena el motivo y lo deja como recargo sin trabajo', async () => {
    vi.mocked(registerAdjustment).mockResolvedValue({ released: '0.00' } as never)
    const { user } = renderDialog()
    await user.click(screen.getByRole('button', { name: 'Saldo inicial' }))
    expect(screen.getByLabelText('Motivo')).toHaveValue('Saldo inicial')
    expect(signButton('Recargo')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('combobox', { name: 'Trabajo' })).toHaveTextContent(
      'Sin trabajo: solo la clínica',
    )
    await user.type(screen.getByLabelText('Monto'), '1500')
    await user.click(screen.getByRole('button', { name: 'Registrar ajuste' }))
    expect(registerAdjustment).toHaveBeenCalledWith(
      expect.objectContaining({ trabajoId: null, monto: '1500', motivo: 'Saldo inicial' }),
    )
  })

  it('los 422 de la API se pintan bajo su campo', async () => {
    vi.mocked(registerAdjustment).mockRejectedValue(
      new ApiError('Datos inválidos', 422, [
        {
          path: 'monto',
          message: 'El descuento supera lo que vale el trabajo; regístralo sin trabajo',
        },
        { path: 'fecha', message: 'La fecha no puede ser posterior a hoy' },
      ]),
    )
    const { user, onOpenChange } = renderDialog()
    await user.click(signButton('Descuento o nota de crédito'))
    await user.type(screen.getByLabelText('Monto'), '999')
    await user.type(screen.getByLabelText('Motivo'), 'Acuerdo')
    await user.click(screen.getByRole('button', { name: 'Registrar ajuste' }))

    expect(
      await screen.findByText('El descuento supera lo que vale el trabajo; regístralo sin trabajo'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Monto')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('La fecha no puede ser posterior a hoy')).toBeInTheDocument()
    expect(screen.getByLabelText('Fecha')).toHaveAttribute('aria-invalid', 'true')
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
    expect(toast.error).not.toHaveBeenCalled()
  })
})
