import { describe, expect, it } from 'vitest'
import {
  dayPhrase,
  formatDate,
  formatTimestampDate,
  formatTimestampDayMonth,
  formatTimestampTime,
} from './date-format'

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

// #118: «Recogido por Luis a las 10:32», a la hora local, en 24 h.
describe('formatTimestampTime', () => {
  it('da la hora local en HH:MM, no la de UTC', () => {
    expect(formatTimestampTime('2026-10-05T15:32:00.000Z', 'America/Guayaquil')).toBe('10:32')
  })
  it('la tarde va en 24 h', () => {
    expect(formatTimestampTime('2026-10-05T21:05:00.000Z', 'America/Guayaquil')).toBe('16:05')
  })
})

// M-4 (#118): «Recogido por Luis el 04/10 a las 10:32».
describe('formatTimestampDayMonth', () => {
  it('da el día y el mes locales, no los de UTC', () => {
    // 21:30 del 04/10 en Ecuador es 02:30 del 05/10 en UTC.
    expect(formatTimestampDayMonth('2026-10-05T02:30:00.000Z', 'America/Guayaquil')).toBe('04/10')
  })
})

describe('dayPhrase', () => {
  it('el mismo día es «hoy»', () => {
    expect(dayPhrase('2026-10-04', '2026-10-04')).toBe('hoy')
  })
  it('otro día lleva la fecha con artículo', () => {
    expect(dayPhrase('2026-10-09', '2026-10-04')).toBe('el 09/10/2026')
    expect(dayPhrase('2026-10-01', '2026-10-04')).toBe('el 01/10/2026')
  })
})
