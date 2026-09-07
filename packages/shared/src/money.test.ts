import { describe, expect, it } from 'vitest'
import { fromCents, lineTotalCents, sumCents, toCents } from './money.ts'

describe('money', () => {
  it('convierte cadenas a centavos y de vuelta', () => {
    expect(toCents('12.50')).toBe(1250)
    expect(toCents('7')).toBe(700)
    expect(toCents('0.05')).toBe(5)
    expect(fromCents(1250)).toBe('12.50')
    expect(fromCents(5)).toBe('0.05')
    expect(fromCents(0)).toBe('0.00')
  })
  it('rechaza cadenas inválidas', () => {
    expect(() => toCents('12,50')).toThrow()
    expect(() => toCents('abc')).toThrow()
    expect(() => toCents('1.234')).toThrow()
  })
  it('calcula el total de línea con descuento y redondeo half-up', () => {
    expect(lineTotalCents(4500, 2, 0)).toBe(9000)
    expect(lineTotalCents(4500, 1, 10)).toBe(4050)
    expect(lineTotalCents(1001, 1, 50)).toBe(501) // 500.5 → 501
    expect(lineTotalCents(333, 3, 33.33)).toBe(666) // 999 × 0.6667 = 666.03
  })
  it('suma centavos', () => {
    expect(sumCents([100, 250, 5])).toBe(355)
    expect(sumCents([])).toBe(0)
  })
})
