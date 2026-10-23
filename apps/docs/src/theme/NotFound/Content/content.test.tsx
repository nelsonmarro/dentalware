import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import NotFoundContent from './index'

describe('NotFoundContent', () => {
  it('conserva la 404 del tema', () => {
    render(<NotFoundContent />)
    expect(screen.getByRole('heading', { name: 'Página no encontrada' })).toBeInTheDocument()
  })

  it('ofrece volver a la portada con un botón', () => {
    render(<NotFoundContent />)
    const enlace = screen.getByRole('link', { name: 'Ir a la portada' })
    expect(enlace).toHaveAttribute('href', '/')
    expect(enlace).toHaveClass('button')
  })
})
