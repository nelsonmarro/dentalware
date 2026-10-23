import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Portada } from './portada'

describe('Portada', () => {
  it('ofrece tres accesos, cada uno con su destino', () => {
    render(<Portada />)
    expect(screen.getByRole('link', { name: /Primeros pasos/ })).toHaveAttribute(
      'href',
      '/primeros-pasos/entrar-y-salir/',
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
})
