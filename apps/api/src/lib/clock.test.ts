import { describe, expect, it } from 'vitest'
import { fixedClockAt, systemClock } from './clock.ts'

describe('systemClock', () => {
  it('today devuelve la fecha ISO YYYY-MM-DD del momento actual', () => {
    expect(systemClock.today()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(systemClock.now()).toBeInstanceOf(Date)
  })
})

describe('fixedClockAt', () => {
  it('da siempre el mismo instante y su día', () => {
    const clock = fixedClockAt('2026-10-20T10:30:00-05:00')
    expect(clock.now().toISOString()).toBe('2026-10-20T15:30:00.000Z')
    expect(clock.today()).toBe('2026-10-20')
    expect(clock.now().getTime()).toBe(clock.now().getTime())
  })
})
