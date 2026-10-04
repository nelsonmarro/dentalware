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
import type { CaseListRow } from './api'
import { MyCases } from './my-cases'

const { fetchCases } = vi.hoisted(() => ({ fetchCases: vi.fn() }))
vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof ApiModule>()),
  fetchCases,
}))

/** `MyCases` fetchea con `useCases` (TanStack Query) y enlaza cada fila con `<Link>`: necesita
 * Router + QueryClient a la vez, igual que `summary-cards.test.tsx`/`case-history.test.tsx`. */
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

function caseRow(overrides: Partial<CaseListRow> = {}): CaseListRow {
  return {
    id: 'c1',
    code: '26-00001',
    boxNumber: null,
    patientRef: 'Juan Pérez',
    status: 'en_proceso',
    priority: 'normal',
    receivedAt: '2026-09-01',
    dueDate: null,
    promisedDate: '2026-09-20',
    total: null,
    clinic: { id: 'clinica-1', name: 'Clínica Uno' },
    doctor: { id: 'doctor-1', name: 'Dr. Gómez' },
    stage: { name: 'Cerámica', color: '#0F766E' },
    technician: { name: 'Ana' },
    itemsSummary: 'Corona ×1',
    ...overrides,
  }
}

describe('MyCases', () => {
  // M-5 (fix wave PR 2, #68): esta fila cubre la versión mínima de INI-2 — código, paciente,
  // fase y fecha de entrega, los cuatro juntos en la misma fila. El orden real de la lista
  // (¿por qué "26-00002" va antes que "26-00001"?) lo decide la API (`orderFor` en repo.ts) y
  // se prueba ahí; el test de abajo ("pide solo los trabajos activos…") ya fija que el
  // componente pide `orden: 'entrega'`, así que un test que solo repitiera el orden del mock
  // no habría probado nada — antes lo hacía y se llamaba "ordenados por fecha comprometida".
  it('cada fila pinta código, paciente, fase y fecha de entrega (INI-2)', async () => {
    fetchCases.mockResolvedValue({
      cases: [
        caseRow({
          patientRef: 'Juan Pérez',
          promisedDate: '2026-09-20',
          stage: { name: 'Cerámica', color: '#0F766E' },
        }),
      ],
      total: null,
    })
    renderWithProviders(<MyCases technicianId="tec-1" />)

    const fila = await screen.findByRole('link', { name: /26-00001/ })
    expect(fila).toHaveTextContent('26-00001')
    expect(fila).toHaveTextContent('Juan Pérez')
    expect(fila).toHaveTextContent('Cerámica')
    // UX3-28: la fecha dice de qué es.
    expect(fila).toHaveTextContent('Entrega 20/09/2026')
  })

  // M-1 (ronda de fixes 1, T12): con `total: null` (como llega realmente para el rol técnico,
  // ya enmascarado por el servicio) esta aserción pasaba aunque el componente pintara el total
  // — nunca ejercitó la omisión. Con un total real en el dato, "80" no debe aparecer en pantalla
  // porque `MyCases` ni siquiera lee `row.total`, no porque el dato venga vacío.
  it('no muestra precios aunque la fila los traiga', async () => {
    fetchCases.mockResolvedValue({
      cases: [caseRow({ total: '80.00' })],
      total: null,
    })
    renderWithProviders(<MyCases technicianId="tec-1" />)

    await screen.findByRole('link', { name: /26-00001/ })
    expect(screen.queryByText(/80/)).not.toBeInTheDocument()
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument()
  })

  it('marca los trabajos vencidos', async () => {
    fetchCases.mockResolvedValue({
      cases: [caseRow({ promisedDate: '2020-01-01' })],
      total: null,
    })
    renderWithProviders(<MyCases technicianId="tec-1" />)

    expect(await screen.findByText('Atrasado')).toBeInTheDocument()
  })

  // I-3 (fix wave PR 2, #68): antes solo el color del borde distinguía en_espera/en_prueba de
  // en_proceso — conventions.md §5 prohíbe depender solo del color. La fila debe mostrar el
  // rótulo del estado con texto además de la fase, cuando el estado no sea en_proceso.
  it('en espera o en prueba, muestra el estado con texto además de la fase (nunca solo color)', async () => {
    fetchCases.mockResolvedValue({
      cases: [caseRow({ status: 'en_espera', stage: { name: 'Cerámica', color: '#89610E' } })],
      total: null,
    })
    renderWithProviders(<MyCases technicianId="tec-1" />)

    const fila = await screen.findByRole('link', { name: /26-00001/ })
    expect(fila).toHaveTextContent('Cerámica')
    expect(fila).toHaveTextContent('En espera')
  })

  it('en proceso con fase, no repite el estado (la fase ya basta)', async () => {
    fetchCases.mockResolvedValue({
      cases: [caseRow({ status: 'en_proceso', stage: { name: 'Cerámica', color: '#0F766E' } })],
      total: null,
    })
    renderWithProviders(<MyCases technicianId="tec-1" />)

    const fila = await screen.findByRole('link', { name: /26-00001/ })
    expect(fila).toHaveTextContent('Cerámica')
    expect(fila).not.toHaveTextContent('En proceso')
  })

  // UX3-02: un fallo de red no debe leerse como "no tienes trabajos asignados" — eso es un
  // dato falso; aquí la petición ni se resolvió.
  it('un fallo de red no muestra el vacío: ofrece reintentar', async () => {
    fetchCases.mockRejectedValue(new TypeError('Failed to fetch'))
    renderWithProviders(<MyCases technicianId="tec-1" />)

    expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    expect(screen.queryByText('No tienes trabajos asignados.')).not.toBeInTheDocument()
  })

  it('sin trabajos asignados muestra un vacío con texto propio', async () => {
    fetchCases.mockResolvedValue({ cases: [], total: null })
    renderWithProviders(<MyCases technicianId="tec-1" />)

    expect(await screen.findByText('No tienes trabajos asignados.')).toBeInTheDocument()
  })

  it('pide solo los trabajos activos del técnico, ordenados por entrega (ruling PR 2, T12)', async () => {
    fetchCases.mockResolvedValue({ cases: [], total: null })
    renderWithProviders(<MyCases technicianId="tec-1" />)

    await screen.findByText('No tienes trabajos asignados.')
    expect(fetchCases).toHaveBeenCalledWith({
      tecnicoId: 'tec-1',
      vista: 'en_curso',
      orden: 'entrega',
    })
  })
})
