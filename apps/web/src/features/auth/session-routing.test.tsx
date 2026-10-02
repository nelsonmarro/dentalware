import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { routeTree } from '@/routeTree.gen'
import { authClient } from './auth-client'
import { INVALID_ROLE_MESSAGE } from './session'

vi.mock('./auth-client', () => ({
  authClient: {
    getSession: vi.fn(),
    signIn: { email: vi.fn() },
    signOut: vi.fn(),
  },
}))

type GetSessionResult = Awaited<ReturnType<typeof authClient.getSession>>

const withRole = (role: string) =>
  ({
    data: { user: { id: 'u1', name: 'Ana', email: 'ana@labo.test', role } },
    error: null,
  }) as GetSessionResult

const anonymous = { data: null, error: null } as GetSessionResult

/** El árbol de rutas real de la app, con historial en memoria: prueba `_app` y `login` juntos. */
function renderApp(initialPath: string) {
  const router = createRouter({
    routeTree,
    context: { queryClient: new QueryClient() },
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  })
  render(<RouterProvider router={router} />)
  return router
}

describe('sesión con un rol no válido (issue #21)', () => {
  beforeEach(() => {
    vi.mocked(authClient.getSession).mockReset()
    vi.mocked(authClient.signOut).mockReset()
  })

  it('entrar a la app lleva al login una sola vez y se queda ahí con el motivo, sin bucle', async () => {
    vi.mocked(authClient.getSession).mockResolvedValue(withRole('superadmin'))

    const router = renderApp('/')

    expect(await screen.findByRole('alert')).toHaveTextContent(INVALID_ROLE_MESSAGE)
    expect(router.state.location.pathname).toBe('/login')
    // `_app` pregunta una vez y redirige; `login` pregunta una vez y se queda. Si el login
    // rebotara la sesión de vuelta a `/`, las llamadas no pararían de crecer.
    const calls = vi.mocked(authClient.getSession).mock.calls.length
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(vi.mocked(authClient.getSession).mock.calls.length).toBe(calls)
    expect(calls).toBeLessThanOrEqual(2)
  })

  it('el aviso ofrece cerrar sesión y, al hacerlo, queda el login limpio', async () => {
    vi.mocked(authClient.getSession).mockResolvedValue(withRole('superadmin'))
    vi.mocked(authClient.signOut).mockImplementation(async () => {
      vi.mocked(authClient.getSession).mockResolvedValue(anonymous)
      return { data: { success: true }, error: null } as Awaited<
        ReturnType<typeof authClient.signOut>
      >
    })
    renderApp('/login')

    await userEvent.click(await screen.findByRole('button', { name: 'Cerrar sesión' }))

    expect(authClient.signOut).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeInTheDocument()
  })

  it('sin sesión el login no muestra el aviso ni el botón de cerrar sesión', async () => {
    vi.mocked(authClient.getSession).mockResolvedValue(anonymous)
    renderApp('/login')

    expect(await screen.findByRole('heading', { name: 'Dentalware' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cerrar sesión' })).not.toBeInTheDocument()
  })
})
