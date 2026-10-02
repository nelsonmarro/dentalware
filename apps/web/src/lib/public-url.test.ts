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

  it('quita la barra final para que el QR no lleve «//t/»', () => {
    // `https://lab.ec/` es como se suele escribir un dominio; sin recortarla, el QR de la orden
    // codificaría `https://lab.ec//t/26-00001` (N-2 de la re-revisión de la Tarea 14).
    vi.stubEnv('VITE_PUBLIC_URL', 'https://artedental.ec/')
    expect(getPublicUrl()).toBe('https://artedental.ec')
    vi.stubEnv('VITE_PUBLIC_URL', 'https://artedental.ec//')
    expect(getPublicUrl()).toBe('https://artedental.ec')
  })
})
