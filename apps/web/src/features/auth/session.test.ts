import { describe, expect, it, vi } from 'vitest'
import { authClient } from './auth-client'
import { getSession, signIn, signOut } from './session'

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
})

describe('signIn', () => {
  it('devuelve ok false cuando better-auth responde error', async () => {
    vi.mocked(authClient.signIn.email).mockResolvedValue({
      data: null,
      error: { message: 'Credenciales inválidas' },
    } as Awaited<ReturnType<typeof authClient.signIn.email>>)

    const result = await signIn({ email: 'ana@labo.test', password: 'incorrecta' })

    expect(result).toEqual({ ok: false })
  })

  it('devuelve ok true cuando better-auth responde sin error', async () => {
    vi.mocked(authClient.signIn.email).mockResolvedValue({
      data: { user: {}, token: 't' },
      error: null,
    } as Awaited<ReturnType<typeof authClient.signIn.email>>)

    const result = await signIn({ email: 'ana@labo.test', password: 'correcta' })

    expect(result).toEqual({ ok: true })
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
