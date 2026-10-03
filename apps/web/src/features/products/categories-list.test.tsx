import { QueryClientProvider } from '@tanstack/react-query'
import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { CategoriesList } from './categories-list'
import { fetchCategories } from './api'

const { CATEGORIES } = vi.hoisted(() => ({
  CATEGORIES: [{ id: 'c1', name: 'Prótesis fija', sort: 0, active: true }],
}))

vi.mock('./api', () => ({
  fetchCategories: vi.fn().mockResolvedValue(CATEGORIES),
  saveCategory: vi.fn(),
  setCategoryActive: vi.fn(),
}))

describe('CategoriesList', () => {
  // Ronda de fixes 1 (UX3-02, punto 3): un fallo de red se mostraba como "aún no hay
  // categorías" (el vacío de verdad), confundiéndose con que el laboratorio no tiene ninguna.
  it('un fallo de red ofrece reintentar, en vez de confundirse con "aún no hay categorías"', async () => {
    vi.mocked(fetchCategories).mockRejectedValueOnce(new TypeError('Failed to fetch'))
    renderWithProviders(<CategoriesList />)

    expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    expect(screen.queryByText(/Aún no hay categorías/)).not.toBeInTheDocument()
  })

  it('no repite un botón "Nueva categoría" propio: la cabecera de la página es la única entrada (UX1-10)', async () => {
    renderWithProviders(<CategoriesList />)

    await screen.findByText('Prótesis fija')
    expect(screen.queryByRole('button', { name: /Nueva categoría/ })).not.toBeInTheDocument()
  })

  it('abre el diálogo "Nueva categoría" cuando `newRequestToken` cambia (disparado desde la cabecera)', async () => {
    const { rerender, client } = renderWithProviders(<CategoriesList newRequestToken={0} />)

    await screen.findByText('Prótesis fija')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    rerender(
      <QueryClientProvider client={client}>
        <CategoriesList newRequestToken={1} />
      </QueryClientProvider>,
    )

    expect(await screen.findByRole('dialog', { name: 'Nueva categoría' })).toBeInTheDocument()
  })
})
