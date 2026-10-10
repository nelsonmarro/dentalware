import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api-error'
import { mutationKeys, queryKeys } from '@/lib/query-keys'
import { useApplyCredit } from './use-apply-credit'
import { useRegisterAdjustment } from './use-register-adjustment'
import { useRegisterPayment } from './use-register-payment'
import { useVoidPayment } from './use-void-payment'

const api = vi.hoisted(() => ({
  registerPayment: vi.fn(),
  applyCredit: vi.fn(),
  voidPayment: vi.fn(),
  registerAdjustment: vi.fn(),
}))
vi.mock('./api', () => api)
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

function setup<T>(hook: () => T) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  // Lo que pinta la pantalla: la lista de «Cuentas», la cuenta de la clínica y un trabajo.
  client.setQueryData(queryKeys.accounts.list(false), [])
  client.setQueryData(queryKeys.accounts.clinic('k1'), {})
  client.setQueryData(queryKeys.case('t1'), {})
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  const { result } = renderHook(hook, { wrapper })
  return { client, result }
}

function expectInvalidated(client: QueryClient) {
  expect(client.getQueryState(queryKeys.accounts.list(false))?.isInvalidated).toBe(true)
  expect(client.getQueryState(queryKeys.accounts.clinic('k1'))?.isInvalidated).toBe(true)
  expect(client.getQueryState(queryKeys.case('t1'))?.isInvalidated).toBe(true)
}

const pagoInput = {
  clinicaId: 'k1',
  monto: '100.00',
  metodo: 'transferencia' as const,
  fecha: '2026-10-08',
  referencia: null,
  notas: null,
  asignaciones: [
    { trabajoId: 't1', monto: '50.00' },
    { trabajoId: 't2', monto: '30.00' },
  ],
}

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset())
  vi.mocked(toast.success).mockReset()
  vi.mocked(toast.error).mockReset()
})

describe('useRegisterPayment («Registrar pago», CTA-2)', () => {
  it('invalida cuentas y trabajos y nombra los trabajos que cerró la API y lo que queda a favor', async () => {
    api.registerPayment.mockResolvedValue({
      id: 'p1',
      credit: '20.00',
      settled: [
        { id: 't1', code: '26-00001' },
        { id: 't2', code: '26-00002' },
      ],
    })
    const { client, result } = setup(() => useRegisterPayment('k1'))
    result.current.mutate(pagoInput)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(api.registerPayment).toHaveBeenCalledWith(pagoInput)
    expectInvalidated(client)
    expect(toast.success).toHaveBeenCalledWith(
      'Pago registrado: cobrados 26-00001 y 26-00002 · $ 20.00 a favor',
    )
  })

  // El reparto cubre lo que debían los dos al abrir el diálogo, pero entre medio un recargo
  // dejó a `t2` debiendo: la API solo cerró `t1`, y el aviso no cuenta con el «Por cobrar» viejo.
  it('nombra solo lo que dice la API, aunque el reparto cubriera más', async () => {
    api.registerPayment.mockResolvedValue({
      id: 'p1',
      credit: '20.00',
      settled: [{ id: 't1', code: '26-00001' }],
    })
    const { result } = setup(() => useRegisterPayment('k1'))
    result.current.mutate(pagoInput)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(toast.success).toHaveBeenCalledWith(
      'Pago registrado: cobrado 26-00001 · $ 20.00 a favor',
    )
  })

  it('un pago que no cierra ningún trabajo no nombra ninguno', async () => {
    api.registerPayment.mockResolvedValue({ id: 'p1', credit: '0.00', settled: [] })
    const { result } = setup(() => useRegisterPayment('k1'))
    result.current.mutate({
      ...pagoInput,
      monto: '10.00',
      asignaciones: [{ trabajoId: 't1', monto: '10.00' }],
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(toast.success).toHaveBeenCalledWith('Pago registrado')
  })

  it('lleva la clave de mutación de su clínica', () => {
    const { client } = setup(() => useRegisterPayment('k1'))
    api.registerPayment.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useRegisterPayment('k1'), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    })
    result.current.mutate(pagoInput)
    return waitFor(() =>
      expect(client.isMutating({ mutationKey: mutationKeys.account('k1') })).toBe(1),
    )
  })

  it('un 422 no avisa con un toast: lo pinta el diálogo bajo su campo', async () => {
    api.registerPayment.mockRejectedValue(
      new ApiError('Datos inválidos', 422, [
        { path: 'fecha', message: 'La fecha no puede ser posterior a hoy' },
      ]),
    )
    const { result } = setup(() => useRegisterPayment('k1'))
    result.current.mutate(pagoInput)
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(toast.error).not.toHaveBeenCalled()
  })
})

describe('useApplyCredit («Aplicar saldo a favor», CTA-2)', () => {
  it('invalida y nombra el trabajo que cerró la API', async () => {
    api.applyCredit.mockResolvedValue({
      id: 'p1',
      credit: '0.00',
      settled: [{ id: 't2', code: '26-00002' }],
    })
    const { client, result } = setup(() => useApplyCredit('k1'))
    result.current.mutate({
      paymentId: 'p1',
      input: { asignaciones: [{ trabajoId: 't2', monto: '30' }] },
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(api.applyCredit).toHaveBeenCalledWith('p1', {
      asignaciones: [{ trabajoId: 't2', monto: '30' }],
    })
    expectInvalidated(client)
    expect(toast.success).toHaveBeenCalledWith('Saldo a favor aplicado: cobrado 26-00002')
  })

  // Convención §5: ante un 409 (otra persona anuló el pago) se espera la invalidación y después
  // se avisa, para que la cuenta no siga mostrando el pago vigente.
  it('un 409 refresca la cuenta antes de avisar', async () => {
    api.applyCredit.mockRejectedValue(
      new ApiError('El pago está anulado: no tiene saldo a favor', 409),
    )
    const { client, result } = setup(() => useApplyCredit('k1'))
    let invalidatedWhenToasted = false
    vi.mocked(toast.error).mockImplementation(() => {
      invalidatedWhenToasted =
        client.getQueryState(queryKeys.accounts.clinic('k1'))?.isInvalidated ?? false
      return 1
    })
    result.current.mutate({
      paymentId: 'p1',
      input: { asignaciones: [{ trabajoId: 't2', monto: '30' }] },
    })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(toast.error).toHaveBeenCalledWith('El pago está anulado: no tiene saldo a favor')
    expect(invalidatedWhenToasted).toBe(true)
  })
})

describe('useVoidPayment («Anular pago», CTA-2)', () => {
  it('invalida y avisa «Pago anulado»', async () => {
    api.voidPayment.mockResolvedValue({ id: 'p1' })
    const { client, result } = setup(() => useVoidPayment('k1'))
    result.current.mutate({ paymentId: 'p1', input: { motivo: 'Duplicado' } })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(api.voidPayment).toHaveBeenCalledWith('p1', { motivo: 'Duplicado' })
    expectInvalidated(client)
    expect(toast.success).toHaveBeenCalledWith('Pago anulado')
  })

  it('un 409 (ya estaba anulado) refresca y avisa', async () => {
    api.voidPayment.mockRejectedValue(new ApiError('El pago ya está anulado', 409))
    const { client, result } = setup(() => useVoidPayment('k1'))
    result.current.mutate({ paymentId: 'p1', input: { motivo: 'Duplicado' } })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(toast.error).toHaveBeenCalledWith('El pago ya está anulado')
    expect(client.getQueryState(queryKeys.accounts.clinic('k1'))?.isInvalidated).toBe(true)
  })
})

describe('useRegisterAdjustment («Registrar ajuste», CTA-3)', () => {
  it('invalida y avisa; si devolvió algo al saldo a favor, lo dice', async () => {
    api.registerAdjustment.mockResolvedValue({ id: 'a1', released: '10.00' })
    const { client, result } = setup(() => useRegisterAdjustment('k1'))
    const input = {
      clinicaId: 'k1',
      trabajoId: 't1',
      monto: '-10',
      motivo: 'Acuerdo',
      fecha: '2026-10-08',
    }
    result.current.mutate(input)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(api.registerAdjustment).toHaveBeenCalledWith(input)
    expectInvalidated(client)
    expect(toast.success).toHaveBeenCalledWith(
      'Ajuste registrado: $ 10.00 vuelven al saldo a favor',
    )
  })

  it('sin nada devuelto, solo «Ajuste registrado»', async () => {
    api.registerAdjustment.mockResolvedValue({ id: 'a1', released: '0.00' })
    const { result } = setup(() => useRegisterAdjustment('k1'))
    result.current.mutate({
      clinicaId: 'k1',
      trabajoId: null,
      monto: '150',
      motivo: 'Saldo inicial',
      fecha: '2026-10-08',
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(toast.success).toHaveBeenCalledWith('Ajuste registrado')
  })
})
