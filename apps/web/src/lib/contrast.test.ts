import { describe, expect, it } from 'vitest'
import { contrastRatio } from './contrast'

describe('contrastRatio', () => {
  it('negro sobre blanco da el contraste máximo de la escala WCAG (21:1)', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1)
  })

  it('un color contra sí mismo da 1:1', () => {
    expect(contrastRatio('#5b6a6e', '#5b6a6e')).toBeCloseTo(1, 5)
  })

  it('es simétrico: no importa el orden de los colores', () => {
    const a = contrastRatio('#0f766e', '#f4f6f5')
    const b = contrastRatio('#f4f6f5', '#0f766e')
    expect(a).toBeCloseTo(b, 10)
  })

  it('acepta la forma corta #rgb igual que #rrggbb', () => {
    expect(contrastRatio('#fff', '#000')).toBeCloseTo(contrastRatio('#ffffff', '#000000'), 5)
  })

  it('reproduce el hallazgo UX1-02: el rojo destructivo original no llega a 4.5:1 sobre el fondo', () => {
    // Documenta el problema detectado en la revisión (~4.05:1), no una regla del propio código.
    expect(contrastRatio('#d6453d', '#f4f6f5')).toBeLessThan(4.5)
  })

  it('#767676 sobre blanco es el gris límite AA de referencia (~4.5:1)', () => {
    expect(contrastRatio('#767676', '#ffffff')).toBeGreaterThanOrEqual(4.5)
  })

  it('lanza un error para colores que no sean hexadecimales (no interpreta oklch ni nombres)', () => {
    expect(() => contrastRatio('oklch(0.7 0.19 22)', '#ffffff')).toThrow()
    expect(() => contrastRatio('red', '#ffffff')).toThrow()
  })
})
