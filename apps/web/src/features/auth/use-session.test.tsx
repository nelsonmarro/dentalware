import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { authClient } from './auth-client'
import { useSession } from './use-session'

vi.mock('./auth-client', () => ({
  authClient: {
    useSession: vi.fn(),
  },
}))

describe('useSession', () => {
  it('expone el usuario con su rol tipado mientras hay sesión', () => {
    vi.mocked(authClient.useSession).mockReturnValue({
      data: { user: { id: 'u1', name: 'Ana', email: 'ana@labo.test', role: 'recepcion' } },
      error: null,
      isPending: false,
    } as ReturnType<typeof authClient.useSession>)

    const { result } = renderHook(() => useSession())

    expect(result.current.user).toEqual({
      id: 'u1',
      name: 'Ana',
      email: 'ana@labo.test',
      role: 'recepcion',
    })
    expect(result.current.isPending).toBe(false)
  })

  it('expone user null mientras no hay sesión', () => {
    vi.mocked(authClient.useSession).mockReturnValue({
      data: null,
      error: null,
      isPending: true,
    } as ReturnType<typeof authClient.useSession>)

    const { result } = renderHook(() => useSession())

    expect(result.current.user).toBeNull()
    expect(result.current.isPending).toBe(true)
  })
})
