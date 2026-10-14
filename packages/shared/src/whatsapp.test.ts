import { describe, expect, it } from 'vitest'
import { normalizeWhatsapp } from './whatsapp.ts'

describe('normalizeWhatsapp (UX7-06)', () => {
  it.each([
    ['099 123 4567', '+593991234567'],
    ['0991234567', '+593991234567'],
    ['(099) 123-4567', '+593991234567'],
    ['099.123.4567', '+593991234567'],
    ['+593 99 123 4567', '+593991234567'],
    ['00593 99 123 4567', '+593991234567'],
    ['+593991234567', '+593991234567'],
  ])('«%s» → «%s»', (raw, e164) => {
    expect(normalizeWhatsapp(raw)).toBe(e164)
  })

  it.each(['099123456', '99 123 4567', 'abc', '+593 99 123 45678 9'])(
    'deja «%s» como está (sin espacios) para que el schema lo rechace',
    (raw) => {
      expect(normalizeWhatsapp(raw)).toBe(raw.replace(/[\s\-().]/g, ''))
    },
  )
})
