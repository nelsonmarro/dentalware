import { describe, expect, it } from 'vitest'
import { computeTotals } from './case-totals'

describe('computeTotals', () => {
  it('calcula el total por línea (cantidad × precio × (1 − descuento)) y el total del trabajo', () => {
    const result = computeTotals([
      { unitPrice: '45.00', quantity: 2, discountPct: 10 },
      { unitPrice: '75.00', quantity: 1, discountPct: 0 },
    ])
    expect(result.lines).toEqual(['81.00', '75.00'])
    expect(result.total).toBe('156.00')
  })

  it('una línea sin precio (unitPrice null) cuenta como 0.00', () => {
    const result = computeTotals([{ unitPrice: null, quantity: 3, discountPct: 0 }])
    expect(result.lines).toEqual(['0.00'])
    expect(result.total).toBe('0.00')
  })
})
