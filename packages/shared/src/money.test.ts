import { describe, expect, it } from 'vitest'
import {
  fromCents,
  fromSignedCents,
  lineTotalCents,
  percentOfCents,
  sumCents,
  toCents,
  toSignedCents,
} from './money.ts'

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

describe('percentOfCents', () => {
  it('calcula el porcentaje de un monto en centavos', () => {
    expect(percentOfCents(8000, 50)).toBe(4000)
    expect(percentOfCents(8000, 0)).toBe(0)
    expect(percentOfCents(8000, 100)).toBe(8000)
  })

  it('redondea half-up al centavo', () => {
    // 1 × 50 % = 0,5 centavos → 1; 3 × 50 % = 1,5 → 2; 1005 × 10 % = 100,5 → 101
    expect(percentOfCents(1, 50)).toBe(1)
    expect(percentOfCents(3, 50)).toBe(2)
    expect(percentOfCents(1005, 10)).toBe(101)
    expect(percentOfCents(1004, 10)).toBe(100)
  })
})

describe('montos con signo (ajustes y saldos, Iteración 5)', () => {
  it('convierte cadenas con signo a centavos', () => {
    expect(toSignedCents('-12.50')).toBe(-1250)
    expect(toSignedCents('12.50')).toBe(1250)
    expect(toSignedCents('-0.05')).toBe(-5)
    expect(toSignedCents('0')).toBe(0)
  })
  it('rechaza cadenas inválidas', () => {
    expect(() => toSignedCents('--1')).toThrow()
    expect(() => toSignedCents('+1')).toThrow()
    expect(() => toSignedCents('-1.234')).toThrow()
  })
  it('convierte centavos con signo a cadena', () => {
    expect(fromSignedCents(-1250)).toBe('-12.50')
    expect(fromSignedCents(-5)).toBe('-0.05')
    expect(fromSignedCents(1250)).toBe('12.50')
    expect(fromSignedCents(0)).toBe('0.00')
  })
  it('rechaza centavos no enteros', () => {
    expect(() => fromSignedCents(-1.5)).toThrow()
  })
})
