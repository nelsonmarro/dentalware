import { describe, expect, it } from 'vitest'
import { insecureTestPasswordHasher } from './password.ts'

describe('insecureTestPasswordHasher (solo NODE_ENV=test)', () => {
  it('verifica la misma contraseña con la que se generó el hash', async () => {
    const hash = await insecureTestPasswordHasher.hash('Admin12345!')
    expect(await insecureTestPasswordHasher.verify({ hash, password: 'Admin12345!' })).toBe(true)
  })

  it('rechaza otra contraseña', async () => {
    const hash = await insecureTestPasswordHasher.hash('Admin12345!')
    expect(await insecureTestPasswordHasher.verify({ hash, password: 'Otra12345!' })).toBe(false)
  })

  it('no guarda la contraseña en claro', async () => {
    const hash = await insecureTestPasswordHasher.hash('Admin12345!')
    expect(hash).not.toContain('Admin12345!')
  })
})
