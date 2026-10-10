import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { routeTree } from '@/routeTree.gen'
import { fetchAccountStatement, fetchAccounts, fetchClinicAccount } from '@/features/accounts/api'
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

// «Cuentas» pide la lista, la cuenta de una clínica y su estado de cuenta: se mockea su `api.ts`.
vi.mock('@/features/accounts/api', () => ({
  fetchAccounts: vi.fn(),
  fetchClinicAccount: vi.fn(),
  fetchAccountStatement: vi.fn(),
}))

const zero = { '0_30': '0.00', '31_60': '0.00', '61_90': '0.00', '90_mas': '0.00' }

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
    vi.mocked(fetchAccounts).mockReset()
    vi.mocked(fetchClinicAccount).mockReset()
    vi.mocked(fetchAccounts).mockResolvedValue([
      { id: 'c1', name: 'Clínica Sur', balance: '80.00', aging: zero, oldestDays: 3 },
    ])
    vi.mocked(fetchClinicAccount).mockResolvedValue({
      clinic: { id: 'c1', name: 'Clínica Sur' },
      balance: '80.00',
      credit: '0.00',
      aging: zero,
      oldestDays: 3,
      openCases: [],
      breakdown: {
        openCases: '0.00',
        unlinkedAdjustments: '80.00',
        unlinkedSince: '2026-10-01',
        credit: '0.00',
        balance: '80.00',
      },
      billedCases: [],
      movements: [],
    } as unknown as Awaited<ReturnType<typeof fetchClinicAccount>>)
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

  it.each(['tecnico', 'mensajero'])(
    'un %s que entra a la cuenta de una clínica por URL vuelve al inicio',
    async (role) => {
      vi.mocked(authClient.getSession).mockResolvedValue(withRole(role))
      const router = renderApp('/cuentas/c1')
      await waitFor(() => expect(router.state.location.pathname).toBe('/'))
      expect(await screen.findByRole('heading', { level: 1, name: 'Inicio' })).toBeInTheDocument()
      expect(fetchClinicAccount).not.toHaveBeenCalled()
    },
  )

  // M7 de la revisión final del PR 2: el estado de cuenta (`$clinicaId_`, fuera del layout de la
  // cuenta) sigue colgando de la guarda de `/cuentas`; un renombre no puede sacarlo de ella.
  it.each(['tecnico', 'mensajero'])(
    'un %s que entra al estado de cuenta de una clínica por URL vuelve al inicio',
    async (role) => {
      vi.mocked(authClient.getSession).mockResolvedValue(withRole(role))
      const router = renderApp('/cuentas/c1/estado')
      await waitFor(() => expect(router.state.location.pathname).toBe('/'))
      expect(await screen.findByRole('heading', { level: 1, name: 'Inicio' })).toBeInTheDocument()
      expect(fetchAccountStatement).not.toHaveBeenCalled()
    },
  )

  it.each(['admin', 'recepcion'])('%s entra a /cuentas y ve la lista', async (role) => {
    vi.mocked(authClient.getSession).mockResolvedValue(withRole(role))
    const router = renderApp('/cuentas')
    expect(await screen.findByRole('heading', { level: 1, name: 'Cuentas' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/cuentas')
    expect(await screen.findByRole('link', { name: /Clínica Sur/ })).toBeInTheDocument()
    expect(fetchAccounts).toHaveBeenCalledWith({ todas: false })
  })

  it('«Ver todas las clínicas» vive en la URL (?todas=1)', async () => {
    vi.mocked(authClient.getSession).mockResolvedValue(withRole('recepcion'))
    const router = renderApp('/cuentas?todas=1')
    const toggle = await screen.findByRole('switch', { name: 'Ver todas las clínicas' })
    expect(toggle).toBeChecked()
    expect(fetchAccounts).toHaveBeenCalledWith({ todas: true })

    await userEvent.click(toggle)
    await waitFor(() => expect(router.state.location.search).toEqual({}))
    expect(screen.getByRole('switch', { name: 'Ver todas las clínicas' })).not.toBeChecked()

    await userEvent.click(screen.getByRole('switch', { name: 'Ver todas las clínicas' }))
    await waitFor(() => expect(router.state.location.search).toEqual({ todas: 1 }))
  })

  it('la cuenta de una clínica se titula con su nombre', async () => {
    vi.mocked(authClient.getSession).mockResolvedValue(withRole('admin'))
    renderApp('/cuentas/c1')
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Clínica Sur' }),
    ).toBeInTheDocument()
    expect(fetchClinicAccount).toHaveBeenCalledWith('c1')
  })
})
