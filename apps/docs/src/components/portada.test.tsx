import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Portada } from './portada'

describe('Portada', () => {
  it('ofrece tres accesos, cada uno con su destino', () => {
    render(<Portada />)
    // Provisionales: «Soy recepción» y «Soy mensajero» apuntan a «Entrar y salir» hasta que las
    // Tareas 5 y 6 escriban sus secciones (un enlace roto rompe el build).
    expect(screen.getByRole('link', { name: /Primeros pasos/ })).toHaveAttribute(
      'href',
      '/primeros-pasos/entrar-y-salir/',
    )
    expect(screen.getByRole('link', { name: /Soy recepción/ })).toHaveAttribute(
      'href',
      '/primeros-pasos/entrar-y-salir/',
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
