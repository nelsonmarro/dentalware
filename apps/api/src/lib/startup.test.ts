import { afterEach, describe, expect, it, vi } from 'vitest'
import { ConfigError } from '../config.ts'
import { reportStartupError } from './startup.ts'

/**
 * `main.ts` solo debe reducir a su `.message` (sin traza) el error de configuración
 * (`ConfigError`, ya en español). Cualquier otro fallo de arranque (Postgres caído, host
 * inexistente, contraseña incorrecta) debe imprimirse completo, con su `cause`: los tres casos
 * reales que probó el revisor imprimían el mismo mensaje genérico de Drizzle
 * («Failed query: CREATE SCHEMA...») cuando `main.ts` solo miraba `error.message`, perdiendo la
 * causa real (p. ej. `password authentication failed`) — issue #21, ronda de fixes 1, I-1.
 */
describe('reportStartupError', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('imprime solo el mensaje cuando el error es un ConfigError', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const error = new ConfigError('Configuración inválida:\nDATABASE_URL: obligatoria')

    reportStartupError(error)

    expect(spy).toHaveBeenCalledExactlyOnceWith(
      'Configuración inválida:\nDATABASE_URL: obligatoria',
    )
  })

  it('imprime el error completo, con su cause, cuando no es un ConfigError', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const cause = new Error('password authentication failed')
    const error = new Error('Failed query: CREATE SCHEMA IF NOT EXISTS "drizzle"', { cause })

    reportStartupError(error)

    // No se reduce a `error.message`: se imprime el objeto de error completo, que Node
    // formatea con traza y `cause` en la consola real.
    expect(spy).toHaveBeenCalledExactlyOnceWith(error)
    expect(spy.mock.calls[0]?.[0]).not.toBe(error.message)
  })
})
