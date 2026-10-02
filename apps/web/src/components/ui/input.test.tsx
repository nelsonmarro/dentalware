import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Input } from './input'

describe('Input', () => {
  it('mide 44 px de alto (h-11)', () => {
    render(<Input aria-label="Correo" />)
    expect(screen.getByLabelText('Correo')).toHaveClass('h-11')
  })

  it('desactiva la transición cuando el usuario pide menos movimiento', () => {
    render(<Input aria-label="Correo" />)
    expect(screen.getByLabelText('Correo')).toHaveClass('motion-reduce:transition-none')
  })
})
