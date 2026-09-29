import { afterEach, describe, expect, it, vi } from 'vitest'
import { getPublicUrl } from './public-url'

describe('getPublicUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('usa VITE_PUBLIC_URL cuando está configurada en build', () => {
    vi.stubEnv('VITE_PUBLIC_URL', 'https://artedental.ec')
    expect(getPublicUrl()).toBe('https://artedental.ec')
  })

  it('cae a window.location.origin si VITE_PUBLIC_URL no está configurada', () => {
    vi.stubEnv('VITE_PUBLIC_URL', '')
    expect(getPublicUrl()).toBe(window.location.origin)
  })
})
