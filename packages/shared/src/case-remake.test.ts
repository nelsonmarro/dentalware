import { describe, expect, it } from 'vitest'
import { remakeDueDate } from './case-remake.ts'

describe('remakeDueDate', () => {
  it('copia la fecha deseada del padre si todavía no pasó respecto a la recepción del hijo', () => {
    expect(remakeDueDate('2026-12-01', '2026-09-23')).toBe('2026-12-01')
  })

  it('copia la fecha deseada si coincide exactamente con la recepción del hijo', () => {
    expect(remakeDueDate('2026-09-23', '2026-09-23')).toBe('2026-09-23')
  })

  it('devuelve null si la fecha deseada del padre ya venció', () => {
    expect(remakeDueDate('2026-09-01', '2026-09-23')).toBeNull()
  })

  it('devuelve null si el padre no tenía fecha deseada', () => {
    expect(remakeDueDate(null, '2026-09-23')).toBeNull()
  })
})
