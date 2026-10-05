import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { pickedUpText } from './picked-up-text'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-05T12:00:00'))
})
afterEach(() => {
  vi.useRealTimers()
})

// M-4 (revisión final de #118): lo que viene en camino de otro día no se lee como de hoy.
describe('pickedUpText', () => {
  it('recogido hoy: solo la hora', () => {
    expect(pickedUpText('Luis', new Date('2026-10-05T10:32:00').toISOString(), '2026-10-05')).toBe(
      'Recogido por Luis a las 10:32',
    )
  })
  it('recogido otro día: el día y la hora', () => {
    expect(pickedUpText('Luis', new Date('2026-10-04T10:32:00').toISOString(), '2026-10-05')).toBe(
      'Recogido por Luis el 04/10 a las 10:32',
    )
  })
})
