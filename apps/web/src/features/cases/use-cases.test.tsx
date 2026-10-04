import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { CaseAction } from '@dentalware/shared'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api-error'
import { queryKeys } from '@/lib/query-keys'
import type * as ApiModule from './api'
import {
  useAssignTechnician,
  useCase,
  useCaseAction,
  useChangeStage,
  useCreateRemake,
} from './use-cases'

const { postCaseAction, changeStage, assignTechnician, createRemake, fetchCase } = vi.hoisted(
  () => ({
    postCaseAction: vi.fn(),
    fetchCase: vi.fn(),
    changeStage: vi.fn(),
    assignTechnician: vi.fn(),
    createRemake: vi.fn(),
  }),
)
vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof ApiModule>()),
  postCaseAction,
  changeStage,
  assignTechnician,
  createRemake,
  fetchCase,
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

function makeClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
}

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

beforeEach(() => {
  postCaseAction.mockReset()
  changeStage.mockReset()
  assignTechnician.mockReset()
  createRemake.mockReset()
  fetchCase.mockReset()
  vi.mocked(toast.success).mockReset()
  vi.mocked(toast.error).mockReset()
})

/**
 * M-2 (ronda de fixes 1, T12): `queryKeys.summary` vive bajo el prefijo `['trabajos', …]` a
 * propósito, para que `useInvalidateCases` (invalida `['trabajos']`, `exact: false`) también
 * refresque el resumen del panel de inicio sin que `use-summary.ts` invalide aparte — pero
 * nada lo comprobaba: mover la clave a `['resumen']` (prefijo distinto) dejaba los 305 unit
 * en verde igual. Mismo patrón que `use-users.test.tsx` (`setQueryData` + `isInvalidated`).
 */
describe('use-cases: invalidación de queryKeys.summary', () => {
  it('una acción de estado invalida el resumen del panel de inicio', async () => {
    postCaseAction.mockResolvedValue({ id: 'c1', status: 'en_proceso' } as never)
    const client = makeClient()
    client.setQueryData(queryKeys.summary, {
      nuevos: 1,
      en_curso: 0,
      vencen_hoy: 0,
      atrasados: 0,
      en_prueba: 0,
      listos: 0,
      todos: 1,
    })

    const { result } = renderHook(() => useCaseAction('c1'), { wrapper: wrapperFor(client) })
    result.current.mutate({ accion: 'aceptar', motivo: null })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(client.getQueryState(queryKeys.summary)?.isInvalidated).toBe(true)
  })
})

/** UX3-11: «Trabajo actualizado» no decía qué pasó. Tabla literal, no derivada del `Record`
 * que la produce: si alguien cambia un texto o lo deja genérico, este test lo ve. */
describe('use-cases: toast de éxito con el nombre de la acción', () => {
  it.each<[CaseAction, string]>([
    ['aceptar', 'Trabajo aceptado'],
    ['pausar', 'Trabajo en espera'],
    ['reanudar', 'Trabajo reanudado'],
    ['enviar_prueba', 'Enviado a prueba en boca'],
    ['recibir_prueba', 'Prueba recibida: el trabajo vuelve a producción'],
    ['finalizar', 'Trabajo finalizado'],
    ['marcar_enviado', 'Marcado como enviado'],
    ['marcar_entregado', 'Marcado como entregado'],
    ['cancelar', 'Trabajo cancelado'],
  ])('%s → «%s»', async (accion, mensaje) => {
    postCaseAction.mockResolvedValue({ id: 'c1' } as never)
    const { result } = renderHook(() => useCaseAction('c1'), {
      wrapper: wrapperFor(makeClient()),
    })
    result.current.mutate({
      accion,
      motivo: accion === 'pausar' || accion === 'cancelar' ? 'x' : null,
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(toast.success).toHaveBeenCalledExactlyOnceWith(mensaje)
  })

  it('al cambiar de fase nombra la fase nueva', async () => {
    changeStage.mockResolvedValue({
      id: 'c1',
      currentStageId: 's2',
      stage: { id: 's2', name: 'Modelo' },
    } as never)
    const { result } = renderHook(() => useChangeStage('c1'), {
      wrapper: wrapperFor(makeClient()),
    })
    result.current.mutate({ direccion: 'avanzar', motivo: null })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(toast.success).toHaveBeenCalledExactlyOnceWith('Fase: Modelo')
  })
})

/** I-1 (revisión de la Tarea 3): un 409 significa que el trabajo cambió por debajo (otra
 * persona lo movió); la ficha no puede quedarse con el estado viejo y los botones viejos. Se
 * invalida y se **espera** la recarga antes de avisar, una sola vez. Un 500 o un fallo de red no
 * dicen nada del estado del trabajo: refrescar ahí solo repetiría la petición que falla. */
describe('use-cases: un 409 refresca la ficha', () => {
  const detalle = { case: { id: 'c1', status: 'en_proceso' }, missing: [] }
  const conflicto = new ApiError(
    'No se puede "Finalizar": el trabajo está en estado "En espera".',
    409,
  )

  type Disparo = (client: QueryClient) => {
    fail: (e: unknown) => void
    run: () => Promise<unknown>
  }
  const mutaciones: [string, Disparo][] = [
    [
      'acción de estado',
      (client) => {
        const { result } = renderHook(() => useCaseAction('c1'), { wrapper: wrapperFor(client) })
        return {
          fail: (e) => postCaseAction.mockRejectedValue(e),
          run: () => result.current.mutateAsync({ accion: 'finalizar', motivo: null }),
        }
      },
    ],
    [
      'cambio de fase',
      (client) => {
        const { result } = renderHook(() => useChangeStage('c1'), { wrapper: wrapperFor(client) })
        return {
          fail: (e) => changeStage.mockRejectedValue(e),
          run: () => result.current.mutateAsync({ direccion: 'avanzar', motivo: null }),
        }
      },
    ],
    [
      'asignar técnico',
      (client) => {
        const { result } = renderHook(() => useAssignTechnician('c1'), {
          wrapper: wrapperFor(client),
        })
        return {
          fail: (e) => assignTechnician.mockRejectedValue(e),
          run: () => result.current.mutateAsync({ tecnicoId: null }),
        }
      },
    ],
    [
      'repetir',
      (client) => {
        const { result } = renderHook(() => useCreateRemake('c1'), {
          wrapper: wrapperFor(client),
        })
        return {
          fail: (e) => createRemake.mockRejectedValue(e),
          run: () => result.current.mutateAsync({} as never),
        }
      },
    ],
  ]

  it.each(mutaciones)('%s: un 409 invalida el detalle y avisa una vez', async (_n, disparo) => {
    const client = makeClient()
    client.setQueryData(queryKeys.case('c1'), detalle)
    const { fail, run } = disparo(client)
    fail(conflicto)
    await expect(run()).rejects.toBe(conflicto)
    expect(client.getQueryState(queryKeys.case('c1'))?.isInvalidated).toBe(true)
    expect(toast.error).toHaveBeenCalledExactlyOnceWith(conflicto.message)
  })

  it('el aviso sale cuando la ficha ya muestra el estado nuevo, no antes', async () => {
    fetchCase
      .mockResolvedValueOnce({ case: { id: 'c1', status: 'en_proceso' }, missing: [] })
      .mockResolvedValueOnce({ case: { id: 'c1', status: 'en_espera' }, missing: [] })
    postCaseAction.mockRejectedValue(conflicto)
    const client = makeClient()
    const { result } = renderHook(() => ({ ficha: useCase('c1'), accion: useCaseAction('c1') }), {
      wrapper: wrapperFor(client),
    })
    await waitFor(() => expect(result.current.ficha.data?.case.status).toBe('en_proceso'))
    let estadoAlAvisar: string | undefined
    vi.mocked(toast.error).mockImplementation(() => {
      estadoAlAvisar = client.getQueryData<typeof detalle>(queryKeys.case('c1'))?.case.status
      return ''
    })
    await expect(
      result.current.accion.mutateAsync({ accion: 'finalizar', motivo: null }),
    ).rejects.toBe(conflicto)
    expect(estadoAlAvisar).toBe('en_espera')
  })

  it.each([
    ['un 500', new ApiError('Error interno', 500)],
    ['un fallo de red', new TypeError('Failed to fetch')],
  ])('%s no invalida el detalle', async (_n, error) => {
    const client = makeClient()
    client.setQueryData(queryKeys.case('c1'), detalle)
    const { fail, run } = mutaciones[0]![1](client)
    fail(error)
    await expect(run()).rejects.toBe(error)
    expect(client.getQueryState(queryKeys.case('c1'))?.isInvalidated).toBe(false)
    expect(toast.error).toHaveBeenCalledOnce()
  })
})
