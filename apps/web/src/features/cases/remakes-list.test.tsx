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
import { RemakesList } from './remakes-list'

const { fetchRemakes } = vi.hoisted(() => ({ fetchRemakes: vi.fn() }))
vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof ApiModule>()),
  fetchRemakes,
}))

/** `RemakesList` fetchea su propia lista (`useCaseRemakes`) y usa `<Link>` por hijo: necesita
 * Router + QueryClient a la vez, igual que `summary-cards.test.tsx`. */
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

describe('RemakesList', () => {
  it('sin repeticiones, no se monta ningún bloque', async () => {
    fetchRemakes.mockResolvedValue([])
    renderWithProviders(<RemakesList caseId="1" />)

    await vi.waitFor(() => expect(fetchRemakes).toHaveBeenCalled())
    expect(screen.queryByText('Repeticiones')).not.toBeInTheDocument()
  })

  it('lista cada hijo con su código enlazado, estado, fecha y motivo', async () => {
    fetchRemakes.mockResolvedValue([
      {
        id: 'hijo-2',
        code: '26-00002',
        status: 'nuevo',
        receivedAt: '2026-09-20',
        remakeReason: 'Color equivocado',
      },
    ])
    renderWithProviders(<RemakesList caseId="1" />)

    expect(await screen.findByText('Repeticiones')).toBeInTheDocument()
    const link = screen.getByRole('link', { name: '26-00002' })
    expect(link).toHaveAttribute('href', expect.stringContaining('hijo-2'))
    expect(screen.getByText('Nuevo')).toBeInTheDocument()
    expect(screen.getByText('20/09/2026')).toBeInTheDocument()
    expect(screen.getByText('Color equivocado')).toBeInTheDocument()
  })

  it('el código enlazado mide 44 px de alto (objetivo táctil)', async () => {
    fetchRemakes.mockResolvedValue([
      {
        id: 'hijo-2',
        code: '26-00002',
        status: 'nuevo',
        receivedAt: '2026-09-20',
        remakeReason: null,
      },
    ])
    renderWithProviders(<RemakesList caseId="1" />)

    expect(await screen.findByRole('link', { name: '26-00002' })).toHaveClass('min-h-11')
  })

  it('lista varios hijos, cada uno con su propio enlace', async () => {
    fetchRemakes.mockResolvedValue([
      {
        id: 'hijo-2',
        code: '26-00002',
        status: 'nuevo',
        receivedAt: '2026-09-20',
        remakeReason: null,
      },
      {
        id: 'hijo-1',
        code: '26-00001',
        status: 'terminado',
        receivedAt: '2026-09-18',
        remakeReason: 'Fractura',
      },
    ])
    renderWithProviders(<RemakesList caseId="1" />)

    expect(await screen.findByRole('link', { name: '26-00002' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '26-00001' })).toBeInTheDocument()
  })

  it('un fallo de red ofrece reintentar', async () => {
    fetchRemakes.mockRejectedValue(new TypeError('Failed to fetch'))
    renderWithProviders(<RemakesList caseId="1" />)

    expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })
})
