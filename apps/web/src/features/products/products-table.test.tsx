import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { setMatchMedia } from '@/test/match-media'
import { renderWithRouter } from '@/test/router'
import type { Product } from './api'
import { ProductsTable } from './products-table'

const PRODUCTS: Product[] = [
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
] as unknown as Product[]

describe('ProductsTable', () => {
  it('en escritorio no repite "Prueba" como columna aparte (UX1-03)', async () => {
    setMatchMedia(true)
    renderWithRouter(<ProductsTable products={PRODUCTS} onEdit={vi.fn()} onToggle={vi.fn()} />)

    await screen.findByText('Zirconio')
    expect(screen.queryByRole('columnheader', { name: 'Prueba' })).not.toBeInTheDocument()
  })

  it('muestra "Requiere prueba" como icono accesible junto a los días cuando aplica', async () => {
    setMatchMedia(true)
    renderWithRouter(<ProductsTable products={PRODUCTS} onEdit={vi.fn()} onToggle={vi.fn()} />)

    await screen.findByText('Zirconio')
    expect(screen.getByRole('img', { name: 'Requiere prueba' })).toBeInTheDocument()
  })

  it('no muestra el icono de prueba cuando el producto no la requiere', async () => {
    setMatchMedia(true)
    renderWithRouter(
      <ProductsTable products={[PRODUCTS[1]!]} onEdit={vi.fn()} onToggle={vi.fn()} />,
    )

    await screen.findByText('Zirconio')
    expect(screen.queryByRole('img', { name: 'Requiere prueba' })).not.toBeInTheDocument()
  })
})
