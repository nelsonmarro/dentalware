import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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
const { fetchDeliveries } = vi.hoisted(() => ({ fetchDeliveries: vi.fn() }))
vi.mock('@/features/deliveries/api', () => ({ fetchDeliveries }))

beforeEach(() => {
  fetchSummary.mockReset()
  fetchCases.mockReset()
  fetchDeliveries.mockReset()
})

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
  it.each(['admin', 'recepcion'] as const)('%s no ve "Mis trabajos"', async (role) => {
    fetchSummary.mockResolvedValue(SUMMARY)
    renderWithProviders(<HomeSummary role={role} userId="u-1" />)

    await screen.findByRole('link', { name: /Nuevos 1/ })
    expect(screen.queryByRole('heading', { name: 'Mis trabajos' })).not.toBeInTheDocument()
    expect(fetchCases).not.toHaveBeenCalled()
  })

  it.each(['admin', 'recepcion', 'tecnico'] as const)(
    '%s no ve «Entregas de hoy»',
    async (role) => {
      fetchSummary.mockResolvedValue(SUMMARY)
      fetchCases.mockResolvedValue({ cases: [], total: null })
      renderWithProviders(<HomeSummary role={role} userId="u-1" />)

      await screen.findByRole('link', { name: /Nuevos 1/ })
      expect(screen.queryByRole('heading', { name: 'Entregas de hoy' })).not.toBeInTheDocument()
      expect(fetchDeliveries).not.toHaveBeenCalled()
    },
  )

  // INI-3 (#105): el mensajero abre su inicio con su ruta de hoy, en lugar de los contadores
  // del laboratorio (que no le dicen qué hacer).
  it('el mensajero ve «Entregas de hoy» y no los contadores', async () => {
    fetchSummary.mockResolvedValue(SUMMARY)
    fetchDeliveries.mockResolvedValue([])
    renderWithProviders(<HomeSummary role="mensajero" userId="m-1" />)

    expect(await screen.findByRole('heading', { name: 'Entregas de hoy' })).toBeInTheDocument()
    expect(await screen.findByText('No tienes entregas hoy')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Nuevos/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Mis trabajos' })).not.toBeInTheDocument()
    expect(fetchSummary).not.toHaveBeenCalled()
  })

  it('técnico ve "Mis trabajos"', async () => {
    fetchSummary.mockResolvedValue(SUMMARY)
    fetchCases.mockResolvedValue({ cases: [], total: null })
    renderWithProviders(<HomeSummary role="tecnico" userId="tec-1" />)

    expect(await screen.findByRole('heading', { name: 'Mis trabajos' })).toBeInTheDocument()
  })

  // UX3-28: a 390 px, las seis tarjetas del laboratorio empujaban «Mis trabajos» bajo el
  // pliegue; el técnico abre su inicio con lo suyo.
  it('técnico ve "Mis trabajos" antes que los contadores del laboratorio', async () => {
    fetchSummary.mockResolvedValue(SUMMARY)
    fetchCases.mockResolvedValue({ cases: [], total: null })
    renderWithProviders(<HomeSummary role="tecnico" userId="tec-1" />)

    const mine = await screen.findByRole('heading', { name: 'Mis trabajos' })
    const counter = await screen.findByRole('link', { name: /Nuevos 1/ })
    expect(mine.compareDocumentPosition(counter) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
