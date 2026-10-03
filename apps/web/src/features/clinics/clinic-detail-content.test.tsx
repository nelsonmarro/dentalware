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
import { ApiError } from '@/lib/api-error'
import { ClinicDetailContent } from './clinic-detail-content'
import type * as ClinicsApiModule from './api'
import type * as DoctorsApiModule from '@/features/doctors/api'

const { fetchClinic, fetchDoctors } = vi.hoisted(() => ({
  fetchClinic: vi.fn(),
  fetchDoctors: vi.fn(),
}))
vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof ClinicsApiModule>()),
  fetchClinic,
}))
vi.mock('@/features/doctors/api', async (importOriginal) => ({
  ...(await importOriginal<typeof DoctorsApiModule>()),
  fetchDoctors,
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

describe('ClinicDetailContent', () => {
  it('muestra la clínica cuando carga bien', async () => {
    setMatchMedia(true)
    fetchClinic.mockResolvedValue({
      id: 'c1',
      name: 'Clínica Uno',
      city: null,
      address: null,
      phone: null,
      whatsapp: null,
    })
    fetchDoctors.mockResolvedValue([])

    renderWithProviders(<ClinicDetailContent clinicId="c1" />)

    expect(await screen.findByRole('heading', { name: 'Clínica Uno' })).toBeInTheDocument()
  })

  it('una clínica inexistente (404) dice que no existe, con salida a la lista', async () => {
    fetchClinic.mockRejectedValue(new ApiError('No encontrado', 404))

    renderWithProviders(<ClinicDetailContent clinicId="c-no-existe" />)

    expect(await screen.findByText('La clínica no existe')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Volver a clínicas' })).toBeInTheDocument()
  })

  // Ronda de fixes 1 (UX3-02, punto 3): antes, cualquier fallo (también un 500 o sin red)
  // mostraba "La clínica no existe.", aunque el problema fuera de red.
  it('un fallo de red no dice que la clínica no existe: ofrece reintentar', async () => {
    fetchClinic.mockRejectedValue(new TypeError('Failed to fetch'))

    renderWithProviders(<ClinicDetailContent clinicId="c1" />)

    expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    expect(screen.queryByText('La clínica no existe')).not.toBeInTheDocument()
  })

  it('un fallo al cargar los doctores ofrece reintentar en esa pestaña', async () => {
    setMatchMedia(true)
    fetchClinic.mockResolvedValue({
      id: 'c1',
      name: 'Clínica Uno',
      city: null,
      address: null,
      phone: null,
      whatsapp: null,
    })
    fetchDoctors.mockRejectedValue(new TypeError('Failed to fetch'))

    renderWithProviders(<ClinicDetailContent clinicId="c1" />)

    expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })
})
