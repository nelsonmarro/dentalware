import { describe, expect, it, vi } from 'vitest'
import { authClient } from './auth-client'
import { getSession, getSessionStatus, signIn, signOut } from './session'

vi.mock('./auth-client', () => ({
  authClient: {
    getSession: vi.fn(),
    signIn: { email: vi.fn() },
    signOut: vi.fn(),
  },
}))

describe('getSession', () => {
  it('devuelve el usuario con su rol tipado', async () => {
    vi.mocked(authClient.getSession).mockResolvedValue({
      data: {
        user: { id: 'u1', name: 'Ana', email: 'ana@labo.test', role: 'tecnico' },
      },
      error: null,
    } as Awaited<ReturnType<typeof authClient.getSession>>)

    const user = await getSession()

    expect(user).toEqual({ id: 'u1', name: 'Ana', email: 'ana@labo.test', role: 'tecnico' })
  })

  it('devuelve null sin sesión', async () => {
    vi.mocked(authClient.getSession).mockResolvedValue({
      data: null,
      error: null,
    } as Awaited<ReturnType<typeof authClient.getSession>>)

    expect(await getSession()).toBeNull()
  })

  it('trata un rol desconocido como sin sesión válida (no como admin ni ningún otro rol)', async () => {
    vi.mocked(authClient.getSession).mockResolvedValue({
      data: {
        user: { id: 'u1', name: 'Ana', email: 'ana@labo.test', role: 'superadmin' },
      },
      error: null,
    } as Awaited<ReturnType<typeof authClient.getSession>>)

    expect(await getSession()).toBeNull()
  })
})

describe('getSessionStatus', () => {
  it('distingue un rol desconocido de no tener sesión, para mostrar un mensaje claro', async () => {
    vi.mocked(authClient.getSession).mockResolvedValue({
      data: {
        user: { id: 'u1', name: 'Ana', email: 'ana@labo.test', role: 'superadmin' },
      },
      error: null,
    } as Awaited<ReturnType<typeof authClient.getSession>>)

    expect(await getSessionStatus()).toEqual({ status: 'invalid-role' })
  })

  it('reporta sin sesión cuando no hay datos', async () => {
    vi.mocked(authClient.getSession).mockResolvedValue({
      data: null,
      error: null,
    } as Awaited<ReturnType<typeof authClient.getSession>>)

    expect(await getSessionStatus()).toEqual({ status: 'anonymous' })
  })

  it('reporta ok con el usuario cuando el rol es válido', async () => {
    vi.mocked(authClient.getSession).mockResolvedValue({
      data: {
        user: { id: 'u1', name: 'Ana', email: 'ana@labo.test', role: 'recepcion' },
      },
      error: null,
    } as Awaited<ReturnType<typeof authClient.getSession>>)

    expect(await getSessionStatus()).toEqual({
      status: 'ok',
      user: { id: 'u1', name: 'Ana', email: 'ana@labo.test', role: 'recepcion' },
    })
  })
})

describe('signIn', () => {
  it('devuelve ok false con motivo "credentials" cuando better-auth responde 401', async () => {
    vi.mocked(authClient.signIn.email).mockResolvedValue({
      data: null,
      error: { status: 401, message: 'Credenciales inválidas' },
    } as Awaited<ReturnType<typeof authClient.signIn.email>>)

    const result = await signIn({ email: 'ana@labo.test', password: 'incorrecta' })

    expect(result).toEqual({ ok: false, reason: 'credentials' })
  })

  it('devuelve ok true cuando better-auth responde sin error', async () => {
    vi.mocked(authClient.signIn.email).mockResolvedValue({
      data: { user: {}, token: 't' },
      error: null,
    } as Awaited<ReturnType<typeof authClient.signIn.email>>)

    const result = await signIn({ email: 'ana@labo.test', password: 'correcta' })

    expect(result).toEqual({ ok: true })
  })

  // UX3-10: un 500 o un 429 no son "correo o contraseña incorrectos" — son un fallo del
  // servidor, así que se agrupan con la red (reason 'network') en vez de insinuar que la
  // contraseña está mal.
  it('devuelve ok false con motivo "network" cuando better-auth responde un error que no es 401', async () => {
    vi.mocked(authClient.signIn.email).mockResolvedValue({
      data: null,
      error: { status: 500, message: 'Internal server error' },
    } as Awaited<ReturnType<typeof authClient.signIn.email>>)

    const result = await signIn({ email: 'ana@labo.test', password: 'correcta' })

    expect(result).toEqual({ ok: false, reason: 'network' })
  })

  // UX3-02: sin red, `authClient.signIn.email` rechaza la promesa en vez de resolver con
  // `{ error }` (evidencia en vivo: "Uncaught (in promise)" en la consola). `signIn` debe
  // capturarlo y devolver un resultado normal, nunca dejar la excepción sin atrapar.
  it('devuelve ok false con motivo "network" cuando la petición falla por red (sin capturar la excepción)', async () => {
    vi.mocked(authClient.signIn.email).mockRejectedValue(new TypeError('Failed to fetch'))

    const result = await signIn({ email: 'ana@labo.test', password: 'correcta' })

    expect(result).toEqual({ ok: false, reason: 'network' })
  })
})

describe('signOut', () => {
  it('delega en el cliente', async () => {
    vi.mocked(authClient.signOut).mockResolvedValue(
      {} as Awaited<ReturnType<typeof authClient.signOut>>,
    )

    await signOut()

    expect(authClient.signOut).toHaveBeenCalledOnce()
  })
})
