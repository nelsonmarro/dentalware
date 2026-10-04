import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithQueryAndRouter } from '@/test/render'
import type { DeliveryItem } from './api'
import { DeliveriesDay } from './deliveries-day'

const { fetchDeliveries, failDelivery, postCaseAction } = vi.hoisted(() => ({
  fetchDeliveries: vi.fn(),
  failDelivery: vi.fn(),
  postCaseAction: vi.fn(),
}))
vi.mock('./api', () => ({ fetchDeliveries, failDelivery, fetchCouriers: vi.fn() }))
vi.mock('@/features/cases/api', () => ({ postCaseAction }))

function entrega(over: Partial<DeliveryItem> = {}): DeliveryItem {
  return {
    id: 'd1',
    type: 'entrega',
    status: 'pendiente',
    scheduledFor: '2026-10-03',
    doneAt: null,
    failedReason: null,
    case: {
      id: 'c1',
      code: '26-00001',
      patientRef: 'Juan P.',
      status: 'enviado',
      priority: 'normal',
    },
    clinic: {
      id: 'k1',
      name: 'Clínica Sonrisa',
      address: 'Av. Amazonas N34-120, Quito',
      phone: '099 123 4567',
    },
    courier: { id: 'm1', name: 'Mario Mensajero' },
    ...over,
  }
}

const clinica = (id: string, name: string) => ({ id, name, address: null, phone: null })

beforeEach(() => {
  fetchDeliveries.mockReset()
  failDelivery.mockReset()
  postCaseAction.mockReset()
  // Sábado 2026-10-03, mediodía local: «hoy» de las pruebas de «Atrasada».
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-03T12:00:00'))
})
afterEach(() => {
  vi.useRealTimers()
})

describe('DeliveriesDay', () => {
  it('pide las entregas del día y del mensajero elegido', async () => {
    fetchDeliveries.mockResolvedValue([])
    renderWithQueryAndRouter(
      <DeliveriesDay day="2026-10-05" courierId="m1" role="admin" userId="a1" />,
    )
    await waitFor(() =>
      expect(fetchDeliveries).toHaveBeenCalledWith({ dia: '2026-10-05', mensajeroId: 'm1' }),
    )
  })

  it('agrupa por clínica en orden alfabético', async () => {
    fetchDeliveries.mockResolvedValue([
      entrega({ id: 'd1', clinic: clinica('k1', 'Odonto Norte') }),
      entrega({ id: 'd2', clinic: clinica('k2', 'Bella Dental') }),
      entrega({ id: 'd3', clinic: clinica('k3', 'Clínica Sonrisa') }),
      entrega({ id: 'd4', clinic: clinica('k2', 'Bella Dental') }),
    ])
    renderWithQueryAndRouter(<DeliveriesDay day="2026-10-03" role="admin" userId="a1" />)

    await screen.findByRole('region', { name: 'Bella Dental' })
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Bella Dental',
      'Clínica Sonrisa',
      'Odonto Norte',
    ])
    const bella = screen.getByRole('region', { name: 'Bella Dental' })
    expect(within(bella).getAllByRole('listitem')).toHaveLength(2)
  })

  it('enlaza el teléfono con tel: y la dirección con el mapa en otra pestaña', async () => {
    fetchDeliveries.mockResolvedValue([entrega()])
    renderWithQueryAndRouter(<DeliveriesDay day="2026-10-03" role="mensajero" userId="m1" />)

    const grupo = await screen.findByRole('region', { name: 'Clínica Sonrisa' })
    const tel = within(grupo).getByRole('link', { name: /099 123 4567/ })
    expect(tel).toHaveAttribute('href', 'tel:0991234567')
    const mapa = within(grupo).getByRole('link', { name: /Av\. Amazonas N34-120, Quito/ })
    expect(mapa).toHaveAttribute(
      'href',
      'https://www.google.com/maps/search/?api=1&query=Av.%20Amazonas%20N34-120%2C%20Quito',
    )
    expect(mapa).toHaveAttribute('target', '_blank')
    expect(mapa).toHaveAttribute('rel', 'noreferrer')
  })

  it('cada tarjeta dice el tipo con texto, enlaza el código a la ficha corta y muestra el paciente', async () => {
    fetchDeliveries.mockResolvedValue([entrega()])
    renderWithQueryAndRouter(<DeliveriesDay day="2026-10-03" role="mensajero" userId="m1" />)

    const tarjeta = await screen.findByRole('listitem')
    expect(within(tarjeta).getByText('Entrega')).toBeInTheDocument()
    expect(within(tarjeta).getByRole('link', { name: '26-00001' })).toHaveAttribute(
      'href',
      '/t/26-00001',
    )
    expect(within(tarjeta).getByText('Juan P.')).toBeInTheDocument()
  })

  it('un trabajo urgente lo dice con texto', async () => {
    fetchDeliveries.mockResolvedValue([
      entrega({ case: { ...entrega().case, priority: 'urgente' } }),
    ])
    renderWithQueryAndRouter(<DeliveriesDay day="2026-10-03" role="mensajero" userId="m1" />)
    expect(await screen.findByText('Urgente')).toBeInTheDocument()
  })

  it('una recogida pendiente ofrece «Recibido» (se envía al primer toque) y «No se pudo»', async () => {
    fetchDeliveries.mockResolvedValue([
      entrega({
        type: 'recogida',
        case: { ...entrega().case, id: 'c9', status: 'por_recoger' },
      }),
    ])
    postCaseAction.mockResolvedValue({})
    const { user } = renderWithQueryAndRouter(
      <DeliveriesDay day="2026-10-03" role="mensajero" userId="m1" />,
    )

    const tarjeta = await screen.findByRole('listitem')
    expect(within(tarjeta).getByText('Recogida')).toBeInTheDocument()
    expect(within(tarjeta).getByRole('button', { name: 'No se pudo' })).toBeInTheDocument()
    expect(
      within(tarjeta).queryByRole('button', { name: 'Marcar entregado' }),
    ).not.toBeInTheDocument()
    await user.click(within(tarjeta).getByRole('button', { name: 'Recibido' }))
    await waitFor(() =>
      expect(postCaseAction).toHaveBeenCalledWith('c9', { accion: 'recibir', motivo: null }),
    )
  })

  it('una entrega pendiente ofrece «Marcar entregado», que abre el diálogo de la constancia', async () => {
    fetchDeliveries.mockResolvedValue([entrega()])
    const { user } = renderWithQueryAndRouter(
      <DeliveriesDay day="2026-10-03" role="mensajero" userId="m1" />,
    )

    const tarjeta = await screen.findByRole('listitem')
    expect(within(tarjeta).queryByRole('button', { name: 'Recibido' })).not.toBeInTheDocument()
    await user.click(within(tarjeta).getByRole('button', { name: 'Marcar entregado' }))
    const dialog = await screen.findByRole('dialog', { name: 'Marcar entregado' })
    expect(
      within(dialog).getByRole('button', { name: 'Tomar foto de constancia' }),
    ).toBeInTheDocument()
    expect(postCaseAction).not.toHaveBeenCalled()
  })

  // M-3 (revisión de la Tarea 7): la tarjeta usa la misma regla que la API y la ficha
  // (`canActOnDelivery`): a un mensajero no se le ofrece cerrar una entrega ajena.
  it('a un mensajero no le ofrece las acciones de una entrega asignada a otro', async () => {
    fetchDeliveries.mockResolvedValue([entrega({ courier: { id: 'm2', name: 'Otro Mensajero' } })])
    renderWithQueryAndRouter(<DeliveriesDay day="2026-10-03" role="mensajero" userId="m1" />)

    const tarjeta = await screen.findByRole('listitem')
    expect(within(tarjeta).queryByRole('button')).not.toBeInTheDocument()
  })

  it('recepción sí actúa sobre la entrega de cualquier mensajero', async () => {
    fetchDeliveries.mockResolvedValue([entrega({ courier: { id: 'm2', name: 'Otro Mensajero' } })])
    renderWithQueryAndRouter(<DeliveriesDay day="2026-10-03" role="recepcion" userId="r1" />)

    const tarjeta = await screen.findByRole('listitem')
    expect(within(tarjeta).getByRole('button', { name: 'Marcar entregado' })).toBeInTheDocument()
    expect(within(tarjeta).getByRole('button', { name: 'No se pudo' })).toBeInTheDocument()
  })

  it('«No se pudo» abre el diálogo de motivo y nueva fecha', async () => {
    fetchDeliveries.mockResolvedValue([entrega()])
    const { user } = renderWithQueryAndRouter(
      <DeliveriesDay day="2026-10-03" role="mensajero" userId="m1" />,
    )

    await user.click(await screen.findByRole('button', { name: 'No se pudo' }))
    const dialog = await screen.findByRole('dialog', { name: 'No se pudo entregar' })
    expect(within(dialog).getByLabelText('Motivo')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Nueva fecha')).toBeInTheDocument()
  })

  it('una entrega hecha va al final de su grupo, con su estado y sin acciones', async () => {
    fetchDeliveries.mockResolvedValue([
      entrega({
        id: 'd1',
        status: 'hecha',
        doneAt: '2026-10-03T15:00:00.000Z',
        case: { ...entrega().case, code: '26-00001', status: 'entregado' },
      }),
      entrega({ id: 'd2', case: { ...entrega().case, id: 'c2', code: '26-00002' } }),
    ])
    renderWithQueryAndRouter(<DeliveriesDay day="2026-10-03" role="mensajero" userId="m1" />)

    await screen.findByRole('region', { name: 'Clínica Sonrisa' })
    const [primera, segunda] = screen.getAllByRole('listitem')
    expect(within(primera!).getByRole('link', { name: '26-00002' })).toBeInTheDocument()
    expect(within(segunda!).getByText('Hecha')).toBeInTheDocument()
    expect(within(segunda!).queryByRole('button')).not.toBeInTheDocument()
  })

  it('una fallida dice su motivo y no se puede volver a marcar', async () => {
    fetchDeliveries.mockResolvedValue([
      entrega({ status: 'fallida', failedReason: 'Clínica cerrada' }),
    ])
    renderWithQueryAndRouter(<DeliveriesDay day="2026-10-03" role="mensajero" userId="m1" />)

    const tarjeta = await screen.findByRole('listitem')
    expect(within(tarjeta).getByText('Fallida')).toBeInTheDocument()
    expect(within(tarjeta).getByText(/Clínica cerrada/)).toBeInTheDocument()
    expect(within(tarjeta).queryByRole('button')).not.toBeInTheDocument()
  })

  // Ruling de la Tarea 6: al cancelar el trabajo su entrega queda `fallida` con «Trabajo
  // cancelado: …». Se ve como cancelada, sin acciones ni «No se pudo», y nunca como atrasada.
  it('la entrega de un trabajo cancelado se ve «Cancelado», sin acciones ni «Atrasada»', async () => {
    fetchDeliveries.mockResolvedValue([
      entrega({
        status: 'fallida',
        scheduledFor: '2026-10-01',
        failedReason: 'Trabajo cancelado: la clínica lo anuló',
        case: { ...entrega().case, status: 'cancelado' },
      }),
    ])
    renderWithQueryAndRouter(<DeliveriesDay day="2026-10-03" role="mensajero" userId="m1" />)

    const tarjeta = await screen.findByRole('listitem')
    expect(within(tarjeta).getByText('Cancelado')).toBeInTheDocument()
    expect(within(tarjeta).queryByText('Fallida')).not.toBeInTheDocument()
    expect(within(tarjeta).queryByText('Atrasada')).not.toBeInTheDocument()
    expect(within(tarjeta).queryByRole('button')).not.toBeInTheDocument()
  })

  it('una pendiente de ayer se marca «Atrasada»; la de hoy no', async () => {
    fetchDeliveries.mockResolvedValue([
      entrega({
        id: 'd1',
        scheduledFor: '2026-10-02',
        case: { ...entrega().case, code: '26-00001' },
      }),
      entrega({
        id: 'd2',
        scheduledFor: '2026-10-03',
        case: { ...entrega().case, id: 'c2', code: '26-00002' },
      }),
    ])
    renderWithQueryAndRouter(<DeliveriesDay day="2026-10-03" role="mensajero" userId="m1" />)

    const ayer = (await screen.findByRole('link', { name: '26-00001' })).closest('li')!
    const hoy = screen.getByRole('link', { name: '26-00002' }).closest('li')!
    expect(within(ayer).getByText('Atrasada')).toBeInTheDocument()
    expect(within(hoy).queryByText('Atrasada')).not.toBeInTheDocument()
  })

  it('sin entregas lo dice', async () => {
    fetchDeliveries.mockResolvedValue([])
    renderWithQueryAndRouter(<DeliveriesDay day="2026-10-05" role="admin" userId="a1" />)
    expect(await screen.findByText('No hay entregas ni recogidas este día.')).toBeInTheDocument()
  })

  it('al mensajero, hoy sin entregas, le habla a él', async () => {
    fetchDeliveries.mockResolvedValue([])
    renderWithQueryAndRouter(<DeliveriesDay day="2026-10-03" role="mensajero" userId="m1" />)
    expect(await screen.findByText('No tienes entregas hoy')).toBeInTheDocument()
  })

  it('un fallo al cargar no se muestra como vacío: ofrece reintentar', async () => {
    fetchDeliveries.mockRejectedValue(new TypeError('Failed to fetch'))
    renderWithQueryAndRouter(<DeliveriesDay day="2026-10-03" role="mensajero" userId="m1" />)
    expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    expect(screen.queryByText('No tienes entregas hoy')).not.toBeInTheDocument()
  })
})
