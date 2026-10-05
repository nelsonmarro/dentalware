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
        status="por_recoger"
        lastPickedUp={null}
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
        status="por_recoger"
        lastPickedUp={null}
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
        status="por_recoger"
        lastPickedUp={null}
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
        status="por_recoger"
        lastPickedUp={null}
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
    const { container } = render(
      <DeliverySummary
        status="por_recoger"
        pending={null}
        lastDelivered={null}
        lastPickedUp={null}
      />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  // #118: recepción ve lo que viene en camino, quién lo recogió y a qué hora.
  const recogido = {
    doneAt: new Date('2026-10-05T10:32:00').toISOString(),
    courierName: 'Mario',
  }

  it('lo que viene en camino dice quién lo recogió y a qué hora', () => {
    render(
      <DeliverySummary
        status="por_recoger"
        pending={null}
        lastDelivered={null}
        lastPickedUp={recogido}
      />,
    )
    expect(
      screen.getByText('En camino al laboratorio · Recogido por Mario a las 10:32'),
    ).toBeInTheDocument()
  })

  it('ya recibido (nuevo) no dice que viene en camino', () => {
    const { container } = render(
      <DeliverySummary
        status="nuevo"
        pending={null}
        lastDelivered={null}
        lastPickedUp={recogido}
      />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
