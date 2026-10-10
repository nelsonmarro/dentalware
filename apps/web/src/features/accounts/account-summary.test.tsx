import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AccountSummary } from './account-summary'

const zero = { '0_30': '0.00', '31_60': '0.00', '61_90': '0.00', '90_mas': '0.00' }

type Props = Parameters<typeof AccountSummary>[0]
const summary = (over: Partial<Props>) => {
  render(
    <AccountSummary
      balance="0.00"
      credit="0.00"
      openCasesTotal="0.00"
      openCasesCount={0}
      aging={zero}
      oldestDays={null}
      {...over}
    />,
  )
  return screen.getByRole('region', { name: 'Saldo' })
}

describe('AccountSummary (UX5-01: una sola lectura del saldo)', () => {
  it('a favor neto: «A favor» una sola vez, y los trabajos por cobrar que cubre', () => {
    // Clínica Sur: pago de $ 200 sin aplicar y un trabajo de $ 75 por cobrar.
    const saldo = summary({
      balance: '-125.00',
      credit: '200.00',
      openCasesTotal: '75.00',
      openCasesCount: 1,
    })
    expect(saldo).toHaveTextContent('A favor $ 125.00')
    expect(saldo).toHaveTextContent('1 trabajo por cobrar ($ 75.00), cubierto por el saldo a favor')
    expect(saldo).not.toHaveTextContent('Nada pendiente')
    expect(saldo).not.toHaveTextContent('$ 200.00')
    expect(saldo).not.toHaveTextContent('Ya descuenta')
    expect(screen.getAllByText('A favor')).toHaveLength(1)
  })

  it('debe con saldo a favor sin aplicar: el saldo ya lo descuenta, en una línea', () => {
    // Clínica Norte.
    const saldo = summary({
      balance: '245.50',
      credit: '69.50',
      openCasesTotal: '10.00',
      openCasesCount: 1,
      aging: { ...zero, '90_mas': '245.50' },
      oldestDays: 131,
    })
    expect(saldo).toHaveTextContent('$ 245.50')
    expect(saldo).toHaveTextContent('Ya descuenta $ 69.50 a favor sin aplicar')
    expect(saldo).toHaveTextContent('Más antiguo: 131 días')
    expect(saldo).not.toHaveTextContent('Saldo a favor')
    expect(screen.queryByText('A favor')).not.toBeInTheDocument()
  })

  it('debe sin saldo a favor: solo el saldo y lo más antiguo', () => {
    const saldo = summary({
      balance: '90.00',
      openCasesTotal: '90.00',
      openCasesCount: 1,
      aging: { ...zero, '31_60': '90.00' },
      oldestDays: 37,
    })
    expect(saldo).toHaveTextContent('$ 90.00')
    expect(saldo).toHaveTextContent('Más antiguo: 37 días')
    expect(saldo).not.toHaveTextContent('a favor')
  })

  it('en cero y sin nada por cobrar: nada pendiente', () => {
    const saldo = summary({})
    expect(saldo).toHaveTextContent('$ 0.00')
    expect(saldo).toHaveTextContent('Nada pendiente')
    expect(saldo).not.toHaveTextContent('a favor')
  })
})
