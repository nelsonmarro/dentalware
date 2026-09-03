import { describe, expect, it } from 'vitest'
import { loadConfig } from './config.ts'

describe('loadConfig', () => {
  it('lanza un error en español cuando el entorno está vacío', () => {
    expect(() => loadConfig({})).toThrow('Configuración inválida')
    try {
      loadConfig({})
      throw new Error('loadConfig no lanzó el error esperado')
    } catch (err) {
      const message = (err as Error).message
      expect(message).toContain('Configuración inválida')
      expect(message).not.toMatch(/Invalid|Too small|expected/)
    }
  })

  it('aplica los valores por defecto con un entorno mínimo válido', () => {
    const config = loadConfig({
      DATABASE_URL: 'postgres://dentalware:dentalware@localhost:5433/dentalware',
      BETTER_AUTH_SECRET: 'a'.repeat(32),
      BETTER_AUTH_URL: 'http://localhost:3000',
      WEB_ORIGIN: 'http://localhost:5173',
      ADMIN_EMAIL: 'admin@lab.local',
      ADMIN_PASSWORD: 'Admin12345!',
    })

    expect(config.PORT).toBe(3000)
    expect(config.NODE_ENV).toBe('development')
    expect(config.ADMIN_NAME).toBe('Administrador')
  })
})
