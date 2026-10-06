import { screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithQueryAndRouter } from '@/test/render'
import type { DeliveryItem } from './api'
import { DeliveriesTodayCard } from './deliveries-today-card'

function fila(over: Partial<DeliveryItem> = {}): DeliveryItem {
  return {
    id: 'd1',
    type: 'recogida',
    status: 'pendiente',
    scheduledFor: '2026-10-05',
    doneAt: null,
    failedReason: null,
    rescheduledFor: null,
    case: {
      id: 'c1',
      code: '26-00001',
      patientRef: null,
      status: 'por_recoger',
      priority: 'normal',
    },
    clinic: { id: 'k1', name: 'Clínica Sonrisa', address: null, city: null, phone: null },
    courier: { id: 'm1', name: 'Luis' },
    ...over,
  }
}

const { fetchDeliveries } = vi.hoisted(() => ({ fetchDeliveries: vi.fn() }))
vi.mock('./api', () => ({ fetchDeliveries }))

beforeEach(() => {
  fetchDeliveries.mockReset()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('DeliveriesTodayCard', () => {
  it('pide las entregas de hoy de todos los mensajeros', async () => {
    fetchDeliveries.mockResolvedValue([])
    renderWithQueryAndRouter(<DeliveriesTodayCard />)
    expect(await screen.findByRole('link', { name: 'Entregas de hoy 0' })).toBeInTheDocument()
    expect(fetchDeliveries).toHaveBeenCalledWith({ dia: expect.any(String) })
  })

  // M-5 de la revisión de la Tarea 9: el fallo se pinta con `LoadError` (convención §5), con
  // `role="alert"` y «Reintentar», nunca como cero.
  it('un fallo al cargar ofrece reintentar y no se muestra como cero', async () => {
    fetchDeliveries.mockRejectedValue(new TypeError('Failed to fetch'))
    const { user } = renderWithQueryAndRouter(<DeliveriesTodayCard />)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudieron cargar las entregas de hoy.',
    )
    expect(screen.queryByText('0')).not.toBeInTheDocument()
    const retry = screen.getByRole('button', { name: 'Reintentar' })
    expect(retry).not.toHaveFocus()
    fetchDeliveries.mockResolvedValue([])
    await user.click(retry)
    expect(await screen.findByRole('link', { name: 'Entregas de hoy 0' })).toBeInTheDocument()
  })

  // I-1 (revisión final de #118): lo que viene en camino es lo que le queda a recepción
  // («Recibido»); la nota lo dice, sin sumarlo al número de pendientes.
  it('cuenta aparte lo que viene en camino, sin sumarlo al número', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-05T12:00:00'))
    const enCamino = { status: 'hecha' as const, doneAt: '2026-10-05T15:00:00.000Z' }
    fetchDeliveries.mockResolvedValue([
      fila({ id: 'd1', scheduledFor: '2026-10-04' }),
      fila({ id: 'd2', ...enCamino }),
      fila({ id: 'd3', ...enCamino, scheduledFor: '2026-10-03' }),
      // Ya recibida: ni pendiente ni en camino.
      fila({ id: 'd4', status: 'hecha', case: { ...fila().case, status: 'nuevo' } }),
    ])
    renderWithQueryAndRouter(<DeliveriesTodayCard />)
    const link = await screen.findByRole('link', {
      name: 'Entregas de hoy 1, 1 atrasada · 2 en camino',
    })
    expect(link).toHaveTextContent('1 atrasada · 2 en camino')
  })

  it('solo lo que viene en camino: el número es cero y la nota lo dice', async () => {
    fetchDeliveries.mockResolvedValue([
      fila({ status: 'hecha', doneAt: '2026-10-05T15:00:00.000Z' }),
    ])
    renderWithQueryAndRouter(<DeliveriesTodayCard />)
    expect(
      await screen.findByRole('link', { name: 'Entregas de hoy 0, 1 en camino' }),
    ).toBeInTheDocument()
  })
})
