import { describe, expect, it } from 'vitest'
import { formatDate } from './date-format'

describe('formatDate', () => {
  it('formatea una fecha ISO a dd/mm/aaaa', () => {
    expect(formatDate('2026-09-06')).toBe('06/09/2026')
  })

  it('devuelve un guion cuando no hay fecha', () => {
    expect(formatDate(null)).toBe('—')
  })
})
