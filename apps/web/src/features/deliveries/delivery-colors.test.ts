import { describe, expect, it } from 'vitest'
import { DELIVERY_OUTCOME_COLOR, DELIVERY_TYPE_COLOR } from './delivery-colors'

// M-2 de la revisión de la Tarea 9: «Anulada» no comparte el rojo de «Fallida» (UX4-17). Valores
// literales: los mismos de `STATUS_COLOR`, con su contraste AA probado en `status-chip.test.tsx`.
describe('colores de entregas', () => {
  it('cada resultado tiene su color: hecha verde, fallida roja y anulada gris', () => {
    expect(DELIVERY_OUTCOME_COLOR).toEqual({
      hecha: '#27764B',
      fallida: '#B3261E',
      anulada: '#52606D',
    })
  })

  it('la recogida va en gris y la entrega en azul', () => {
    expect(DELIVERY_TYPE_COLOR).toEqual({ recogida: '#52606D', entrega: '#2D6BAA' })
  })
})
