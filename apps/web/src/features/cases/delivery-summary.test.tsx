import { toIsoDate } from '@dentalware/shared'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DeliverySummary } from './delivery-summary'

const hoy = toIsoDate(new Date())

// UX4-09: la ficha completa dice con quién sale, para cuándo y quién lo entregó, sin abrir el
// historial cuando llama la clínica.
describe('DeliverySummary', () => {
  it('una recogida pendiente dice para cuándo y con quién', () => {
    render(
      <DeliverySummary
        pending={{
          id: 'd1',
          type: 'recogida',
          courierId: 'm1',
          courierName: 'Mario',
          scheduledFor: hoy,
        }}
        lastDelivered={null}
      />,
    )
    expect(screen.getByText('Recogida programada para hoy con Mario')).toBeInTheDocument()
  })

  it('una entrega pendiente dice cuándo sale y con quién', () => {
    render(
      <DeliverySummary
        pending={{
          id: 'd1',
          type: 'entrega',
          courierId: 'm1',
          courierName: 'Mario',
          scheduledFor: '2999-10-09',
        }}
        lastDelivered={null}
      />,
    )
    expect(screen.getByText('Sale el 09/10/2999 con Mario')).toBeInTheDocument()
  })

  it('lo entregado dice cuándo, quién y enlaza la constancia', () => {
    render(
      <DeliverySummary
        pending={null}
        lastDelivered={{
          doneAt: '2026-10-04T15:00:00.000Z',
          courierName: 'Mario',
          proofAttachmentId: 'a1',
        }}
      />,
    )
    expect(screen.getByText('Entregado el 04/10/2026 por Mario')).toBeInTheDocument()
    const link = screen.getByRole('link', { name: 'Ver constancia' })
    expect(link).toHaveAttribute('href', '/api/adjuntos/a1')
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('lo entregado sin constancia no deja un enlace roto', () => {
    render(
      <DeliverySummary
        pending={null}
        lastDelivered={{
          doneAt: '2026-10-04T15:00:00.000Z',
          courierName: 'Mario',
          proofAttachmentId: null,
        }}
      />,
    )
    expect(screen.getByText('Entregado el 04/10/2026 por Mario')).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('sin entrega pendiente ni hecha no monta nada', () => {
    const { container } = render(<DeliverySummary pending={null} lastDelivered={null} />)
    expect(container).toBeEmptyDOMElement()
  })
})
