import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { CaseAction } from '@dentalware/shared'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { queryKeys } from '@/lib/query-keys'
import type * as ApiModule from './api'
import { useCaseAction, useChangeStage } from './use-cases'

const { postCaseAction, changeStage } = vi.hoisted(() => ({
  postCaseAction: vi.fn(),
  changeStage: vi.fn(),
}))
vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof ApiModule>()),
  postCaseAction,
  changeStage,
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
  vi.mocked(toast.success).mockReset()
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
