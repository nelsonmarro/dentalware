import { onlineManager } from '@tanstack/react-query'
import { act, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api-error'
import { renderWithQueryAndRouter } from '@/test/render'
import type { DeliveryItem } from './api'
import { DeliveriesDay } from './deliveries-day'

const { fetchDeliveries, failDelivery, postCaseAction, uploadAttachment } = vi.hoisted(() => ({
  fetchDeliveries: vi.fn(),
  failDelivery: vi.fn(),
  postCaseAction: vi.fn(),
  uploadAttachment: vi.fn(),
}))
vi.mock('./api', () => ({ fetchDeliveries, failDelivery, fetchCouriers: vi.fn() }))
vi.mock('@/features/cases/api', () => ({ postCaseAction }))
vi.mock('@/features/cases/attachments-api', () => ({ uploadAttachment }))

function entrega(over: Partial<DeliveryItem> = {}): DeliveryItem {
  return {
    id: 'd1',
    type: 'entrega',
    status: 'pendiente',
    scheduledFor: '2026-10-03',
    doneAt: null,
    failedReason: null,
    rescheduledFor: null,
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
      address: 'Av. Amazonas N34-120',
      city: 'Quito',
      phone: '099 123 4567',
    },
    courier: { id: 'm1', name: 'Mario Mensajero' },
    ...over,
  }
}

const clinica = (id: string, name: string) => ({ id, name, address: null, city: null, phone: null })

beforeEach(() => {
  fetchDeliveries.mockReset()
  failDelivery.mockReset()
  postCaseAction.mockReset()
  uploadAttachment.mockReset()
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
    const mapa = within(grupo).getByRole('link', {
      name: 'Abrir en el mapa: Av. Amazonas N34-120, Quito (se abre en otra pestaña)',
    })
    expect(mapa).toHaveAttribute(
      'href',
      'https://www.google.com/maps/search/?api=1&query=Av.%20Amazonas%20N34-120%2C%20Quito',
    )
    expect(mapa).toHaveAttribute('target', '_blank')
    expect(mapa).toHaveAttribute('rel', 'noopener noreferrer')
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

  it('a recepción le dice el mensajero de cada tarjeta', async () => {
    fetchDeliveries.mockResolvedValue([entrega()])
    renderWithQueryAndRouter(<DeliveriesDay day="2026-10-03" role="recepcion" userId="r1" />)
    expect(await screen.findByText('Mensajero: Mario Mensajero')).toBeInTheDocument()
  })

  // UX4-20: con el filtro por mensajero puesto, repetirlo en cada tarjeta es ruido.
  it('con el filtro por mensajero no repite «Mensajero:» en cada tarjeta', async () => {
    fetchDeliveries.mockResolvedValue([entrega()])
    renderWithQueryAndRouter(
      <DeliveriesDay day="2026-10-03" courierId="m1" role="recepcion" userId="r1" />,
    )
    await screen.findByRole('listitem')
    expect(screen.queryByText(/^Mensajero:/)).not.toBeInTheDocument()
  })

  it('un trabajo urgente lo dice con texto', async () => {
    fetchDeliveries.mockResolvedValue([
      entrega({ case: { ...entrega().case, priority: 'urgente' } }),
    ])
    renderWithQueryAndRouter(<DeliveriesDay day="2026-10-03" role="mensajero" userId="m1" />)
    expect(await screen.findByText('Urgente')).toBeInTheDocument()
  })

  // UX4-10 (Nelson, 2026-10-04): «Recibido» lo marca recepción al llegar al laboratorio.
  it('al mensajero, su recogida pendiente le ofrece «No se pudo» y le dice que recepción la marca al llegar', async () => {
    fetchDeliveries.mockResolvedValue([
      entrega({
        type: 'recogida',
        case: { ...entrega().case, id: 'c9', status: 'por_recoger' },
      }),
    ])
    renderWithQueryAndRouter(<DeliveriesDay day="2026-10-03" role="mensajero" userId="m1" />)

    const tarjeta = await screen.findByRole('listitem')
    expect(within(tarjeta).getByRole('button', { name: 'No se pudo' })).toBeInTheDocument()
    expect(within(tarjeta).queryByRole('button', { name: 'Recibido' })).not.toBeInTheDocument()
    expect(
      within(tarjeta).getByText('Recepción lo marca como recibido al llegar al laboratorio.'),
    ).toBeInTheDocument()
  })

  it('a recepción, una recogida pendiente le ofrece «Recibido» (se envía al primer toque) y «No se pudo»', async () => {
    fetchDeliveries.mockResolvedValue([
      entrega({
        type: 'recogida',
        case: { ...entrega().case, id: 'c9', status: 'por_recoger' },
      }),
    ])
    postCaseAction.mockResolvedValue({})
    const { user } = renderWithQueryAndRouter(
      <DeliveriesDay day="2026-10-03" role="recepcion" userId="r1" />,
    )

    const tarjeta = await screen.findByRole('listitem')
    expect(within(tarjeta).getByText('Recogida')).toBeInTheDocument()
    expect(within(tarjeta).getByRole('button', { name: 'No se pudo' })).toBeInTheDocument()
    expect(
      within(tarjeta).queryByRole('button', { name: 'Marcar entregado' }),
    ).not.toBeInTheDocument()
    expect(within(tarjeta).queryByText(/Recepción lo marca/)).not.toBeInTheDocument()
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
  // cancelado: …». UX4-17: se ve «Anulada» (chip de entrega, como «Hecha» y «Fallida») con el
  // motivo de la cancelación, sin acciones, ni «Atrasada», ni «Urgente», que ya no aplican.
  it('la entrega de un trabajo cancelado se ve «Anulada» con el motivo, sin acciones ni avisos', async () => {
    fetchDeliveries.mockResolvedValue([
      entrega({
        status: 'fallida',
        scheduledFor: '2026-10-01',
        failedReason: 'Trabajo cancelado: la clínica lo anuló',
        case: { ...entrega().case, status: 'cancelado', priority: 'urgente' },
      }),
    ])
    renderWithQueryAndRouter(<DeliveriesDay day="2026-10-03" role="mensajero" userId="m1" />)

    const tarjeta = await screen.findByRole('listitem')
    expect(within(tarjeta).getByText('Anulada')).toBeInTheDocument()
    expect(within(tarjeta).getByText('Trabajo cancelado: la clínica lo anuló')).toBeInTheDocument()
    expect(within(tarjeta).queryByText('Fallida')).not.toBeInTheDocument()
    expect(within(tarjeta).queryByText('Cancelado')).not.toBeInTheDocument()
    expect(within(tarjeta).queryByText('Atrasada')).not.toBeInTheDocument()
    expect(within(tarjeta).queryByText('Urgente')).not.toBeInTheDocument()
    expect(within(tarjeta).queryByRole('button')).not.toBeInTheDocument()
  })

  // M-3 de la revisión final del PR 2: «Anulada» solo para la entrega que cerró la
  // cancelación; las cerradas antes conservan su estado real (y su motivo, si fallaron), y
  // dicen que el trabajo se canceló después (UX4-17).
  it('la recogida hecha de un trabajo cancelado después se ve «Hecha» y dice que se canceló', async () => {
    fetchDeliveries.mockResolvedValue([
      entrega({
        type: 'recogida',
        status: 'hecha',
        doneAt: '2026-10-03T10:00:00.000Z',
        case: { ...entrega().case, status: 'cancelado' },
      }),
    ])
    renderWithQueryAndRouter(<DeliveriesDay day="2026-10-03" role="admin" userId="a1" />)

    const tarjeta = await screen.findByRole('listitem')
    expect(within(tarjeta).getByText('Hecha')).toBeInTheDocument()
    expect(within(tarjeta).getByText('Trabajo cancelado')).toBeInTheDocument()
    expect(within(tarjeta).queryByText('Anulada')).not.toBeInTheDocument()
    expect(within(tarjeta).queryByRole('button')).not.toBeInTheDocument()
  })

  it('una fallida real de un trabajo cancelado después conserva «Fallida» y su motivo', async () => {
    fetchDeliveries.mockResolvedValue([
      entrega({
        status: 'fallida',
        failedReason: 'Clínica cerrada',
        case: { ...entrega().case, status: 'cancelado' },
      }),
    ])
    renderWithQueryAndRouter(<DeliveriesDay day="2026-10-03" role="admin" userId="a1" />)

    const tarjeta = await screen.findByRole('listitem')
    expect(within(tarjeta).getByText('Fallida')).toBeInTheDocument()
    expect(within(tarjeta).getByText('Motivo: Clínica cerrada')).toBeInTheDocument()
    expect(within(tarjeta).getByText('Trabajo cancelado')).toBeInTheDocument()
    expect(within(tarjeta).queryByText('Anulada')).not.toBeInTheDocument()
  })

  it('una entrega hecha no repite «Urgente»: ya no hay prisa', async () => {
    fetchDeliveries.mockResolvedValue([
      entrega({
        status: 'hecha',
        doneAt: '2026-10-03T15:00:00.000Z',
        case: { ...entrega().case, status: 'entregado', priority: 'urgente' },
      }),
    ])
    renderWithQueryAndRouter(<DeliveriesDay day="2026-10-03" role="admin" userId="a1" />)
    const tarjeta = await screen.findByRole('listitem')
    expect(within(tarjeta).queryByText('Urgente')).not.toBeInTheDocument()
  })

  // UX4-18: la fallida dice para cuándo quedó.
  it('una fallida dice la nueva fecha a la que se reprogramó', async () => {
    fetchDeliveries.mockResolvedValue([
      entrega({ status: 'fallida', failedReason: 'Clínica cerrada', rescheduledFor: '2026-10-05' }),
    ])
    renderWithQueryAndRouter(<DeliveriesDay day="2026-10-03" role="mensajero" userId="m1" />)
    const tarjeta = await screen.findByRole('listitem')
    expect(within(tarjeta).getByText('Nueva fecha: 05/10/2026')).toBeInTheDocument()
  })

  it('el resumen del día cuenta también las fallidas y las anuladas', async () => {
    fetchDeliveries.mockResolvedValue([
      entrega({ id: 'd1' }),
      entrega({ id: 'd2', case: { ...entrega().case, id: 'c2', code: '26-00002' } }),
      entrega({
        id: 'd3',
        status: 'fallida',
        failedReason: 'Clínica cerrada',
        case: { ...entrega().case, id: 'c3', code: '26-00003' },
      }),
      entrega({
        id: 'd4',
        status: 'fallida',
        failedReason: 'Trabajo cancelado: x',
        case: { ...entrega().case, id: 'c4', code: '26-00004', status: 'cancelado' },
      }),
    ])
    renderWithQueryAndRouter(<DeliveriesDay day="2026-10-03" role="admin" userId="a1" />)
    expect(await screen.findByText('2 pendientes · 1 fallida · 1 anulada')).toBeInTheDocument()
  })

  // UX4-19: dentro de una parada, lo urgente pendiente va arriba aunque llegue después.
  it('dentro de una parada, lo urgente va primero', async () => {
    fetchDeliveries.mockResolvedValue([
      entrega({ id: 'd1', case: { ...entrega().case, code: '26-00001' } }),
      entrega({
        id: 'd2',
        type: 'recogida',
        case: { ...entrega().case, id: 'c2', code: '26-00002', status: 'por_recoger' },
      }),
      entrega({
        id: 'd3',
        case: { ...entrega().case, id: 'c3', code: '26-00003', priority: 'urgente' },
      }),
    ])
    renderWithQueryAndRouter(<DeliveriesDay day="2026-10-03" role="admin" userId="a1" />)
    await screen.findByRole('region', { name: 'Clínica Sonrisa' })
    expect(
      screen.getAllByRole('listitem').map((li) => within(li).getAllByRole('link')[0]!.textContent),
    ).toEqual(['26-00003', '26-00001', '26-00002'])
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

  // UX4-23: el vacío dice qué hacer (la salida: otro día) y todos llevan punto final.
  it('sin entregas lo dice e invita a ver otro día', async () => {
    fetchDeliveries.mockResolvedValue([])
    renderWithQueryAndRouter(<DeliveriesDay day="2026-10-05" role="admin" userId="a1" />)
    expect(await screen.findByText('No hay entregas ni recogidas este día.')).toBeInTheDocument()
    expect(screen.getByText('Usa las flechas para ver otro día.')).toBeInTheDocument()
  })

  it('al mensajero, hoy sin entregas, le habla a él', async () => {
    fetchDeliveries.mockResolvedValue([])
    renderWithQueryAndRouter(<DeliveriesDay day="2026-10-03" role="mensajero" userId="m1" />)
    expect(await screen.findByText('No tienes entregas hoy.')).toBeInTheDocument()
    expect(screen.getByText('Usa las flechas para ver otro día.')).toBeInTheDocument()
  })

  it('en el inicio (compacto), sin flechas, no invita a usarlas', async () => {
    fetchDeliveries.mockResolvedValue([])
    renderWithQueryAndRouter(
      <DeliveriesDay day="2026-10-03" role="mensajero" userId="m1" compact />,
    )
    expect(await screen.findByText('No tienes entregas hoy.')).toBeInTheDocument()
    expect(screen.queryByText('Usa las flechas para ver otro día.')).not.toBeInTheDocument()
  })

  it('un fallo al cargar no se muestra como vacío: ofrece reintentar', async () => {
    fetchDeliveries.mockRejectedValue(new TypeError('Failed to fetch'))
    renderWithQueryAndRouter(<DeliveriesDay day="2026-10-03" role="mensajero" userId="m1" />)
    expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    expect(screen.queryByText('No tienes entregas hoy.')).not.toBeInTheDocument()
  })
  // UX4-26: sin red, la consulta de un día que no está en caché queda en pausa; «Cargando…» sin
  // fin parecía colgado. Lo dice y espera la señal, sin pedir nada a la red.
  it('sin red, un día que no está en caché dice que se cargará al volver la señal', async () => {
    onlineManager.setOnline(false)
    try {
      fetchDeliveries.mockResolvedValue([])
      renderWithQueryAndRouter(<DeliveriesDay day="2026-10-05" role="admin" userId="a1" />)

      expect(
        await screen.findByText('Sin conexión: este día se cargará al volver la señal.'),
      ).toBeInTheDocument()
      expect(screen.queryByText('Cargando…')).not.toBeInTheDocument()
      expect(fetchDeliveries).not.toHaveBeenCalled()
    } finally {
      act(() => onlineManager.setOnline(true))
    }
    expect(await screen.findByText('No hay entregas ni recogidas este día.')).toBeInTheDocument()
  })

  // UX4-05: el diálogo que cierra una entrega no se queda abierto cuando la entrega deja de
  // estar pendiente (otra persona canceló el trabajo o cerró la entrega).
  describe('diálogos sobre una entrega que dejó de estar pendiente', () => {
    const cancelada = () =>
      entrega({
        status: 'fallida',
        failedReason: 'Trabajo cancelado: la clínica lo anuló',
        case: { ...entrega().case, status: 'cancelado' },
      })

    it('«Marcar entregado» se cierra al refrescar si el trabajo se canceló', async () => {
      fetchDeliveries.mockResolvedValue([entrega()])
      const { user, client } = renderWithQueryAndRouter(
        <DeliveriesDay day="2026-10-03" role="mensajero" userId="m1" />,
      )
      const tarjeta = await screen.findByRole('listitem')
      await user.click(within(tarjeta).getByRole('button', { name: 'Marcar entregado' }))
      await screen.findByRole('dialog', { name: 'Marcar entregado' })

      fetchDeliveries.mockResolvedValue([cancelada()])
      await client.invalidateQueries({ queryKey: ['trabajos'] })

      await waitFor(() =>
        expect(screen.queryByRole('dialog', { name: 'Marcar entregado' })).not.toBeInTheDocument(),
      )
    })

    it('«No se pudo» se cierra al refrescar si otra persona cerró la entrega', async () => {
      fetchDeliveries.mockResolvedValue([entrega()])
      const { user, client } = renderWithQueryAndRouter(
        <DeliveriesDay day="2026-10-03" role="recepcion" userId="r1" />,
      )
      const tarjeta = await screen.findByRole('listitem')
      await user.click(within(tarjeta).getByRole('button', { name: 'No se pudo' }))
      await screen.findByRole('dialog')

      fetchDeliveries.mockResolvedValue([
        entrega({ status: 'hecha', case: { ...entrega().case, status: 'entregado' } }),
      ])
      await client.invalidateQueries({ queryKey: ['trabajos'] })

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    })

    it('un 409 al marcar entregado refresca la lista y cierra el diálogo', async () => {
      fetchDeliveries.mockResolvedValueOnce([entrega()])
      fetchDeliveries.mockResolvedValue([cancelada()])
      uploadAttachment.mockResolvedValue({ id: 'a1', url: '/api/adjuntos/a1', thumbUrl: null })
      postCaseAction.mockRejectedValue(
        new ApiError('No se puede "Marcar entregado": el trabajo está en estado "Cancelado".', 409),
      )
      const { user } = renderWithQueryAndRouter(
        <DeliveriesDay day="2026-10-03" role="mensajero" userId="m1" />,
      )
      const tarjeta = await screen.findByRole('listitem')
      await user.click(within(tarjeta).getByRole('button', { name: 'Marcar entregado' }))
      const dialog = await screen.findByRole('dialog', { name: 'Marcar entregado' })
      await user.upload(
        within(dialog).getByLabelText('Foto de constancia'),
        new File(['contenido'], 'foto.png', { type: 'image/png' }),
      )
      const marcar = within(dialog).getByRole('button', { name: 'Marcar entregado' })
      await waitFor(() => expect(marcar).toBeEnabled())
      await user.click(marcar)

      await waitFor(() =>
        expect(screen.queryByRole('dialog', { name: 'Marcar entregado' })).not.toBeInTheDocument(),
      )
      expect(await screen.findByText('Anulada')).toBeInTheDocument()
    })

    it('un 403 al subir la constancia (ya no es suya) refresca la lista y cierra el diálogo', async () => {
      fetchDeliveries.mockResolvedValueOnce([entrega()])
      fetchDeliveries.mockResolvedValue([
        entrega({ courier: { id: 'm2', name: 'Otro Mensajero' } }),
      ])
      uploadAttachment.mockRejectedValue(new ApiError('Sin permiso', 403))
      const { user } = renderWithQueryAndRouter(
        <DeliveriesDay day="2026-10-03" role="mensajero" userId="m1" />,
      )
      const tarjeta = await screen.findByRole('listitem')
      await user.click(within(tarjeta).getByRole('button', { name: 'Marcar entregado' }))
      const dialog = await screen.findByRole('dialog', { name: 'Marcar entregado' })
      await user.upload(
        within(dialog).getByLabelText('Foto de constancia'),
        new File(['contenido'], 'foto.png', { type: 'image/png' }),
      )
      await user.click(within(dialog).getByRole('button', { name: 'Marcar entregado' }))

      await waitFor(() =>
        expect(screen.queryByRole('dialog', { name: 'Marcar entregado' })).not.toBeInTheDocument(),
      )
      await waitFor(() =>
        expect(within(screen.getByRole('listitem')).queryByRole('button')).not.toBeInTheDocument(),
      )
      expect(postCaseAction).not.toHaveBeenCalled()
    })
  })
})
