import { describe, expect, it } from 'vitest'
import { PRINT_COPY_LABEL, printCopiesFor, printCopyShowsPrices } from './print-copies.ts'

// UX3-21: la orden se imprime en dos copias (spec §5). Los casos se escriben a mano, no se
// derivan de `PRINT_COPIES`: si la tabla cambia, el test tiene que caer.
describe('printCopiesFor', () => {
  it('admin y recepción pueden imprimir la copia laboratorio y la copia clínica', () => {
    expect(printCopiesFor('admin')).toEqual(['laboratorio', 'clinica'])
    expect(printCopiesFor('recepcion')).toEqual(['laboratorio', 'clinica'])
  })

  it('técnico y mensajero solo imprimen la copia laboratorio', () => {
    expect(printCopiesFor('tecnico')).toEqual(['laboratorio'])
    expect(printCopiesFor('mensajero')).toEqual(['laboratorio'])
  })
})

describe('printCopyShowsPrices', () => {
  it('la copia clínica lleva precios y la copia laboratorio no', () => {
    expect(printCopyShowsPrices('clinica')).toBe(true)
    expect(printCopyShowsPrices('laboratorio')).toBe(false)
  })
})

describe('PRINT_COPY_LABEL', () => {
  it('rotula cada copia como se imprime en el papel', () => {
    expect(PRINT_COPY_LABEL).toEqual({
      laboratorio: 'Copia laboratorio',
      clinica: 'Copia clínica',
    })
  })
})
