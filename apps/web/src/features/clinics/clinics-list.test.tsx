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
import { setMatchMedia } from '@/test/match-media'
import { fetchClinics } from './api'
import { ClinicsList } from './clinics-list'
import { useClinics } from './use-clinics'

vi.mock('./api', () => ({ fetchClinics: vi.fn() }))

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

function Harness() {
  const clinics = useClinics(false)
  return <ClinicsList clinics={clinics} onEdit={vi.fn()} onToggle={vi.fn()} />
}

describe('ClinicsList', () => {
  it('muestra la tabla cuando el catálogo carga bien', async () => {
    setMatchMedia(true)
    vi.mocked(fetchClinics).mockResolvedValue([
      {
        id: 'c1',
        name: 'Clínica Uno',
        city: 'Quito',
        whatsapp: null,
        paymentTermsDays: 30,
        active: true,
      },
    ] as Awaited<ReturnType<typeof fetchClinics>>)

    renderWithProviders(<Harness />)

    expect(await screen.findByText('Clínica Uno')).toBeInTheDocument()
  })

  // Ronda de fixes 1 (UX3-02, punto 3): un fallo de red mostraba la tabla vacía (sin
  // clínicas), confundiéndose con que el laboratorio no tiene ninguna.
  it('un fallo de red ofrece reintentar, en vez de una tabla vacía', async () => {
    setMatchMedia(true)
    vi.mocked(fetchClinics).mockRejectedValue(new TypeError('Failed to fetch'))

    renderWithProviders(<Harness />)

    expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })
})
