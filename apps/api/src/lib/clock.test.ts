import { describe, expect, it } from 'vitest'
import { systemClock } from './clock.ts'

describe('systemClock', () => {
  it('today devuelve la fecha ISO YYYY-MM-DD del momento actual', () => {
    expect(systemClock.today()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(systemClock.now()).toBeInstanceOf(Date)
  })
})
