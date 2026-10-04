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

// El inicio (`/`), adonde redirige la guarda, pide el estado del servidor y el resumen o la
// lista de trabajos: se mockean sus `api.ts` para que el test no salga a la red.
vi.mock('@/features/health/api', () => ({ fetchHealth: vi.fn().mockResolvedValue({ ok: true }) }))
vi.mock('@/features/cases/api', async (importOriginal) => ({
  ...(await importOriginal<typeof CasesApiModule>()),
  fetchSummary: vi.fn().mockResolvedValue({}),
  fetchCases: vi.fn().mockResolvedValue({ cases: [], total: 0, page: 1, pageSize: 20 }),
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

describe('acceso a «Cuentas» por rol (ACCOUNTS_ROLES)', () => {
  beforeEach(() => {
    vi.mocked(authClient.getSession).mockReset()
  })

  it.each(['tecnico', 'mensajero'])(
    'un %s que entra a /cuentas por URL vuelve al inicio sin ver la pantalla',
    async (role) => {
      vi.mocked(authClient.getSession).mockResolvedValue(withRole(role))
      const router = renderApp('/cuentas')
      await waitFor(() => expect(router.state.location.pathname).toBe('/'))
      expect(await screen.findByRole('heading', { level: 1, name: 'Inicio' })).toBeInTheDocument()
      expect(screen.queryByRole('heading', { level: 1, name: 'Cuentas' })).not.toBeInTheDocument()
    },
  )

  it.each(['admin', 'recepcion'])('%s entra a /cuentas', async (role) => {
    vi.mocked(authClient.getSession).mockResolvedValue(withRole(role))
    const router = renderApp('/cuentas')
    expect(await screen.findByRole('heading', { level: 1, name: 'Cuentas' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/cuentas')
  })
})
