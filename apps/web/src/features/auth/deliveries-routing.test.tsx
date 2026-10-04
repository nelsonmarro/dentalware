import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { routeTree } from '@/routeTree.gen'
import type * as CasesApiModule from '@/features/cases/api'
import { authClient } from './auth-client'

vi.mock('./auth-client', () => ({
  authClient: {
    getSession: vi.fn(),
    signIn: { email: vi.fn() },
    signOut: vi.fn(),
  },
}))

// El inicio (`/`), adonde redirige la guarda, y «Entregas» piden datos: se mockean sus
// `api.ts` para que el test no salga a la red.
vi.mock('@/features/health/api', () => ({ fetchHealth: vi.fn().mockResolvedValue({ ok: true }) }))
vi.mock('@/features/cases/api', async (importOriginal) => ({
  ...(await importOriginal<typeof CasesApiModule>()),
  fetchSummary: vi.fn().mockResolvedValue({}),
  fetchCases: vi.fn().mockResolvedValue({ cases: [], total: 0, page: 1, pageSize: 20 }),
}))
vi.mock('@/features/deliveries/api', () => ({
  fetchDeliveries: vi.fn().mockResolvedValue([]),
  fetchCouriers: vi.fn().mockResolvedValue([]),
}))

type GetSessionResult = Awaited<ReturnType<typeof authClient.getSession>>

const withRole = (role: string) =>
  ({
    data: { user: { id: 'u1', name: 'Ana', email: 'ana@labo.test', role } },
    error: null,
  }) as GetSessionResult

function renderApp(initialPath: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createRouter({
    routeTree,
    context: { queryClient },
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  })
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

// I-1 (revisión de la Tarea 7): `GET /api/entregas` es de DELIVERY_ROLES (admin, recepción y
// mensajero); un técnico que entra por URL vuelve al inicio en vez de ver un error que
// «Reintentar» nunca arregla.
describe('acceso a «Entregas» por rol (DELIVERY_ROLES)', () => {
  beforeEach(() => {
    vi.mocked(authClient.getSession).mockReset()
  })

  it('un técnico que entra a /entregas por URL vuelve al inicio sin ver la pantalla', async () => {
    vi.mocked(authClient.getSession).mockResolvedValue(withRole('tecnico'))
    const router = renderApp('/entregas')
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
    expect(await screen.findByRole('heading', { level: 1, name: 'Inicio' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 1, name: 'Entregas' })).not.toBeInTheDocument()
  })

  it.each(['mensajero', 'admin', 'recepcion'])('%s entra a /entregas', async (role) => {
    vi.mocked(authClient.getSession).mockResolvedValue(withRole(role))
    const router = renderApp('/entregas')
    expect(await screen.findByRole('heading', { level: 1, name: 'Entregas' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/entregas')
  })
})
