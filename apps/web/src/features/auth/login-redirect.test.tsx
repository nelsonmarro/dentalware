import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { routeTree } from '@/routeTree.gen'
import type * as CasesApiModule from '@/features/cases/api'
import type { CaseDetail } from '@/features/cases/api'
import { authClient } from './auth-client'

vi.mock('./auth-client', () => ({
  authClient: {
    getSession: vi.fn(),
    signIn: { email: vi.fn() },
    signOut: vi.fn(),
  },
}))

// Solo para la ficha corta del QR (Tarea 15, FIC-2 #72): `/t/:code` monta `QuickCase`, que
// fetchea con `useCaseByCode`/`useStages` en cuanto `_app` deja pasar la sesión. Sin este mock
// el test dispararía una petición de red real; no se comprueba su contenido, solo que el
// router vuelve a `/t/:code` (el contenido ya lo prueba `quick-case.test.tsx`).
const { fetchCaseByCode } = vi.hoisted(() => ({ fetchCaseByCode: vi.fn() }))
vi.mock('@/features/cases/api', async (importOriginal) => ({
  ...(await importOriginal<typeof CasesApiModule>()),
  fetchCaseByCode,
}))
vi.mock('@/features/stages/api', () => ({ fetchStages: vi.fn().mockResolvedValue([]) }))

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

function casoMinimo(): CaseDetail {
  return {
    id: 'c1',
    code: '26-00123',
    patientRef: 'Juan Pérez',
    status: 'nuevo',
    currentStageId: null,
    stage: null,
    total: null,
    items: [],
    clinic: { id: 'clinica-1', name: 'Clínica Uno' },
    doctor: { id: 'doctor-1', name: 'Dr. Gómez' },
  } as unknown as CaseDetail
}

describe('redirección tras iniciar sesión (issue #20)', () => {
  beforeEach(() => {
    vi.mocked(authClient.getSession).mockReset()
    vi.mocked(authClient.signIn.email).mockReset()
    fetchCaseByCode.mockReset()
    fetchCaseByCode.mockResolvedValue({ case: casoMinimo(), missing: [] })
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

  it('con sesión ya iniciada, un destino externo en ?redirect= entra a Inicio', async () => {
    vi.mocked(authClient.getSession).mockResolvedValue(withRole('admin'))

    const router = renderApp('/login?redirect=%2F%2Fmalo.example%2Fx')

    await waitFor(() => expect(router.state.location.href).toBe('/'))
  })

  it('el viaje de ida y vuelta conserva la búsqueda y el hash del destino', async () => {
    vi.mocked(authClient.getSession).mockResolvedValue(anonymous)
    vi.mocked(authClient.signIn.email).mockImplementation(async () => {
      vi.mocked(authClient.getSession).mockResolvedValue(withRole('admin'))
      return { data: { user: { id: 'u1' } }, error: null } as SignInResult
    })

    const router = renderApp('/trabajos?vista=atrasados&pagina=2#x')
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
    await fillAndSubmitLogin()

    await waitFor(() => expect(router.state.location.pathname).toBe('/trabajos'))
    expect(router.state.location.search).toMatchObject({ vista: 'atrasados', pagina: 2 })
    expect(router.state.location.hash).toBe('x')
  })

  // FIC-2 (#72, Tarea 15): la ficha corta del QR es solo otro destino interno de `?redirect=`,
  // sin tocar `login.tsx` (ruling C3 del brief) — mismo mecanismo que ya prueban los casos de
  // arriba, ejercitado con `/t/:code` para fijar el criterio de aceptación de la historia.
  it('sin sesión, /t/:code pide login y vuelve a la ficha corta tras entrar', async () => {
    vi.mocked(authClient.getSession).mockResolvedValue(anonymous)
    vi.mocked(authClient.signIn.email).mockImplementation(async () => {
      vi.mocked(authClient.getSession).mockResolvedValue(withRole('tecnico'))
      return { data: { user: { id: 'u1' } }, error: null } as SignInResult
    })

    const router = renderApp('/t/26-00123')
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
    await fillAndSubmitLogin()

    await waitFor(() => expect(router.state.location.pathname).toBe('/t/26-00123'))
    expect(await screen.findByRole('heading', { level: 1, name: '26-00123' })).toBeInTheDocument()
  })

  // UX3-19: el login al que lleva el QR era idéntico al normal; ahora nombra el trabajo.
  it('desde el QR, el login dice qué trabajo se abrirá tras entrar', async () => {
    vi.mocked(authClient.getSession).mockResolvedValue(anonymous)
    renderApp('/login?redirect=%2Ft%2F26-00001')
    // El código va en monoespaciada (un `<span>` propio): se compara el texto del párrafo entero.
    expect(
      await screen.findByText(
        (_, el) =>
          el?.tagName === 'P' && el.textContent === 'Inicia sesión para abrir el trabajo 26-00001',
      ),
    ).toBeInTheDocument()
  })

  it('con otro destino, el login no nombra ningún trabajo', async () => {
    vi.mocked(authClient.getSession).mockResolvedValue(anonymous)
    renderApp('/login?redirect=%2Ftrabajos')
    await screen.findByLabelText('Correo')
    expect(screen.queryByText(/Inicia sesión para abrir el trabajo/)).not.toBeInTheDocument()
  })
})
