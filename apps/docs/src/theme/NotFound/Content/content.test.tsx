import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import NotFoundContent from './index'

describe('NotFoundContent', () => {
  it('es la 404 del tema, con un solo main y su h1', () => {
    render(<NotFoundContent />)
    expect(screen.getAllByRole('main')).toHaveLength(1)
    expect(within(screen.getByRole('main')).getByRole('heading', { level: 1 })).toHaveTextContent(
      'Page Not Found',
    )
  })

  it('ofrece volver a la portada con un botón, dentro de main', () => {
    render(<NotFoundContent />)
    const enlace = within(screen.getByRole('main')).getByRole('link', { name: 'Ir a la portada' })
    expect(enlace).toHaveAttribute('href', '/')
    expect(enlace).toHaveClass('button')
  })
})
