import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ClinicAccount } from './api'
import { BalanceBreakdown } from './balance-breakdown'

type Breakdown = ClinicAccount['breakdown']

const breakdown = (over: Partial<Breakdown> = {}): Breakdown => ({
  openCases: '550.50',
  unlinkedAdjustments: '0.00',
  unlinkedSince: null,
  credit: '0.00',
  balance: '550.50',
  ...over,
})

/** Cada línea del desglose como «rótulo → monto», en el orden en que se lee. */
function lines() {
  const list = screen.getByLabelText('Desglose del saldo')
  const terms = within(list).getAllByRole('term')
  const values = within(list).getAllByRole('definition')
  return terms.map((t, i) => [t.textContent, values[i]?.textContent])
}

describe('BalanceBreakdown (UX5-02: de qué se compone el saldo)', () => {
  it('con todo: trabajos, saldo inicial y ajustes sin trabajo desde su fecha, saldo a favor y saldo', () => {
    render(
      <BalanceBreakdown
        breakdown={breakdown({
          unlinkedAdjustments: '245.00',
          unlinkedSince: '2026-08-01',
          credit: '69.50',
          balance: '726.00',
        })}
      />,
    )
    expect(lines()).toEqual([
      ['Trabajos', '$ 550.50'],
      ['Saldo inicial y ajustes sin trabajo(desde el 01/08/2026)', '$ 245.00'],
      ['Saldo a favor', '− $ 69.50'],
      ['Saldo', '$ 726.00'],
    ])
    expect(screen.getByText('$ 550.50')).toHaveClass('font-mono')
    expect(screen.getByText('− $ 69.50')).toHaveClass('font-mono')
  })

  it('sin ajustes sin trabajo ni saldo a favor, solo trabajos y saldo', () => {
    render(<BalanceBreakdown breakdown={breakdown()} />)
    expect(lines()).toEqual([
      ['Trabajos', '$ 550.50'],
      ['Saldo', '$ 550.50'],
    ])
  })

  it('ajustes sin trabajo que restan llevan su signo', () => {
    render(
      <BalanceBreakdown
        breakdown={breakdown({
          unlinkedAdjustments: '-30.00',
          unlinkedSince: '2026-09-15',
          balance: '520.50',
        })}
      />,
    )
    expect(lines()[1]).toEqual([
      'Saldo inicial y ajustes sin trabajo(desde el 15/09/2026)',
      '− $ 30.00',
    ])
  })

  it('un saldo negativo se lee «A favor», con texto', () => {
    render(
      <BalanceBreakdown
        breakdown={breakdown({ openCases: '0.00', credit: '10.00', balance: '-10.00' })}
      />,
    )
    expect(lines()).toEqual([
      ['Trabajos', '$ 0.00'],
      ['Saldo a favor', '− $ 10.00'],
      ['Saldo', 'A favor $ 10.00'],
    ])
  })

  it('sin nada que desglosar no pinta nada', () => {
    const { container } = render(
      <BalanceBreakdown breakdown={breakdown({ openCases: '0.00', balance: '0.00' })} />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
