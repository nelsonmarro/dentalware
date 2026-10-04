import { describe, expect, it } from 'vitest'
import { testPassword } from '../test/passwords.ts'
import { insecureTestPasswordHasher } from './password.ts'

describe('insecureTestPasswordHasher (solo NODE_ENV=test)', () => {
  it('verifica la misma contraseña con la que se generó el hash', async () => {
    const password = testPassword()
    const hash = await insecureTestPasswordHasher.hash(password)
    expect(await insecureTestPasswordHasher.verify({ hash, password })).toBe(true)
  })

  it('rechaza otra contraseña', async () => {
    const hash = await insecureTestPasswordHasher.hash(testPassword())
    expect(await insecureTestPasswordHasher.verify({ hash, password: testPassword() })).toBe(false)
  })

  it('no guarda la contraseña en claro', async () => {
    const password = testPassword()
    const hash = await insecureTestPasswordHasher.hash(password)
    expect(hash).not.toContain(password)
  })
})
