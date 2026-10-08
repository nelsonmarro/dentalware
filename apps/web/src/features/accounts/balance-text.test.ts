import { describe, expect, it } from 'vitest'
import { balanceText } from './balance-text'

describe('balanceText (saldo de una clínica en «Cuentas»)', () => {
  it('lo que debe la clínica, como monto', () => {
    expect(balanceText('1250.50')).toBe('$ 1250.50')
  })

  it('un saldo negativo se dice «A favor», con el monto en positivo', () => {
    expect(balanceText('-12.34')).toBe('A favor $ 12.34')
  })

  it('saldo cero', () => {
    expect(balanceText('0.00')).toBe('$ 0.00')
  })
})
