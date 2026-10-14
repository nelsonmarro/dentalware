import { describe, expect, it } from 'vitest'
import { parseClinicsSearch } from './clinics-search'

describe('parseClinicsSearch (search de /configuracion/clinicas)', () => {
  it('acepta editar, volver interno y campo=whatsapp', () => {
    expect(parseClinicsSearch({ editar: 'c1', volver: '/trabajos/t1', campo: 'whatsapp' })).toEqual(
      { editar: 'c1', volver: '/trabajos/t1', campo: 'whatsapp' },
    )
  })
  it.each(['https://otro.sitio/x', '//otro.sitio', '/\\otro', ''])(
    'descarta volver=%s y conserva editar',
    (volver) => {
      expect(parseClinicsSearch({ editar: 'c1', volver })).toEqual({ editar: 'c1' })
    },
  )
  it.each(['/trabajos/t1?x=1', '/trabajos/t1#a'])(
    'descarta volver=%s (ya trae ? o #)',
    (volver) => {
      expect(parseClinicsSearch({ editar: 'c1', volver })).toEqual({ editar: 'c1' })
    },
  )
  it('descarta un campo desconocido y conserva lo demás', () => {
    expect(parseClinicsSearch({ editar: 'c1', campo: 'nombre' })).toEqual({ editar: 'c1' })
  })
  it.each(['basura', null, 7, {}])('devuelve {} con %j', (input) => {
    expect(parseClinicsSearch(input)).toEqual({})
  })
})
