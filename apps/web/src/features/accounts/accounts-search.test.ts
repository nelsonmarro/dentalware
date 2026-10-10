import { describe, expect, it } from 'vitest'
import { parseAccountsSearch } from './accounts-search'

describe('parseAccountsSearch (search de /cuentas)', () => {
  it('sin nada, solo las clínicas con saldo o movimientos', () => {
    expect(parseAccountsSearch({})).toEqual({})
  })

  it('«?todas=1» (número o texto) pide todas las clínicas', () => {
    expect(parseAccountsSearch({ todas: 1 })).toEqual({ todas: 1 })
    expect(parseAccountsSearch({ todas: '1' })).toEqual({ todas: 1 })
  })

  it('un valor desconocido se descarta sin romper la pantalla', () => {
    expect(parseAccountsSearch({ todas: 'si' })).toEqual({})
    expect(parseAccountsSearch({ todas: 0 })).toEqual({})
    expect(parseAccountsSearch('basura')).toEqual({})
  })
})
