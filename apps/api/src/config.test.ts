import { afterEach, describe, expect, it, vi } from 'vitest'
import { ConfigError, loadConfig } from './config.ts'

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

  it('lanza específicamente un ConfigError, no un Error genérico (issue #21, ronda de fixes 1)', () => {
    // `main.ts` distingue "error de configuración" (mensaje limpio) de cualquier otro fallo de
    // arranque (traza completa, con `cause`): necesita una clase propia para diferenciarlos,
    // no `instanceof Error` (todo lo es). `toThrow(ConfigError)` no basta como RED: si
    // `ConfigError` no existiera, la importación resolvería a `undefined` y
    // `toThrow(undefined)` pasa igual (solo exige que lance algo) — falso verde.
    expect(typeof ConfigError).toBe('function')
    let caught: unknown
    try {
      loadConfig({})
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(ConfigError)
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
    expect(config.STORAGE_DRIVER).toBe('local')
  })

  it('rechaza un STORAGE_DRIVER desconocido con un mensaje en español (#103)', () => {
    expect(() =>
      loadConfig({
        DATABASE_URL: 'postgres://dentalware:dentalware@localhost:5433/dentalware',
        BETTER_AUTH_SECRET: 'a'.repeat(32),
        BETTER_AUTH_URL: 'http://localhost:3000',
        WEB_ORIGIN: 'http://localhost:5173',
        ADMIN_EMAIL: 'admin@lab.local',
        ADMIN_PASSWORD: 'Admin12345!',
        STORAGE_DRIVER: 'ftp',
      }),
    ).toThrow('STORAGE_DRIVER debe ser')
  })
})

describe('loadConfig — selección de archivo de entorno (sin `env` inyectado, usa process.env)', () => {
  const originalNodeEnv = process.env.NODE_ENV

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv
  })

  it('carga .env.test cuando NODE_ENV=test, para no escribir en la BD de desarrollo', () => {
    process.env.NODE_ENV = 'test'
    const spy = vi.spyOn(process, 'loadEnvFile').mockImplementation(() => undefined)
    try {
      loadConfig()
    } catch {
      /* el resto de variables puede faltar en este proceso; solo interesa qué archivo se pidió */
    }
    expect(spy).toHaveBeenCalledWith('.env.test')
    spy.mockRestore()
  })

  it('carga .env cuando NODE_ENV no es test', () => {
    process.env.NODE_ENV = 'development'
    const spy = vi.spyOn(process, 'loadEnvFile').mockImplementation(() => undefined)
    try {
      loadConfig()
    } catch {
      /* ídem */
    }
    expect(spy).toHaveBeenCalledWith('.env')
    spy.mockRestore()
  })
})
