import { describe, expect, it } from 'vitest'
import { deltaE76 } from './delta-e'

describe('deltaE76 (diferencia de color CIE76 en L*a*b*, D65)', () => {
  it('negro y blanco están a 100 (toda la luminosidad L*)', () => {
    expect(deltaE76('#000000', '#ffffff')).toBeCloseTo(100, 1)
  })

  it('un color contra sí mismo da 0', () => {
    expect(deltaE76('#5b6a6e', '#5b6a6e')).toBeCloseTo(0, 5)
  })

  it('es simétrica y acepta la forma corta #rgb', () => {
    expect(deltaE76('#0f766e', '#f4f6f5')).toBeCloseTo(deltaE76('#f4f6f5', '#0f766e'), 10)
    expect(deltaE76('#fff', '#000')).toBeCloseTo(100, 1)
  })

  it('reproduce el hallazgo UX5-10: el rojo de 61–90 y el de «Más de 90» están a ~11,5', () => {
    // Documenta el problema medido en la revisión, no una regla del propio código.
    expect(deltaE76('#d6453d', '#b3261e')).toBeCloseTo(11.5, 1)
  })

  it('un rojo puro y un verde puro están a ~170 (valor de referencia CIE76)', () => {
    expect(deltaE76('#ff0000', '#00ff00')).toBeCloseTo(170.6, 0)
  })
})
