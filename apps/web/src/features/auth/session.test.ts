import { onlineManager } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { authClient } from './auth-client'
import { getAppSession, getSession, getSessionStatus, signIn, signOut } from './session'

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

  // UX3-10: un 500 no es "correo o contraseña incorrectos" — es un fallo del servidor, así
  // que se agrupa con la red (reason 'network') en vez de insinuar que la contraseña está mal.
  it('devuelve ok false con motivo "network" cuando better-auth responde un error que no es 401/403/429', async () => {
    vi.mocked(authClient.signIn.email).mockResolvedValue({
      data: null,
      error: { status: 500, message: 'Internal server error' },
    } as Awaited<ReturnType<typeof authClient.signIn.email>>)

    const result = await signIn({ email: 'ana@labo.test', password: 'correcta' })

    expect(result).toEqual({ ok: false, reason: 'network' })
  })

  // Ronda de fixes 1 (ruling del controlador, verificado con context7 contra better-auth
  // 1.7.2): el plugin admin bloquea con 403 y `code: 'BANNED_USER'` (admin.mjs, APIError.from
  // ("FORBIDDEN", { code: "BANNED_USER" })) — un 403 cualquiera no basta, hace falta el code,
  // porque otro 403 (p. ej. un permiso) no es "tu usuario está bloqueado".
  it('devuelve ok false con motivo "banned" cuando better-auth responde 403 BANNED_USER', async () => {
    vi.mocked(authClient.signIn.email).mockResolvedValue({
      data: null,
      error: { status: 403, code: 'BANNED_USER', message: 'You have been banned' },
    } as Awaited<ReturnType<typeof authClient.signIn.email>>)

    const result = await signIn({ email: 'ana@labo.test', password: 'correcta' })

    expect(result).toEqual({ ok: false, reason: 'banned' })
  })

  it('un 403 sin el code BANNED_USER no se trata como bloqueado: cae en "network"', async () => {
    vi.mocked(authClient.signIn.email).mockResolvedValue({
      data: null,
      error: { status: 403, message: 'Forbidden' },
    } as Awaited<ReturnType<typeof authClient.signIn.email>>)

    const result = await signIn({ email: 'ana@labo.test', password: 'correcta' })

    expect(result).toEqual({ ok: false, reason: 'network' })
  })

  // El limitador de intentos de better-auth responde 429 sin cuerpo JSON con code propio
  // (rate-limiter/index.mjs: `{ message: "Too many requests…" }`, status 429, cabecera
  // `X-Retry-After`): el status solo ya identifica el caso.
  it('devuelve ok false con motivo "rate-limited" cuando better-auth responde 429', async () => {
    vi.mocked(authClient.signIn.email).mockResolvedValue({
      data: null,
      error: { status: 429, message: 'Too many requests. Please try again later.' },
    } as Awaited<ReturnType<typeof authClient.signIn.email>>)

    const result = await signIn({ email: 'ana@labo.test', password: 'correcta' })

    expect(result).toEqual({ ok: false, reason: 'rate-limited' })
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

// UX4-26: sin red, `_app` pregunta la sesión en cada navegación (cambiar de día en «Entregas»
// incluido) y el rechazo de la red tapaba la pantalla entera con el error del router. Si ya se
// conocía una sesión válida en esta pestaña, se deja pasar; la API sigue exigiendo sesión y la
// consulta de la pantalla muestra su propio `LoadError` o sus datos en caché.
describe('getAppSession', () => {
  type Result = Awaited<ReturnType<typeof authClient.getSession>>
  const ana = { id: 'u1', name: 'Ana', email: 'ana@labo.test', role: 'mensajero' }
  const ok = { data: { user: ana }, error: null } as Result
  const anonymous = { data: null, error: null } as Result
  const sinRed = new TypeError('Failed to fetch')

  beforeEach(async () => {
    // Parte siempre sin sesión conocida: una respuesta sin sesión la olvida.
    vi.mocked(authClient.getSession).mockReset()
    vi.mocked(authClient.getSession).mockResolvedValue(anonymous)
    await getAppSession()
    // «Sin red» es lo que dice `onlineManager` (el mismo que pausa las mutaciones y pinta el
    // aviso); los casos de abajo que simulan el rechazo de `fetch` también lo ponen sin red.
    onlineManager.setOnline(false)
  })
  afterEach(() => {
    onlineManager.setOnline(true)
  })

  it('con red devuelve el usuario de la sesión', async () => {
    vi.mocked(authClient.getSession).mockResolvedValue(ok)

    expect(await getAppSession()).toEqual(ana)
  })

  it('sin red y con una sesión ya conocida devuelve esa sesión', async () => {
    vi.mocked(authClient.getSession).mockResolvedValueOnce(ok).mockRejectedValueOnce(sinRed)
    await getAppSession()

    expect(await getAppSession()).toEqual(ana)
  })

  it('sin red y sin sesión conocida falla como antes', async () => {
    vi.mocked(authClient.getSession).mockRejectedValue(sinRed)

    await expect(getAppSession()).rejects.toBe(sinRed)
  })

  it('una respuesta sin sesión (401, sesión caducada) olvida la sesión conocida', async () => {
    vi.mocked(authClient.getSession)
      .mockResolvedValueOnce(ok)
      .mockResolvedValueOnce(anonymous)
      .mockRejectedValueOnce(sinRed)
    await getAppSession()

    expect(await getAppSession()).toBeNull()
    await expect(getAppSession()).rejects.toBe(sinRed)
  })

  it('un rol no válido olvida la sesión conocida', async () => {
    vi.mocked(authClient.getSession)
      .mockResolvedValueOnce(ok)
      .mockResolvedValueOnce({
        data: { user: { ...ana, role: 'superadmin' } },
        error: null,
      } as Result)
      .mockRejectedValueOnce(sinRed)
    await getAppSession()

    expect(await getAppSession()).toBeNull()
    await expect(getAppSession()).rejects.toBe(sinRed)
  })

  it('cerrar sesión olvida la sesión conocida', async () => {
    vi.mocked(authClient.getSession).mockResolvedValueOnce(ok).mockRejectedValueOnce(sinRed)
    vi.mocked(authClient.signOut).mockResolvedValue(
      {} as Awaited<ReturnType<typeof authClient.signOut>>,
    )
    await getAppSession()

    await signOut()

    await expect(getAppSession()).rejects.toBe(sinRed)
  })

  // M-5 de la revisión final: un `TypeError` con red es un fallo de programación del cliente de
  // auth, no «sin red»; dejar pasar con la sesión conocida lo ocultaría.
  it('con red, un TypeError no usa la sesión conocida', async () => {
    const bug = new TypeError("Cannot read properties of undefined (reading 'user')")
    vi.mocked(authClient.getSession).mockResolvedValueOnce(ok).mockRejectedValueOnce(bug)
    onlineManager.setOnline(true)
    await getAppSession()

    await expect(getAppSession()).rejects.toBe(bug)
  })

  it('un fallo que no es de red no usa la sesión conocida', async () => {
    const otro = new Error('respuesta ilegible')
    vi.mocked(authClient.getSession).mockResolvedValueOnce(ok).mockRejectedValueOnce(otro)
    await getAppSession()

    await expect(getAppSession()).rejects.toBe(otro)
  })
})
