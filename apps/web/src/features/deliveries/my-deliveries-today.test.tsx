import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithQueryAndRouter } from '@/test/render'
import type { DeliveryItem } from './api'
import { MyDeliveriesToday } from './my-deliveries-today'

const { fetchDeliveries } = vi.hoisted(() => ({ fetchDeliveries: vi.fn() }))
vi.mock('./api', () => ({ fetchDeliveries, failDelivery: vi.fn() }))
vi.mock('@/features/cases/api', () => ({ postCaseAction: vi.fn() }))

const base: DeliveryItem = {
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
  clinic: { id: 'k1', name: 'Clínica Sonrisa', address: null, city: null, phone: null },
  courier: { id: 'm1', name: 'Mario Mensajero' },
}

beforeEach(() => {
  fetchDeliveries.mockReset()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-03T12:00:00'))
})
afterEach(() => {
  vi.useRealTimers()
})

describe('MyDeliveriesToday', () => {
  it('pide las de hoy y enlaza a «Entregas»', async () => {
    fetchDeliveries.mockResolvedValue([base])
    renderWithQueryAndRouter(<MyDeliveriesToday userId="m1" />)

    expect(await screen.findByRole('heading', { name: 'Entregas de hoy' })).toBeInTheDocument()
    await waitFor(() => expect(fetchDeliveries).toHaveBeenCalledWith({ dia: '2026-10-03' }))
    expect(screen.getByRole('link', { name: 'Ver todas' })).toHaveAttribute('href', '/entregas')
  })

  it('compacta: solo lo pendiente, sin las ya hechas', async () => {
    fetchDeliveries.mockResolvedValue([
      base,
      {
        ...base,
        id: 'd2',
        status: 'hecha',
        doneAt: '2026-10-03T15:00:00.000Z',
        case: { ...base.case, id: 'c2', code: '26-00002', status: 'entregado' },
      },
    ])
    renderWithQueryAndRouter(<MyDeliveriesToday userId="m1" />)

    const grupo = await screen.findByRole('region', { name: 'Clínica Sonrisa' })
    expect(within(grupo).getByRole('link', { name: '26-00001' })).toBeInTheDocument()
    expect(within(grupo).queryByRole('link', { name: '26-00002' })).not.toBeInTheDocument()
  })

  it('con todo hecho no dice que no tiene entregas: dice que terminó', async () => {
    fetchDeliveries.mockResolvedValue([
      { ...base, status: 'hecha', case: { ...base.case, status: 'entregado' } },
    ])
    renderWithQueryAndRouter(<MyDeliveriesToday userId="m1" />)

    expect(await screen.findByText('Terminaste las entregas de hoy.')).toBeInTheDocument()
    expect(screen.queryByText('No tienes entregas hoy')).not.toBeInTheDocument()
  })
})
