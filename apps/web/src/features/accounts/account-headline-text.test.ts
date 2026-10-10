import { describe, expect, it } from 'vitest'
import { pendingText } from './account-headline-text'

describe('pendingText (UX5-01: qué hay pendiente, bajo el saldo)', () => {
  it('nada por cobrar', () => {
    expect(pendingText({ kind: 'nada' })).toBe('Nada pendiente')
  })

  it('algo sin cubrir: lo más antiguo', () => {
    expect(pendingText({ kind: 'vencido', oldestDays: 37 })).toBe('Más antiguo: 37 días')
    expect(pendingText({ kind: 'vencido', oldestDays: 1 })).toBe('Más antiguo: 1 día')
  })

  it('trabajos por cobrar que cubre el saldo a favor', () => {
    expect(pendingText({ kind: 'cubierto', count: 1, cents: 7_500 })).toBe(
      '1 trabajo por cobrar ($ 75.00), cubierto por el saldo a favor',
    )
    expect(pendingText({ kind: 'cubierto', count: 2, cents: 15_050 })).toBe(
      '2 trabajos por cobrar ($ 150.50), cubiertos por el saldo a favor',
    )
  })

  it('trabajos por cobrar que compensan ajustes sin trabajo', () => {
    expect(pendingText({ kind: 'compensado', count: 1, cents: 7_500 })).toBe(
      '1 trabajo por cobrar ($ 75.00), compensado por ajustes sin trabajo',
    )
    expect(pendingText({ kind: 'compensado', count: 3, cents: 9_000 })).toBe(
      '3 trabajos por cobrar ($ 90.00), compensados por ajustes sin trabajo',
    )
  })
})
