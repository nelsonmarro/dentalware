import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Boton } from './boton'

describe('Boton', () => {
  it('muestra el texto del botón de la app tal cual, como <kbd> con su clase', () => {
    render(<Boton>Registrar pago</Boton>)
    const el = screen.getByText('Registrar pago')
    expect(el.tagName).toBe('KBD')
    expect(el.className).toContain('boton')
  })
})
