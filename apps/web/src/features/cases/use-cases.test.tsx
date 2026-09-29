import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { queryKeys } from '@/lib/query-keys'
import type * as ApiModule from './api'
import { useCaseAction } from './use-cases'

const { postCaseAction } = vi.hoisted(() => ({ postCaseAction: vi.fn() }))
vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof ApiModule>()),
  postCaseAction,
}))

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
