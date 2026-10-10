import { describe, expect, it } from 'vitest'
import { adjustmentDoneText, creditDoneText, paymentDoneText } from './account-done'

const uno = [{ id: 't1', code: '26-00101' }]
const dos = [...uno, { id: 't2', code: '26-00102' }]
const tres = [...dos, { id: 't3', code: '26-00103' }]

describe('paymentDoneText (aviso de «Registrar pago», UX5-04)', () => {
  it('sin trabajos cerrados ni saldo a favor', () => {
    expect(paymentDoneText([], '0.00')).toBe('Pago registrado')
  })

  it('sin trabajos cerrados, con lo que quedó a favor', () => {
    expect(paymentDoneText([], '69.50')).toBe('Pago registrado · $ 69.50 a favor')
  })

  it('nombra el trabajo que cerró', () => {
    expect(paymentDoneText(uno, '0.00')).toBe('Pago registrado: cobrado 26-00101')
  })

  it('nombra los que cerró en una lista con «y», y lo que quedó a favor', () => {
    expect(paymentDoneText(dos, '69.50')).toBe(
      'Pago registrado: cobrados 26-00101 y 26-00102 · $ 69.50 a favor',
    )
    expect(paymentDoneText(tres, '0.00')).toBe(
      'Pago registrado: cobrados 26-00101, 26-00102 y 26-00103',
    )
  })
})

describe('creditDoneText (aviso de «Aplicar saldo a favor», UX5-04)', () => {
  it('sin trabajos cerrados', () => {
    expect(creditDoneText([])).toBe('Saldo a favor aplicado')
  })

  it('nombra el trabajo o los trabajos que cerró', () => {
    expect(creditDoneText(uno)).toBe('Saldo a favor aplicado: cobrado 26-00101')
    expect(creditDoneText(tres)).toBe(
      'Saldo a favor aplicado: cobrados 26-00101, 26-00102 y 26-00103',
    )
  })
})

describe('adjustmentDoneText (aviso de «Registrar ajuste»)', () => {
  it('dice lo que volvió al saldo a favor, si algo', () => {
    expect(adjustmentDoneText('10.00')).toBe('Ajuste registrado: $ 10.00 vuelven al saldo a favor')
    expect(adjustmentDoneText('0.00')).toBe('Ajuste registrado')
  })
})
