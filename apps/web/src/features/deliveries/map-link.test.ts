import { describe, expect, it } from 'vitest'
import { mapUrl, telUrl } from './map-link'

describe('mapUrl', () => {
  it('abre la búsqueda de Google Maps con la dirección codificada', () => {
    expect(mapUrl('Av. Amazonas N34-120 y Atahualpa, Quito')).toBe(
      'https://www.google.com/maps/search/?api=1&query=Av.%20Amazonas%20N34-120%20y%20Atahualpa%2C%20Quito',
    )
  })

  it('codifica las tildes y el «#» (que si no cortaría la URL)', () => {
    expect(mapUrl('Calle Simón Bolívar #12, Cuenca')).toBe(
      'https://www.google.com/maps/search/?api=1&query=Calle%20Sim%C3%B3n%20Bol%C3%ADvar%20%2312%2C%20Cuenca',
    )
  })
})

describe('telUrl', () => {
  it('quita los espacios del número', () => {
    expect(telUrl('099 123 4567')).toBe('tel:0991234567')
  })

  it('conserva el prefijo y los guiones', () => {
    expect(telUrl(' +593 2 255-1234 ')).toBe('tel:+5932255-1234')
  })
})
