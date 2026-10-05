import { describe, expect, it } from 'vitest'
import { isForeignKeyViolation } from './pg-errors.ts'

// Drizzle envuelve el error de `pg` en `cause`; la forma de abajo es la que llega en runtime.
const drizzleError = (cause: unknown) => new Error('Failed query', { cause })

describe('db/pg-errors', () => {
  it('reconoce la violación de la FK indicada', () => {
    const e = drizzleError({ code: '23503', constraint: 'mi_fkey' })
    expect(isForeignKeyViolation(e, 'mi_fkey')).toBe(true)
  })

  it('no reconoce la violación de otra FK', () => {
    const e = drizzleError({ code: '23503', constraint: 'otra_fkey' })
    expect(isForeignKeyViolation(e, 'mi_fkey')).toBe(false)
  })

  it('no reconoce otro error de Postgres con la misma constraint', () => {
    const e = drizzleError({ code: '23505', constraint: 'mi_fkey' })
    expect(isForeignKeyViolation(e, 'mi_fkey')).toBe(false)
  })

  it('no reconoce errores sin causa de Postgres', () => {
    expect(isForeignKeyViolation(new Error('x'), 'mi_fkey')).toBe(false)
    expect(isForeignKeyViolation('23503', 'mi_fkey')).toBe(false)
  })
})
