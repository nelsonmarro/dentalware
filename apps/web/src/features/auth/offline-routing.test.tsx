import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAppRouter } from '@/router'
import { authClient } from './auth-client'

vi.mock('./auth-client', () => ({
  authClient: {
    getSession: vi.fn(),
    signIn: { email: vi.fn() },
    signOut: vi.fn(),
  },
}))

vi.mock('@/features/deliveries/api', () => ({
  fetchDeliveries: vi.fn().mockResolvedValue([]),
  fetchCouriers: vi.fn().mockResolvedValue([]),
}))

type GetSessionResult = Awaited<ReturnType<typeof authClient.getSession>>

const admin = {
  data: { user: { id: 'u1', name: 'Ana', email: 'ana@labo.test', role: 'admin' } },
  error: null,
} as GetSessionResult

function renderApp(initialPath: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  // El router real de la app, con su `defaultErrorComponent`: es el que tapaba la pantalla.
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

// UX4-26: sin red, cambiar de día en «Entregas» llevaba a la pantalla completa «No hay conexión
// con el servidor», sin barra de navegación, porque `_app` vuelve a pedir la sesión.
describe('navegar sin red dentro de la app (UX4-26)', () => {
  beforeEach(() => {
    vi.mocked(authClient.getSession).mockReset()
  })

  afterEach(() => {
    act(() => onlineManager.setOnline(true))
  })

  it('cambiar de día en «Entregas» sin red deja la pantalla y la navegación', async () => {
    vi.mocked(authClient.getSession).mockResolvedValue(admin)
    const router = renderApp('/entregas?dia=2026-10-05')
    expect(await screen.findByRole('heading', { level: 1, name: 'Entregas' })).toBeInTheDocument()

    vi.mocked(authClient.getSession).mockRejectedValue(new TypeError('Failed to fetch'))
    act(() => onlineManager.setOnline(false))
    await act(() => router.navigate({ to: '/entregas', search: { dia: '2026-10-06' } }))

    await waitFor(() => expect(router.state.location.search).toEqual({ dia: '2026-10-06' }))
    expect(screen.queryByText('No hay conexión con el servidor')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Entregas' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Principal móvil' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(
      'Sin conexión: lo que marques se enviará al volver la señal',
    )
  })

  it('sin red y sin sesión conocida sigue mostrando la pantalla de error del router', async () => {
    vi.mocked(authClient.getSession).mockResolvedValueOnce({
      data: null,
      error: null,
    } as GetSessionResult)
    const router = renderApp('/login')
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))

    vi.mocked(authClient.getSession).mockRejectedValue(new TypeError('Failed to fetch'))
    await act(() => router.navigate({ to: '/entregas' }))

    expect(await screen.findByText('No hay conexión con el servidor')).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Principal móvil' })).not.toBeInTheDocument()
  })

  it('una sesión caducada (sin sesión al preguntar) lleva al login aunque antes hubiera una', async () => {
    vi.mocked(authClient.getSession).mockResolvedValue(admin)
    const router = renderApp('/entregas?dia=2026-10-05')
    expect(await screen.findByRole('heading', { level: 1, name: 'Entregas' })).toBeInTheDocument()

    vi.mocked(authClient.getSession).mockResolvedValue({
      data: null,
      error: null,
    } as GetSessionResult)
    await act(() => router.navigate({ to: '/entregas', search: { dia: '2026-10-06' } }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
  })
})
