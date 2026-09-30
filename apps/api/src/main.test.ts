import { describe, expect, it } from 'vitest'
import { fatalStartupMessage } from './main.ts'

/**
 * `loadConfig()` ya lanza un `Error` con el detalle en español (`config.ts`); sin captura,
 * `main.ts` lo dejaba salir como traza completa. `fatalStartupMessage` es lo que se imprime
 * (sin traza) antes de salir con código 1 (issue #21).
 */
describe('fatalStartupMessage', () => {
  it('usa el mensaje del error cuando es un Error', () => {
    expect(
      fatalStartupMessage(new Error('Configuración inválida:\nDATABASE_URL: obligatoria')),
    ).toBe('Configuración inválida:\nDATABASE_URL: obligatoria')
  })

  it('da un mensaje genérico en español si no es un Error', () => {
    expect(fatalStartupMessage('algo raro')).toBe('Error inesperado al iniciar la API')
  })
})
