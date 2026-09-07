import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { setMatchMedia } from '@/test/match-media'
import { renderWithProviders } from '@/test/render'
import { ClinicPricesTable } from './clinic-prices-table'

const { PRODUCTS, PRICES } = vi.hoisted(() => ({
  PRODUCTS: [
    {
      id: 'p1',
      code: 'PH',
      name: 'Prótesis híbrida',
      categoryId: 'c1',
      category: { id: 'c1', name: 'Prótesis removible' },
      pricingUnit: 'por_arcada',
      basePrice: '0.00',
      turnaroundDays: 12,
      requiresTryIn: true,
      active: true,
    },
    {
      id: 'p2',
      code: 'ZR',
      name: 'Zirconio',
      categoryId: 'c2',
      category: { id: 'c2', name: 'Prótesis fija' },
      pricingUnit: 'por_pieza',
      basePrice: '45.00',
      turnaroundDays: 5,
      requiresTryIn: false,
      active: true,
    },
  ],
  PRICES: [] as { productId: string; price: string }[],
}))

vi.mock('./api', () => ({
  fetchProducts: vi.fn().mockResolvedValue(PRODUCTS),
  fetchClinicPrices: vi.fn().mockResolvedValue(PRICES),
  putClinicPrice: vi.fn(),
  deleteClinicPrice: vi.fn(),
}))

describe('ClinicPricesTable', () => {
  it('el buscador tiene una etiqueta visible asociada (UX1-09)', async () => {
    setMatchMedia(true)
    renderWithProviders(<ClinicPricesTable clinicId="clinic-1" />)

    expect(await screen.findByLabelText('Buscar producto')).toBeInTheDocument()
  })

  it('al escribir «zir» solo queda «Zirconio» (UX1-04)', async () => {
    setMatchMedia(true)
    const user = userEvent.setup()
    renderWithProviders(<ClinicPricesTable clinicId="clinic-1" />)

    await screen.findByText(/Zirconio/)
    await user.type(screen.getByLabelText('Buscar producto'), 'zir')

    expect(screen.getByText(/Zirconio/)).toBeInTheDocument()
    expect(screen.queryByText(/Prótesis híbrida/)).not.toBeInTheDocument()
  })

  it('con texto sin coincidencias aparece el estado vacío', async () => {
    setMatchMedia(true)
    const user = userEvent.setup()
    renderWithProviders(<ClinicPricesTable clinicId="clinic-1" />)

    await screen.findByText(/Zirconio/)
    await user.type(screen.getByLabelText('Buscar producto'), 'no existe')

    expect(await screen.findByText(/Ningún producto coincide con "no existe"/)).toBeInTheDocument()
  })

  it('un precio escrito antes de filtrar se conserva al quitar el filtro', async () => {
    setMatchMedia(true)
    const user = userEvent.setup()
    renderWithProviders(<ClinicPricesTable clinicId="clinic-1" />)

    await screen.findByText(/Zirconio/)
    const priceInput = screen.getByLabelText('Precio especial de Zirconio')
    await user.type(priceInput, '50.00')
    expect(priceInput).toHaveValue('50.00')

    const search = screen.getByLabelText('Buscar producto')
    await user.type(search, 'hibrida')
    expect(screen.queryByText(/Zirconio/)).not.toBeInTheDocument()

    await user.clear(search)

    expect(await screen.findByLabelText('Precio especial de Zirconio')).toHaveValue('50.00')
  })
})
