import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ProductsHeaderAction } from './products-header-action'

describe('ProductsHeaderAction', () => {
  it('en la pestaña "productos" muestra solo "Nuevo producto" (UX1-10)', () => {
    render(<ProductsHeaderAction tab="productos" onNewProduct={vi.fn()} onNewCategory={vi.fn()} />)

    expect(screen.getByRole('button', { name: /Nuevo producto/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Nueva categoría/ })).not.toBeInTheDocument()
  })

  it('en la pestaña "categorias" muestra solo "Nueva categoría", sin "Nuevo producto"', () => {
    render(<ProductsHeaderAction tab="categorias" onNewProduct={vi.fn()} onNewCategory={vi.fn()} />)

    expect(screen.getByRole('button', { name: /Nueva categoría/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Nuevo producto/ })).not.toBeInTheDocument()
  })

  it('hace clic en el callback de la pestaña activa', async () => {
    const user = userEvent.setup()
    const onNewCategory = vi.fn()
    render(
      <ProductsHeaderAction
        tab="categorias"
        onNewProduct={vi.fn()}
        onNewCategory={onNewCategory}
      />,
    )

    await user.click(screen.getByRole('button', { name: /Nueva categoría/ }))

    expect(onNewCategory).toHaveBeenCalledOnce()
  })
})
