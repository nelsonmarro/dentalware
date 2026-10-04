import { describe, expect, it } from 'vitest'
import { parseDeliveriesSearch } from './deliveries-search'

describe('parseDeliveriesSearch', () => {
  it('conserva el día y el mensajero válidos', () => {
    expect(parseDeliveriesSearch({ dia: '2026-10-05', mensajeroId: 'm1' })).toEqual({
      dia: '2026-10-05',
      mensajeroId: 'm1',
    })
  })

  it('un día inválido se descarta sin perder el mensajero', () => {
    expect(parseDeliveriesSearch({ dia: '2026-02-30', mensajeroId: 'm1' })).toEqual({
      mensajeroId: 'm1',
    })
  })

  it('sin parámetros, o con basura, queda vacío', () => {
    expect(parseDeliveriesSearch({})).toEqual({})
    expect(parseDeliveriesSearch({ dia: 7, mensajeroId: '' })).toEqual({})
  })
})
