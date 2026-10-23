import { afterEach, describe, expect, it, vi } from 'vitest'
import { helpUrl } from './help-url'

describe('helpUrl', () => {
  afterEach(() => vi.unstubAllEnvs())

  it.each([
    { role: 'recepcion' as const, url: 'https://docs.dentalware.naphsoft.dev/recepcion/' },
    { role: 'mensajero' as const, url: 'https://docs.dentalware.naphsoft.dev/mensajero/' },
    // MAN-2 les da su guía; hasta entonces, la portada.
    { role: 'admin' as const, url: 'https://docs.dentalware.naphsoft.dev/' },
    { role: 'tecnico' as const, url: 'https://docs.dentalware.naphsoft.dev/' },
  ])('$role → $url', ({ role, url }) => {
    vi.stubEnv('VITE_DOCS_URL', '')
    expect(helpUrl(role)).toBe(url)
  })

  it('usa VITE_DOCS_URL sin barra doble', () => {
    vi.stubEnv('VITE_DOCS_URL', 'http://localhost:3100/')
    expect(helpUrl('recepcion')).toBe('http://localhost:3100/recepcion/')
  })
})
