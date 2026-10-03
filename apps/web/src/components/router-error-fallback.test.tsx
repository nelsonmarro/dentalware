import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getSession } from '@/features/auth/session'
import { createAppRouter } from '@/router'

// `getSession` (no `authClient`: ese import está restringido fuera de `features/auth/**` por
// `pnpm lint`, docs/architecture.md §3.5) es la frontera que `_app.tsx` llama en su
// `beforeLoad`. El fallo real que dispara el `errorComponent` (UX3-02) es que esa promesa se
// rechace cuando no hay red.
vi.mock('@/features/auth/session', () => ({ getSession: vi.fn() }))

function renderApp(initialPath: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createAppRouter(
    queryClient,
    createMemoryHistory({ initialEntries: [initialPath] }),
  )
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

describe('RouterErrorFallback (defaultErrorComponent)', () => {
  beforeEach(() => {
    vi.mocked(getSession).mockReset()
  })

  it('un fallo de red al cargar la sesión muestra el error en español, no el genérico del router', async () => {
    vi.mocked(getSession).mockRejectedValue(new TypeError('Failed to fetch'))

    renderApp('/trabajos')

    expect(await screen.findByText('No hay conexión con el servidor')).toBeInTheDocument()
    expect(screen.queryByText(/Something went wrong/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Failed to fetch/i)).not.toBeInTheDocument()
  })

  it('ofrece "Reintentar" y una salida a Inicio, ambos de objetivo táctil adecuado', async () => {
    vi.mocked(getSession).mockRejectedValue(new TypeError('Failed to fetch'))

    renderApp('/trabajos')

    const retry = await screen.findByRole('button', { name: 'Reintentar' })
    expect(retry.className).toContain('h-11')
    const home = screen.getByRole('link', { name: 'Ir a Inicio' })
    expect(home).toHaveAttribute('href', '/')
  })

  it('"Reintentar" vuelve a pedir la sesión (router.invalidate), no solo limpia el error en pantalla', async () => {
    vi.mocked(getSession).mockRejectedValue(new TypeError('Failed to fetch'))

    renderApp('/trabajos')
    const retry = await screen.findByRole('button', { name: 'Reintentar' })
    const callsBefore = vi.mocked(getSession).mock.calls.length

    retry.click()

    await waitFor(() =>
      expect(vi.mocked(getSession).mock.calls.length).toBeGreaterThan(callsBefore),
    )
  })
})
