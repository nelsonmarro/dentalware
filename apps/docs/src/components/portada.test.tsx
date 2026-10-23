import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Portada } from './portada'

describe('Portada', () => {
  it('ofrece tres accesos, cada uno con su destino', () => {
    render(<Portada />)
    // Provisional: «Soy mensajero» apunta a «Entrar y salir» hasta que la Tarea 6 escriba su
    // sección (un enlace roto rompe el build).
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
      '/primeros-pasos/entrar-y-salir/',
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
