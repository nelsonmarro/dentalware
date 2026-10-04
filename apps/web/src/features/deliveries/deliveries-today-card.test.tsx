import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithQueryAndRouter } from '@/test/render'
import { DeliveriesTodayCard } from './deliveries-today-card'

const { fetchDeliveries } = vi.hoisted(() => ({ fetchDeliveries: vi.fn() }))
vi.mock('./api', () => ({ fetchDeliveries }))

beforeEach(() => {
  fetchDeliveries.mockReset()
})

describe('DeliveriesTodayCard', () => {
  it('pide las entregas de hoy de todos los mensajeros', async () => {
    fetchDeliveries.mockResolvedValue([])
    renderWithQueryAndRouter(<DeliveriesTodayCard />)
    expect(await screen.findByRole('link', { name: 'Entregas de hoy 0' })).toBeInTheDocument()
    expect(fetchDeliveries).toHaveBeenCalledWith({ dia: expect.any(String) })
  })

  it('un fallo al cargar no se muestra como cero', async () => {
    fetchDeliveries.mockRejectedValue(new TypeError('Failed to fetch'))
    renderWithQueryAndRouter(<DeliveriesTodayCard />)
    expect(
      await screen.findByRole('link', { name: 'Entregas de hoy, no se pudo cargar' }),
    ).toBeInTheDocument()
    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })
})
