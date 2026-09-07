import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Button } from './button'

describe('Button', () => {
  it('el tamaño por defecto mide 44 px de alto (h-11)', () => {
    render(<Button>Ir</Button>)
    expect(screen.getByRole('button', { name: 'Ir' })).toHaveClass('h-11')
  })

  it('size="icon" mide 44 px (size-11)', () => {
    render(<Button size="icon" aria-label="Editar" />)
    expect(screen.getByRole('button', { name: 'Editar' })).toHaveClass('size-11')
  })

  it('size="sm" llega a 44 px en dispositivos táctiles (pointer-coarse:h-11)', () => {
    render(<Button size="sm">Bloquear</Button>)
    expect(screen.getByRole('button', { name: 'Bloquear' })).toHaveClass('pointer-coarse:h-11')
  })

  it('size="lg" mide 48 px de alto', () => {
    render(<Button size="lg">Guardar</Button>)
    expect(screen.getByRole('button', { name: 'Guardar' })).toHaveClass('h-12')
  })

  it('size="icon-sm" llega a 44 px en dispositivos táctiles', () => {
    render(<Button size="icon-sm" aria-label="Cerrar" />)
    expect(screen.getByRole('button', { name: 'Cerrar' })).toHaveClass(
      'size-9',
      'pointer-coarse:size-11',
    )
  })

  it('size="icon-lg" mide 48 px', () => {
    render(<Button size="icon-lg" aria-label="Eliminar" />)
    expect(screen.getByRole('button', { name: 'Eliminar' })).toHaveClass('size-12')
  })
})
