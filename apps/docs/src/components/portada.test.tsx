import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Portada } from './portada'

describe('Portada', () => {
  it('ofrece tres accesos, cada uno con su destino', () => {
    render(<Portada />)
    expect(screen.getByRole('link', { name: /Primeros pasos/ })).toHaveAttribute(
      'href',
      '/primeros-pasos/',
    )
    expect(screen.getByRole('link', { name: /Soy recepción/ })).toHaveAttribute(
      'href',
      '/recepcion/',
    )
    expect(screen.getByRole('link', { name: /Soy mensajero/ })).toHaveAttribute(
      'href',
      '/mensajero/',
    )
    expect(screen.getAllByRole('link')).toHaveLength(3)
  })

  it('cada acceso dice para qué sirve, no solo su título', () => {
    render(<Portada />)
    expect(screen.getByRole('link', { name: /Soy mensajero/ })).toHaveAccessibleName(
      /Recogidas y entregas del día/,
    )
  })

  it('la flecha es un nodo oculto al lector', () => {
    const { container } = render(<Portada />)
    const flechas = container.querySelectorAll('.portada__flecha')
    expect(flechas).toHaveLength(3)
    for (const f of flechas) {
      expect(f).toHaveAttribute('aria-hidden', 'true')
      expect(f).toHaveTextContent('→')
    }
  })

  it('el nombre accesible del acceso no incluye la flecha', () => {
    render(<Portada />)
    expect(screen.getByRole('link', { name: /Primeros pasos/ })).toHaveAccessibleName(
      /^Primeros pasos Entrar/,
    )
  })
})
