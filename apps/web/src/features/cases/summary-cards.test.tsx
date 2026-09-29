import type { CaseSummary } from '@dentalware/shared'
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
import { SummaryCards } from './summary-cards'

const { fetchSummary } = vi.hoisted(() => ({ fetchSummary: vi.fn() }))
vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof ApiModule>()),
  fetchSummary,
}))

/** `SummaryCards` fetchea su propio resumen (`useSummary`) y usa `<Link>` para cada tarjeta:
 * necesita Router + QueryClient a la vez, igual que `case-history.test.tsx`. */
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

const SUMMARY: CaseSummary = {
  nuevos: 3,
  en_curso: 5,
  vencen_hoy: 1,
  atrasados: 0,
  en_prueba: 2,
  listos: 4,
  todos: 20,
}

describe('SummaryCards', () => {
  it('muestra un contador por vista y enlaza a su lista', async () => {
    fetchSummary.mockResolvedValue(SUMMARY)
    renderWithProviders(<SummaryCards />)

    const nuevos = await screen.findByRole('link', { name: /Nuevos 3/ })
    expect(nuevos).toHaveAttribute('href', expect.stringContaining('vista=nuevos'))
  })

  it('un contador en cero se ve, no se esconde', async () => {
    fetchSummary.mockResolvedValue(SUMMARY)
    renderWithProviders(<SummaryCards />)

    expect(await screen.findByRole('link', { name: /Atrasados 0/ })).toBeInTheDocument()
  })

  it('no arma una tarjeta para "todos" (ruling PR 2, T12: no es un conteo del día)', async () => {
    fetchSummary.mockResolvedValue(SUMMARY)
    renderWithProviders(<SummaryCards />)

    await screen.findByRole('link', { name: /Nuevos 3/ })
    expect(screen.queryByRole('link', { name: /^Todos/ })).not.toBeInTheDocument()
  })

  // M-6 (ronda de fixes 1, T12): el `aria-label` de "En curso" dejaba fuera la leyenda visual
  // "Incluye en prueba" — justo la aclaración del doble conteo (ruling PR 2, T12, punto 4).
  it('el nombre accesible de "En curso" incluye la aclaración de "en prueba"', async () => {
    fetchSummary.mockResolvedValue(SUMMARY)
    renderWithProviders(<SummaryCards />)

    expect(
      await screen.findByRole('link', { name: /En curso 5.*incluye en prueba/i }),
    ).toBeInTheDocument()
  })
})
