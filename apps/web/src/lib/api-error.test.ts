import { describe, expect, it } from 'vitest'
import { ApiError, isNotFoundError } from './api-error'

describe('isNotFoundError', () => {
  it('un ApiError 404 es "no existe"', () => {
    expect(isNotFoundError(new ApiError('No encontrado', 404))).toBe(true)
  })

  it('un ApiError 500 no es "no existe": es un fallo del servidor', () => {
    expect(isNotFoundError(new ApiError('Fallo', 500))).toBe(false)
  })

  it('un error que no es ApiError (fallo de red) no es "no existe"', () => {
    expect(isNotFoundError(new TypeError('Failed to fetch'))).toBe(false)
  })

  it('con un status extra declarado, ese status también cuenta como "no existe"', () => {
    expect(isNotFoundError(new ApiError('Datos inválidos', 422), [422])).toBe(true)
  })

  it('sin declarar el status extra, ese mismo error no cuenta como "no existe"', () => {
    expect(isNotFoundError(new ApiError('Datos inválidos', 422))).toBe(false)
  })
})
