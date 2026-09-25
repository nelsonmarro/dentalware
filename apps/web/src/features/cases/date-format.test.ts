import { describe, expect, it } from 'vitest'
import { formatDate, formatTimestampDate } from './date-format'

describe('formatDate', () => {
  it('formatea una fecha ISO a dd/mm/aaaa', () => {
    expect(formatDate('2026-09-06')).toBe('06/09/2026')
  })

  it('devuelve un guion cuando no hay fecha', () => {
    expect(formatDate(null)).toBe('—')
  })

  it('formatTimestampDate da el día local, no el de UTC', () => {
    // 19:30 del 10/01 en Ecuador es 00:30 del 11/01 en UTC.
    expect(formatTimestampDate('2026-01-11T00:30:00.000Z', 'America/Guayaquil')).toBe('10/01/2026')
  })
})
