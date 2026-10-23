import { describe, expect, it } from 'vitest'
import { recorte } from './recorte'

const ventana = { width: 412, height: 839 }

describe('recorte', () => {
  it('suma el margen por los cuatro lados', () => {
    expect(recorte({ x: 16, y: 73, width: 380, height: 592 }, ventana, 16)).toEqual({
      x: 0,
      y: 57,
      width: 412,
      height: 624,
    })
  })

  it('lanza si el elemento más el margen no cabe a lo ancho', () => {
    expect(() => recorte({ x: 8, y: 100, width: 380, height: 100 }, ventana, 16)).toThrow(
      'La captura con margen 16 no cabe en la ventana (412×839): el elemento mide 380×100 en (8, 100).',
    )
  })

  it('lanza si el elemento más el margen no cabe a lo alto', () => {
    expect(() => recorte({ x: 16, y: 100, width: 380, height: 730 }, ventana, 16)).toThrow(
      'no cabe en la ventana',
    )
  })

  it('tolera medio píxel de redondeo en los bordes', () => {
    expect(recorte({ x: 15.6, y: 16, width: 380.8, height: 100 }, ventana, 16)).toEqual({
      x: 0,
      y: 0,
      width: 412,
      height: 132,
    })
  })
})
