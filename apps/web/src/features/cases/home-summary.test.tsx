import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type * as ApiModule from './api'
import { HomeSummary } from './home-summary'

const { fetchSummary, fetchCases } = vi.hoisted(() => ({
  fetchSummary: vi.fn(),
  fetchCases: vi.fn(),
}))
vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof ApiModule>()),
  fetchSummary,
  fetchCases,
}))

function renderWithProviders(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const router = createRouter({
    routeTree: createRootRoute({
      component: () => <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
    }),
    history: createMemoryHistory(),
  })
  return render(<RouterProvider router={router} />)
}

const SUMMARY = {
  nuevos: 1,
  en_curso: 1,
  vencen_hoy: 0,
  atrasados: 0,
  en_prueba: 0,
  listos: 0,
  todos: 1,
}

// M-4 (ronda de fixes 1, T12): `user.role === 'tecnico' && <MyCases …>` (antes en línea en
// `routes/_app/index.tsx`) no tenía test — quitar la condición dejaba los unit en verde y
// recepción hubiera visto "No tienes trabajos asignados." en su propio inicio. Se extrajo a
// `HomeSummary` (feature `cases`, no una ruta: `routes/` no tiene archivo de test en este
// proyecto) para poder probarlo como cualquier otro componente de features.
describe('HomeSummary', () => {
  it.each(['admin', 'recepcion', 'mensajero'] as const)('%s no ve "Mis trabajos"', async (role) => {
    fetchSummary.mockResolvedValue(SUMMARY)
    renderWithProviders(<HomeSummary role={role} technicianId="u-1" />)

    await screen.findByRole('link', { name: /Nuevos 1/ })
    expect(screen.queryByRole('heading', { name: 'Mis trabajos' })).not.toBeInTheDocument()
    expect(fetchCases).not.toHaveBeenCalled()
  })

  it('técnico ve "Mis trabajos"', async () => {
    fetchSummary.mockResolvedValue(SUMMARY)
    fetchCases.mockResolvedValue({ cases: [], total: null })
    renderWithProviders(<HomeSummary role="tecnico" technicianId="tec-1" />)

    expect(await screen.findByRole('heading', { name: 'Mis trabajos' })).toBeInTheDocument()
  })
})
