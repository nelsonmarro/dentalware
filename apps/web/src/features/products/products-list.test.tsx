import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { setMatchMedia } from '@/test/match-media'
import { renderWithProviders } from '@/test/render'
import { fetchProducts } from './api'
import { ProductsList } from './products-list'
import { useProducts } from './use-products'

vi.mock('./api', () => ({ fetchProducts: vi.fn() }))

function Harness() {
  const products = useProducts(false)
  return <ProductsList products={products} onEdit={vi.fn()} onToggle={vi.fn()} />
}

describe('ProductsList', () => {
  it('muestra la tabla cuando el catálogo carga bien', async () => {
    setMatchMedia(true)
    vi.mocked(fetchProducts).mockResolvedValue([
      {
        id: 'p1',
        code: 'ZR',
        name: 'Zirconio',
        categoryId: 'c1',
        category: { id: 'c1', name: 'Prótesis fija' },
        pricingUnit: 'por_pieza',
        basePrice: '45.00',
        turnaroundDays: 5,
        requiresTryIn: false,
        active: true,
      },
    ] as Awaited<ReturnType<typeof fetchProducts>>)

    renderWithProviders(<Harness />)

    expect(await screen.findByText('Zirconio')).toBeInTheDocument()
  })

  // Ronda de fixes 1 (UX3-02, punto 3): un fallo de red mostraba la tabla vacía (sin
  // productos).
  it('un fallo de red ofrece reintentar, en vez de una tabla vacía', async () => {
    setMatchMedia(true)
    vi.mocked(fetchProducts).mockRejectedValue(new TypeError('Failed to fetch'))

    renderWithProviders(<Harness />)

    expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })
})
