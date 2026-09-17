import { describe, expect, it } from 'vitest'
import { matches, type AdvancedFilter } from './advanced-filter-logic'

const row = { name: 'Prótesis híbrida', category: 'Removible', days: 12 }
const f = (logic: 'and' | 'or', ...conditions: AdvancedFilter['conditions']): AdvancedFilter => ({
  logic,
  conditions,
})
// Resolver por defecto para las filas planas de estos tests: el id de columna coincide con el
// campo crudo. `matches` ya no indexa la fila directamente (ver el test de accessor derivado más
// abajo, que es justo el caso que no funcionaba sin resolver).
const byKey = (r: unknown, columnId: string): unknown => (r as Record<string, unknown>)[columnId]

describe('matches (filtro avanzado)', () => {
  it('contiene / es / no es / empieza, sin acentos', () => {
    expect(
      matches(row, f('and', { column: 'name', op: 'contiene', value: 'hibrida' }), byKey),
    ).toBe(true)
    expect(
      matches(row, f('and', { column: 'category', op: 'es', value: 'removible' }), byKey),
    ).toBe(true)
    expect(
      matches(row, f('and', { column: 'category', op: 'no_es', value: 'Removible' }), byKey),
    ).toBe(false)
    expect(matches(row, f('and', { column: 'name', op: 'empieza', value: 'pro' }), byKey)).toBe(
      true,
    )
  })
  it('mayor / menor / entre sobre números', () => {
    expect(matches(row, f('and', { column: 'days', op: 'mayor', value: '10' }), byKey)).toBe(true)
    expect(matches(row, f('and', { column: 'days', op: 'menor', value: '10' }), byKey)).toBe(false)
    expect(matches(row, f('and', { column: 'days', op: 'entre', value: '10,15' }), byKey)).toBe(
      true,
    )
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
        byKey,
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
        byKey,
      ),
    ).toBe(true)
    expect(matches(row, f('and'), byKey)).toBe(true)
  })

  it('resuelve columnas con accessor derivado (id distinto del campo crudo) vía el resolver', () => {
    // Caso real de productos: `category` es un objeto `{ id, name }` en la fila cruda, y la
    // columna `days` tiene `id: 'days'` pero el campo crudo es `turnaroundDays`. Antes de pasar el
    // resolver, `matches` leía `row[c.column]` directo: `category` comparaba contra el objeto
    // completo y `days` siempre daba `undefined` (mayor/menor/entre = 0 resultados, no_es = falso
    // positivo con TODO).
    const product = {
      name: 'Zirconio',
      category: { id: 'c1', name: 'Prótesis fija' },
      turnaroundDays: 5,
    }
    const getValue = (r: unknown, columnId: string): unknown => {
      const p = r as typeof product
      if (columnId === 'category') return p.category.name
      if (columnId === 'days') return p.turnaroundDays
      return (p as unknown as Record<string, unknown>)[columnId]
    }
    expect(
      matches(product, f('and', { column: 'name', op: 'contiene', value: 'zirconio' }), getValue),
    ).toBe(true)
    expect(matches(product, f('and', { column: 'days', op: 'mayor', value: '3' }), getValue)).toBe(
      true,
    )
    expect(
      matches(
        product,
        f('and', { column: 'category', op: 'no_es', value: 'Prótesis removible' }),
        getValue,
      ),
    ).toBe(true)
  })
})
