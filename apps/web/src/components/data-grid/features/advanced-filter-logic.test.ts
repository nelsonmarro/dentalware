import { describe, expect, it } from 'vitest'
import { matches, type AdvancedFilter } from './advanced-filter-logic'

const row = { name: 'Prótesis híbrida', category: 'Removible', days: 12 }
const f = (logic: 'and' | 'or', ...conditions: AdvancedFilter['conditions']): AdvancedFilter => ({
  logic,
  conditions,
})

describe('matches (filtro avanzado)', () => {
  it('contiene / es / no es / empieza, sin acentos', () => {
    expect(matches(row, f('and', { column: 'name', op: 'contiene', value: 'hibrida' }))).toBe(true)
    expect(matches(row, f('and', { column: 'category', op: 'es', value: 'removible' }))).toBe(true)
    expect(matches(row, f('and', { column: 'category', op: 'no_es', value: 'Removible' }))).toBe(
      false,
    )
    expect(matches(row, f('and', { column: 'name', op: 'empieza', value: 'pro' }))).toBe(true)
  })
  it('mayor / menor / entre sobre números', () => {
    expect(matches(row, f('and', { column: 'days', op: 'mayor', value: '10' }))).toBe(true)
    expect(matches(row, f('and', { column: 'days', op: 'menor', value: '10' }))).toBe(false)
    expect(matches(row, f('and', { column: 'days', op: 'entre', value: '10,15' }))).toBe(true)
  })
  it('AND exige todas; OR basta una; sin condiciones pasa todo', () => {
    expect(
      matches(
        row,
        f(
          'and',
          { column: 'days', op: 'mayor', value: '10' },
          { column: 'category', op: 'es', value: 'Fija' },
        ),
      ),
    ).toBe(false)
    expect(
      matches(
        row,
        f(
          'or',
          { column: 'days', op: 'mayor', value: '10' },
          { column: 'category', op: 'es', value: 'Fija' },
        ),
      ),
    ).toBe(true)
    expect(matches(row, f('and'))).toBe(true)
  })
})
