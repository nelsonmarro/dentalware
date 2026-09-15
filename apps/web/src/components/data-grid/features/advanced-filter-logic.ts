import { normalize } from '../lib/normalize'

export type Operator = 'contiene' | 'es' | 'no_es' | 'empieza' | 'mayor' | 'menor' | 'entre'
export type Condition = { column: string; op: Operator; value: string }
export type AdvancedFilter = { logic: 'and' | 'or'; conditions: Condition[] }

export const OPERATOR_LABEL: Record<Operator, string> = {
  contiene: 'contiene',
  es: 'es',
  no_es: 'no es',
  empieza: 'empieza con',
  mayor: 'mayor que',
  menor: 'menor que',
  entre: 'entre',
}
export const TEXT_OPERATORS: Operator[] = ['contiene', 'es', 'no_es', 'empieza']
export const NUMBER_OPERATORS: Operator[] = ['es', 'no_es', 'mayor', 'menor', 'entre']

function matchesOne(cell: unknown, c: Condition): boolean {
  const text = normalize(cell)
  const wanted = normalize(c.value)
  switch (c.op) {
    case 'contiene':
      return text.includes(wanted)
    case 'es':
      return text === wanted
    case 'no_es':
      return text !== wanted
    case 'empieza':
      return text.startsWith(wanted)
    case 'mayor':
      return Number(cell) > Number(c.value)
    case 'menor':
      return Number(cell) < Number(c.value)
    case 'entre': {
      const [a, b] = c.value.split(',').map(Number)
      const n = Number(cell)
      return a !== undefined && b !== undefined && n >= a && n <= b
    }
  }
}

/**
 * Evalúa todas las condiciones con AND u OR; sin condiciones, la fila pasa. `getValue` resuelve el
 * valor de la fila para el id de columna de cada condición: `matches` no indexa la fila cruda
 * directamente (`row[c.column]`) porque el id de una columna no siempre coincide con el nombre del
 * campo crudo (accessor derivado, p. ej. `category` → `row.category.name`, o un `id` explícito
 * distinto del campo, p. ej. `days` → `row.turnaroundDays`) — ver `use-data-grid.ts:buildRowValueResolver`,
 * que arma este resolver desde las definiciones de columna.
 */
export function matches(
  row: unknown,
  filter: AdvancedFilter,
  getValue: (row: unknown, columnId: string) => unknown,
): boolean {
  if (filter.conditions.length === 0) return true
  const results = filter.conditions.map((c) => matchesOne(getValue(row, c.column), c))
  return filter.logic === 'and' ? results.every(Boolean) : results.some(Boolean)
}
