import { describe, expect, it } from 'vitest'
import { addBusinessDays, toIsoDate } from './business-days.ts'

const d = (iso: string) => new Date(`${iso}T00:00:00`)

describe('addBusinessDays', () => {
  it('cuenta desde el día siguiente (5 días desde un lunes = lunes siguiente)', () => {
    // 2026-09-07 es lunes
    expect(toIsoDate(addBusinessDays(d('2026-09-07'), 5))).toBe('2026-09-14')
  })

  it('salta fin de semana (1 día desde viernes = lunes)', () => {
    // 2026-09-11 es viernes
    expect(toIsoDate(addBusinessDays(d('2026-09-11'), 1))).toBe('2026-09-14')
  })

  it('si el inicio cae en fin de semana, arranca el lunes', () => {
    // 2026-09-12 es sábado → 1 día hábil = lunes 14
    expect(toIsoDate(addBusinessDays(d('2026-09-12'), 1))).toBe('2026-09-14')
  })

  it('salta feriados', () => {
    // 2026-10-09 (viernes) es feriado en Ecuador (Independencia de Guayaquil)
    expect(toIsoDate(addBusinessDays(d('2026-10-08'), 1, ['2026-10-09']))).toBe('2026-10-12')
  })

  it('0 días devuelve el mismo día a medianoche', () => {
    expect(toIsoDate(addBusinessDays(d('2026-09-07'), 0))).toBe('2026-09-07')
  })

  it('rechaza días negativos', () => {
    expect(() => addBusinessDays(d('2026-09-07'), -1)).toThrow('días debe ser >= 0')
  })
})
