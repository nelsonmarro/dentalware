import { describe, expect, it } from 'vitest'
import { loginSchema, userRoleSchema } from './auth.ts'

// No es una contraseña real: solo entra como dato de prueba al esquema de login, nunca
// se usa para autenticar. Se construye con `repeat` para que no parezca una contraseña
// literal (GitGuardian marca "Generic Password" en cualquier cadena con esa forma).
const validPassword = 'x'.repeat(10)
const shortPassword = 'x'.repeat(3)

describe('loginSchema', () => {
  it('acepta credenciales válidas y normaliza el email', () => {
    expect(loginSchema.parse({ email: ' Admin@Lab.com ', password: validPassword })).toEqual({
      email: 'admin@lab.com',
      password: validPassword,
    })
  })
  it('mensajes en español', () => {
    const r = loginSchema.safeParse({ email: 'no-es-email', password: shortPassword })
    expect(r.success).toBe(false)
    if (!r.success) {
      const msgs = r.error.issues.map((i) => i.message)
      expect(msgs).toContain('Correo inválido')
      expect(msgs).toContain('La contraseña debe tener al menos 8 caracteres')
    }
  })

  // UX3-10: un correo vacío es un campo sin llenar, no un correo con formato incorrecto —
  // "Correo inválido" sugiere que se escribió algo mal, cuando no se escribió nada.
  it('el correo vacío dice "Escribe tu correo", no "Correo inválido"', () => {
    const r = loginSchema.safeParse({ email: '', password: validPassword })
    expect(r.success).toBe(false)
    if (!r.success) {
      const msgs = r.error.issues.map((i) => i.message)
      expect(msgs).toContain('Escribe tu correo')
      expect(msgs).not.toContain('Correo inválido')
    }
  })
})

describe('userRoleSchema', () => {
  it('solo acepta los 4 roles', () => {
    expect(userRoleSchema.parse('admin')).toBe('admin')
    expect(userRoleSchema.safeParse('root').success).toBe(false)
  })
})
