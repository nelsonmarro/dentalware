import { DELIVERY_NOT_PENDING_MESSAGE } from '@dentalware/shared'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api-error'
import { mutationKeys, queryKeys } from '@/lib/query-keys'
import { usePickUp } from './use-pick-up'

const { pickUpDelivery } = vi.hoisted(() => ({ pickUpDelivery: vi.fn() }))
vi.mock('./api', () => ({ pickUpDelivery }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  const { result } = renderHook(() => usePickUp('d1', 'c1'), { wrapper })
  return { client, result }
}

beforeEach(() => {
  pickUpDelivery.mockReset()
  vi.mocked(toast.success).mockReset()
  vi.mocked(toast.error).mockReset()
})

// #118: «Recogido» del mensajero, un toque sin diálogo.
describe('usePickUp', () => {
  it('marca la recogida, espera el refresco de entregas y ficha, y avisa', async () => {
    pickUpDelivery.mockResolvedValue({ id: 'd1', status: 'hecha' })
    const { client, result } = setup()
    client.setQueryData(queryKeys.deliveries.day('2026-10-05'), [])
    client.setQueryData(queryKeys.case('c1'), { case: { id: 'c1' } })

    await result.current.mutateAsync()

    expect(pickUpDelivery).toHaveBeenCalledWith('d1')
    // `onSuccess` espera la invalidación: al resolver, las dos ya están invalidadas.
    expect(client.getQueryState(queryKeys.deliveries.day('2026-10-05'))?.isInvalidated).toBe(true)
    expect(client.getQueryState(queryKeys.case('c1'))?.isInvalidated).toBe(true)
    expect(toast.success).toHaveBeenCalledWith('Recogida registrada')
  })

  it('cuelga del trabajo, para que useCaseBusy no deje repetirla sin red (M-4)', async () => {
    let resolve: (v: unknown) => void = () => {}
    pickUpDelivery.mockReturnValue(new Promise((r) => (resolve = r)))
    const { client, result } = setup()
    result.current.mutate()
    await waitFor(() => expect(client.isMutating({ mutationKey: mutationKeys.case('c1') })).toBe(1))
    resolve({ id: 'd1' })
  })

  it('un 409 refresca y luego avisa con el mensaje de la API, una sola vez', async () => {
    pickUpDelivery.mockRejectedValue(new ApiError(DELIVERY_NOT_PENDING_MESSAGE, 409))
    const { client, result } = setup()
    const dia = queryKeys.deliveries.day('2026-10-05')
    client.setQueryData(dia, [])
    // Primero refresca y después avisa: al salir el aviso, la lista ya está invalidada.
    let refrescadaAlAvisar: boolean | undefined
    vi.mocked(toast.error).mockImplementation(() => {
      refrescadaAlAvisar = client.getQueryState(dia)?.isInvalidated
      return ''
    })

    await expect(result.current.mutateAsync()).rejects.toThrow()

    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1))
    expect(toast.error).toHaveBeenCalledWith(DELIVERY_NOT_PENDING_MESSAGE)
    expect(refrescadaAlAvisar).toBe(true)
    expect(toast.success).not.toHaveBeenCalled()
  })
})
