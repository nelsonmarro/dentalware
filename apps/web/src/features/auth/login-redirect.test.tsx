import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { routeTree } from '@/routeTree.gen'
import { authClient } from './auth-client'

vi.mock('./auth-client', () => ({
  authClient: {
    getSession: vi.fn(),
    signIn: { email: vi.fn() },
    signOut: vi.fn(),
  },
}))

type GetSessionResult = Awaited<ReturnType<typeof authClient.getSession>>
type SignInResult = Awaited<ReturnType<typeof authClient.signIn.email>>

const withRole = (role: string) =>
  ({
    data: { user: { id: 'u1', name: 'Ana', email: 'ana@labo.test', role } },
    error: null,
  }) as GetSessionResult

const anonymous = { data: null, error: null } as GetSessionResult

/** El árbol de rutas real de la app, con historial en memoria (mismo patrón que
 * `session-routing.test.tsx`): prueba `login.tsx` junto con `_app.tsx` de verdad. */
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

async function fillAndSubmitLogin() {
  const user = userEvent.setup()
  await user.type(await screen.findByLabelText('Correo'), 'ana@labo.test')
  await user.type(screen.getByLabelText('Contraseña'), 'password123')
  await user.click(screen.getByRole('button', { name: 'Ingresar' }))
}

describe('redirección tras iniciar sesión (issue #20)', () => {
  beforeEach(() => {
    vi.mocked(authClient.getSession).mockReset()
    vi.mocked(authClient.signIn.email).mockReset()
  })

  it('tras entrar vuelve al destino interno pedido', async () => {
    vi.mocked(authClient.getSession).mockResolvedValue(anonymous)
    vi.mocked(authClient.signIn.email).mockImplementation(async () => {
      vi.mocked(authClient.getSession).mockResolvedValue(withRole('admin'))
      return { data: { user: { id: 'u1' } }, error: null } as SignInResult
    })

    const router = renderApp('/login?redirect=%2Ftrabajos')
    await fillAndSubmitLogin()

    await waitFor(() => expect(router.state.location.pathname).toBe('/trabajos'))
  })

  it('sin destino pedido va a Inicio', async () => {
    vi.mocked(authClient.getSession).mockResolvedValue(anonymous)
    vi.mocked(authClient.signIn.email).mockImplementation(async () => {
      vi.mocked(authClient.getSession).mockResolvedValue(withRole('admin'))
      return { data: { user: { id: 'u1' } }, error: null } as SignInResult
    })

    const router = renderApp('/login')
    await fillAndSubmitLogin()

    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
  })

  it('un destino externo no se obedece: entra a Inicio', async () => {
    vi.mocked(authClient.getSession).mockResolvedValue(anonymous)
    vi.mocked(authClient.signIn.email).mockImplementation(async () => {
      vi.mocked(authClient.getSession).mockResolvedValue(withRole('admin'))
      return { data: { user: { id: 'u1' } }, error: null } as SignInResult
    })

    const router = renderApp('/login?redirect=https%3A%2F%2Fmalo.example')
    await fillAndSubmitLogin()

    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
  })

  it('con sesión ya iniciada, entrar a /login?redirect=/trabajos redirige directo a /trabajos', async () => {
    vi.mocked(authClient.getSession).mockResolvedValue(withRole('admin'))

    const router = renderApp('/login?redirect=%2Ftrabajos')

    await waitFor(() => expect(router.state.location.pathname).toBe('/trabajos'))
  })
})
