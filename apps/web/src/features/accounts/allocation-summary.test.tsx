import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AllocationSummary } from './allocation-summary'

describe('AllocationSummary (lo aplicado del reparto, en vivo)', () => {
  it('dice lo aplicado y lo que queda a favor', () => {
    render(
      <AllocationSummary
        allocatedCents={8000}
        leftCents={2000}
        leftLabel="Queda a favor"
        overLabel="Supera el pago en"
      />,
    )
    expect(screen.getByRole('status')).toHaveTextContent('Aplicado $ 80.00 · Queda a favor $ 20.00')
    expect(screen.getByRole('status')).not.toHaveClass('text-destructive')
  })

  it('si se aplica de más, lo dice en destructivo y con texto', () => {
    render(
      <AllocationSummary
        allocatedCents={2000}
        leftCents={-1000}
        leftLabel="Queda a favor"
        overLabel="Supera el pago en"
      />,
    )
    expect(screen.getByRole('status')).toHaveTextContent(
      'Aplicado $ 20.00 · Supera el pago en $ 10.00',
    )
    expect(screen.getByRole('status')).toHaveClass('text-destructive')
  })

  it('sin monto del que repartir, solo lo aplicado', () => {
    render(
      <AllocationSummary
        allocatedCents={3000}
        leftCents={null}
        leftLabel="Queda a favor"
        overLabel="Supera el pago en"
      />,
    )
    expect(screen.getByRole('status')).toHaveTextContent(/^Aplicado \$ 30\.00$/)
  })

  it('el error del total va con él', () => {
    render(
      <AllocationSummary
        allocatedCents={3000}
        leftCents={-1000}
        leftLabel="Queda a favor"
        overLabel="Supera el pago en"
        error="Lo aplicado no puede superar el monto del pago"
      />,
    )
    expect(screen.getByText('Lo aplicado no puede superar el monto del pago')).toBeInTheDocument()
  })
})
