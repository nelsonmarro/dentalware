import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { routeTree } from '@/routeTree.gen'
import { getSession } from '@/features/auth/session'
import { ApiError } from '@/lib/api-error'
import type * as CasesApiModule from './api'
import { fetchAttachments } from './attachments-api'

// La ficha (`routes/_app/trabajos/$caseId.tsx`) no tiene archivo de test propio (convención
// del proyecto: `routes/` no lleva tests, ver `home-summary.test.tsx`); se prueba montando el
// árbol de rutas real, igual que `login-redirect.test.tsx`. Se mockea `getSession` (no
// `authClient`: ese import está restringido fuera de `features/auth/**`, docs/architecture.md
// §3.5).
vi.mock('@/features/auth/session', () => ({ getSession: vi.fn() }))
const { fetchCase } = vi.hoisted(() => ({ fetchCase: vi.fn() }))
vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof CasesApiModule>()),
  fetchCase,
  fetchEvents: vi.fn().mockResolvedValue([]),
}))
vi.mock('./attachments-api', () => ({ fetchAttachments: vi.fn() }))
vi.mock('@/features/stages/api', () => ({ fetchStages: vi.fn().mockResolvedValue([]) }))

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

describe('ficha del trabajo: "no existe" distinto de "no se pudo cargar" (UX3-02)', () => {
  beforeEach(() => {
    vi.mocked(getSession).mockResolvedValue({
      id: 'u1',
      name: 'Ana',
      email: 'ana@labo.test',
      role: 'admin',
    })
    fetchCase.mockReset()
    vi.mocked(fetchAttachments).mockResolvedValue([])
  })

  it('un trabajo inexistente (404) dice que el trabajo no existe', async () => {
    fetchCase.mockRejectedValue(new ApiError('No encontrado', 404))

    renderApp('/trabajos/c1')

    expect(await screen.findByText('El trabajo no existe')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Volver a trabajos' })).toBeInTheDocument()
  })

  it('un fallo de red no dice que el trabajo no existe: ofrece reintentar', async () => {
    fetchCase.mockRejectedValue(new TypeError('Failed to fetch'))

    renderApp('/trabajos/c1')

    expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    expect(screen.queryByText('El trabajo no existe')).not.toBeInTheDocument()
  })

  it('un error 500 del servidor tampoco dice que el trabajo no existe', async () => {
    fetchCase.mockRejectedValue(new ApiError('Error interno', 500))

    renderApp('/trabajos/c1')

    expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    expect(screen.queryByText('El trabajo no existe')).not.toBeInTheDocument()
  })
})
