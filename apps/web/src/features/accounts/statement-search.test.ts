import { describe, expect, it } from 'vitest'
import { parseStatementSearch, statementRange } from './statement-search'

describe('parseStatementSearch (search de /cuentas/$clinicaId/estado)', () => {
  it('acepta desde y hasta como fechas YYYY-MM-DD', () => {
    expect(parseStatementSearch({ desde: '2026-09-01', hasta: '2026-09-30' })).toEqual({
      desde: '2026-09-01',
      hasta: '2026-09-30',
    })
  })

  it('descarta cada fecha no válida por separado, sin romper la pantalla', () => {
    expect(parseStatementSearch({ desde: 'ayer', hasta: '2026-09-30' })).toEqual({
      hasta: '2026-09-30',
    })
    expect(parseStatementSearch({ desde: '2026-09-01', hasta: 20260930 })).toEqual({
      desde: '2026-09-01',
    })
    expect(parseStatementSearch({ desde: '2026-02-30' })).toEqual({})
    expect(parseStatementSearch('basura')).toEqual({})
  })
})

describe('statementRange (rango del estado de cuenta)', () => {
  const TODAY = '2026-10-09'

  it('por omisión, el mes en curso: del día 1 a hoy', () => {
    expect(statementRange({}, TODAY)).toEqual({ desde: '2026-10-01', hasta: '2026-10-09' })
  })

  it('con las dos fechas, las de la URL', () => {
    expect(statementRange({ desde: '2026-08-15', hasta: '2026-09-30' }, TODAY)).toEqual({
      desde: '2026-08-15',
      hasta: '2026-09-30',
    })
  })

  it('solo hasta: desde el día 1 de ese mes', () => {
    expect(statementRange({ hasta: '2026-09-20' }, TODAY)).toEqual({
      desde: '2026-09-01',
      hasta: '2026-09-20',
    })
  })

  it('solo desde: hasta hoy', () => {
    expect(statementRange({ desde: '2026-07-01' }, TODAY)).toEqual({
      desde: '2026-07-01',
      hasta: '2026-10-09',
    })
  })

  it('desde posterior a hasta: vuelve al mes en curso', () => {
    expect(statementRange({ desde: '2026-10-05', hasta: '2026-10-01' }, TODAY)).toEqual({
      desde: '2026-10-01',
      hasta: '2026-10-09',
    })
    expect(statementRange({ desde: '2026-12-01' }, TODAY)).toEqual({
      desde: '2026-10-01',
      hasta: '2026-10-09',
    })
  })

  // I-2: la API responde 422 con una fecha final posterior a hoy. Un enlace viejo o escrito a
  // mano no rompe la pantalla: el rango se corta en hoy.
  it('una fecha final posterior a hoy se corta en hoy', () => {
    expect(statementRange({ desde: '2026-10-01', hasta: '2026-10-31' }, TODAY)).toEqual({
      desde: '2026-10-01',
      hasta: '2026-10-09',
    })
    expect(statementRange({ hasta: '2026-11-15' }, TODAY)).toEqual({
      desde: '2026-10-01',
      hasta: '2026-10-09',
    })
  })
})
