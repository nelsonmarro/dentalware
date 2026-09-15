import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

  it('agrupa por categoría con conteo por grupo', async () => {
    setMatchMedia(true)
    const user = userEvent.setup()
    renderWithRouter(<ProductsTable products={PRODUCTS} onEdit={vi.fn()} onToggle={vi.fn()} />)
    await user.selectOptions(await screen.findByLabelText('Agrupar por'), 'category')
    expect(screen.getByRole('row', { name: /Prótesis fija \(1\)/ })).toBeInTheDocument()
  })

  it('filtra por categoría y por búsqueda sin acentos', async () => {
    setMatchMedia(true)
    const user = userEvent.setup()
    renderWithRouter(<ProductsTable products={PRODUCTS} onEdit={vi.fn()} onToggle={vi.fn()} />)
    await user.selectOptions(await screen.findByLabelText('Filtrar Categoría'), 'Prótesis fija')
    expect(screen.queryByText('Prótesis híbrida')).not.toBeInTheDocument()
  })

  it('la suma de anchos de columna no supera el presupuesto de la tabla a 1280 px (UX1-03)', async () => {
    // El contenedor real de la tabla mide 960 px a un viewport de 1280 px (descuenta el menú
    // lateral y los márgenes de la página — medido en Chrome DevTools, Tarea 13 ronda de fixes),
    // no los 1280 px completos. `resizing` fija cada columna a `meta.width` con `table-layout:
    // fixed` (`parts/table.tsx`): si la suma de los anchos declarados supera ese presupuesto, la
    // tabla vuelve a necesitar scroll horizontal (UX1-03) — este test lo rompe en CI la próxima
    // vez que se añada o se ensanche una columna, sin depender de abrir Chrome para notarlo.
    setMatchMedia(true)
    renderWithRouter(<ProductsTable products={PRODUCTS} onEdit={vi.fn()} onToggle={vi.fn()} />)
    const table = await screen.findByRole('table')
    const total = Array.from(table.querySelectorAll('thead th')).reduce((sum, th) => {
      const width = Number.parseFloat((th as HTMLElement).style.width)
      return sum + (Number.isNaN(width) ? 0 : width)
    }, 0)
    expect(total).toBeLessThanOrEqual(960)
  })
})
