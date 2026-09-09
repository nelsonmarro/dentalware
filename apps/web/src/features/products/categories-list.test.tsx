import { QueryClientProvider } from '@tanstack/react-query'
import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { CategoriesList } from './categories-list'

const { CATEGORIES } = vi.hoisted(() => ({
  CATEGORIES: [{ id: 'c1', name: 'Prótesis fija', sort: 0, active: true }],
}))

vi.mock('./api', () => ({
  fetchCategories: vi.fn().mockResolvedValue(CATEGORIES),
  saveCategory: vi.fn(),
  setCategoryActive: vi.fn(),
}))

describe('CategoriesList', () => {
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
