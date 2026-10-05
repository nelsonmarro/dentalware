import { describe, expect, it } from 'vitest'
import { nextBusinessDayLabel } from './next-business-day-label.ts'

describe('nextBusinessDayLabel', () => {
  // 2026-10-02 es viernes: el siguiente día hábil es el lunes, no mañana.
  it('el viernes dice hasta el lunes (incluye el fin de semana)', () => {
    expect(nextBusinessDayLabel('2026-10-02')).toBe('Vencen hasta el lunes')
  })

  it('el sábado dice hasta el lunes', () => {
    expect(nextBusinessDayLabel('2026-10-03')).toBe('Vencen hasta el lunes')
  })

  // El lunes es mañana: se dice «mañana».
  it('el domingo dice mañana', () => {
    expect(nextBusinessDayLabel('2026-10-04')).toBe('Vencen mañana')
  })

  it('de lunes a jueves dice mañana', () => {
    expect(nextBusinessDayLabel('2026-10-05')).toBe('Vencen mañana')
    expect(nextBusinessDayLabel('2026-10-08')).toBe('Vencen mañana')
  })
})
