import { describe, expect, it } from 'vitest'
import { mapPlace, mapUrl, telUrl, whatsappUrl } from './map-link'

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

describe('mapUrl con la ciudad (UX4-21)', () => {
  it('busca la dirección en su ciudad', () => {
    expect(mapUrl('Av. Amazonas N34-56', 'Quito')).toBe(
      'https://www.google.com/maps/search/?api=1&query=Av.%20Amazonas%20N34-56%2C%20Quito',
    )
  })

  it('no repite la ciudad si la dirección ya la dice', () => {
    expect(mapUrl('Av. Amazonas N34-56, quito', 'Quito')).toBe(
      'https://www.google.com/maps/search/?api=1&query=Av.%20Amazonas%20N34-56%2C%20quito',
    )
  })
})

describe('mapPlace', () => {
  // M-3 de la revisión de la Tarea 9: «ya dice la ciudad» se mira en el último tramo tras la
  // coma, no en cualquier parte: la calle o el barrio pueden llevar el nombre de la ciudad.
  it('añade la ciudad aunque la calle lleve su nombre', () => {
    expect(mapPlace('Av. Loja 12', 'Loja')).toBe('Av. Loja 12, Loja')
    expect(mapPlace('Calle Quitoloma 5, Conocoto', 'Quito')).toBe(
      'Calle Quitoloma 5, Conocoto, Quito',
    )
  })

  it('no la repite si el último tramo ya es la ciudad', () => {
    expect(mapPlace('Av. Loja 12,  loja ', 'Loja')).toBe('Av. Loja 12,  loja ')
  })

  it('une la dirección y la ciudad para nombrar el lugar', () => {
    expect(mapPlace('Av. Amazonas N34-56', 'Quito')).toBe('Av. Amazonas N34-56, Quito')
    expect(mapPlace('Av. Amazonas N34-56', null)).toBe('Av. Amazonas N34-56')
    expect(mapPlace('Av. Amazonas N34-56', '  ')).toBe('Av. Amazonas N34-56')
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

describe('whatsappUrl', () => {
  it('wa.me con el número sin «+» y el texto codificado (AVI-4)', () => {
    expect(whatsappUrl('+593991234567', 'Hola, ¿cómo están? 26-00087 #3')).toBe(
      'https://wa.me/593991234567?text=Hola%2C%20%C2%BFc%C3%B3mo%20est%C3%A1n%3F%2026-00087%20%233',
    )
  })

  it('un número guardado sin «+» se usa tal cual', () => {
    expect(whatsappUrl('593991234567', 'x')).toBe('https://wa.me/593991234567?text=x')
  })
})
