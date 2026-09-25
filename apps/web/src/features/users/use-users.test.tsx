import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { queryKeys } from '@/lib/query-keys'
import { createUser, setUserBanned, updateUser } from './api'
import { useCreateUser, useSetUserBanned, useUpdateUser } from './use-users'

vi.mock('./api', () => ({
  createUser: vi.fn(),
  updateUser: vi.fn(),
  setUserBanned: vi.fn(),
  fetchUsers: vi.fn(),
}))

/**
 * `queryKeys.caseTechnicians` vive bajo el prefijo `['users', …]` (M-7, ola de fixes del PR 1,
 * lote B): una alta, edición o baja de usuario debe refrescar el `<select>` de
 * `TechnicianSelect` (`useTechnicians`, `apps/web/src/features/cases/technician-select.tsx`)
 * sin que `use-users.ts` tenga que invalidarlo a mano — la coincidencia de prefijo por
 * defecto de TanStack Query (`invalidateQueries({ queryKey: ['users'] })`, `exact: false`) ya
 * alcanza `['users', 'tecnicos']`. Se comprueba marcando la consulta como cargada
 * (`setQueryData`) antes de mutar, y verificando que queda invalidada después.
 */
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
  vi.mocked(createUser).mockReset()
  vi.mocked(updateUser).mockReset()
  vi.mocked(setUserBanned).mockReset()
})

describe('use-users: invalidación de queryKeys.caseTechnicians', () => {
  it('dar de baja a un usuario invalida la lista de técnicos del selector', async () => {
    vi.mocked(setUserBanned).mockResolvedValue({ id: 'u1', banned: true } as never)
    const client = makeClient()
    client.setQueryData(queryKeys.caseTechnicians, [{ id: 't1', name: 'Ana Técnica' }])

    const { result } = renderHook(() => useSetUserBanned(), { wrapper: wrapperFor(client) })
    result.current.mutate({ id: 'u1', banned: true })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(client.getQueryState(queryKeys.caseTechnicians)?.isInvalidated).toBe(true)
  })

  it('crear un usuario invalida la lista de técnicos del selector', async () => {
    vi.mocked(createUser).mockResolvedValue({ id: 'u1' } as never)
    const client = makeClient()
    client.setQueryData(queryKeys.caseTechnicians, [{ id: 't1', name: 'Ana Técnica' }])

    const { result } = renderHook(() => useCreateUser(), { wrapper: wrapperFor(client) })
    result.current.mutate({
      name: 'Nuevo',
      email: 'nuevo@labo.test',
      password: 'Nuevo12345',
      role: 'tecnico',
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(client.getQueryState(queryKeys.caseTechnicians)?.isInvalidated).toBe(true)
  })

  it('editar un usuario invalida la lista de técnicos del selector', async () => {
    vi.mocked(updateUser).mockResolvedValue({ id: 'u1' } as never)
    const client = makeClient()
    client.setQueryData(queryKeys.caseTechnicians, [{ id: 't1', name: 'Ana Técnica' }])

    const { result } = renderHook(() => useUpdateUser(), { wrapper: wrapperFor(client) })
    result.current.mutate({ id: 'u1', input: { name: 'Ana Editada' } })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(client.getQueryState(queryKeys.caseTechnicians)?.isInvalidated).toBe(true)
  })
})
