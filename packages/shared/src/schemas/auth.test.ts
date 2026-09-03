import { describe, expect, it } from 'vitest'
import { loginSchema, userRoleSchema } from './auth.ts'

describe('loginSchema', () => {
  it('acepta credenciales válidas y normaliza el email', () => {
    expect(loginSchema.parse({ email: ' Admin@Lab.com ', password: 'secreto123' })).toEqual({
      email: 'admin@lab.com',
      password: 'secreto123',
    })
  })
  it('mensajes en español', () => {
    const r = loginSchema.safeParse({ email: 'no-es-email', password: '123' })
    expect(r.success).toBe(false)
    if (!r.success) {
      const msgs = r.error.issues.map((i) => i.message)
      expect(msgs).toContain('Correo inválido')
      expect(msgs).toContain('La contraseña debe tener al menos 8 caracteres')
    }
  })
})

describe('userRoleSchema', () => {
  it('solo acepta los 4 roles', () => {
    expect(userRoleSchema.parse('admin')).toBe('admin')
    expect(userRoleSchema.safeParse('root').success).toBe(false)
  })
})
