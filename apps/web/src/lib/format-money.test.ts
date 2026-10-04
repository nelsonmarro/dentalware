import { describe, expect, it } from 'vitest'
import { formatMoney } from './format-money'

describe('formatMoney', () => {
  it('formatea una cadena decimal con dos decimales y el signo de dólar', () => {
    expect(formatMoney('45')).toBe('$ 45.00')
    expect(formatMoney('12.5')).toBe('$ 12.50')
  })

  it('acepta un número', () => {
    expect(formatMoney(80)).toBe('$ 80.00')
  })
})
