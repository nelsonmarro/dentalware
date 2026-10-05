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
})
