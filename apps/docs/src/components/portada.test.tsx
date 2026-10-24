import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Portada } from './portada'

describe('Portada', () => {
  it('ofrece cinco accesos, en orden y cada uno con su destino', () => {
    render(<Portada />)
    const enlaces = screen.getAllByRole('link')
    expect(
      enlaces.map((a) => [
        a.querySelector('.portada__titulo')?.textContent,
        a.getAttribute('href'),
      ]),
    ).toEqual([
      ['Primeros pasos→', '/primeros-pasos/'],
      ['Soy recepción→', '/recepcion/'],
      ['Soy técnico→', '/tecnico/'],
      ['Soy mensajero→', '/mensajero/'],
      ['Administro el laboratorio→', '/administracion/'],
    ])
  })

  it('cada acceso dice para qué sirve, no solo su título', () => {
    render(<Portada />)
    expect(screen.getByRole('link', { name: /Soy mensajero/ })).toHaveAccessibleName(
      'Soy mensajero Recogidas y entregas del día, desde el teléfono.',
    )
    expect(screen.getByRole('link', { name: /Soy técnico/ })).toHaveAccessibleName(
      'Soy técnico Mis trabajos, fases, fotos y finalizar.',
    )
    expect(screen.getByRole('link', { name: /Administro el laboratorio/ })).toHaveAccessibleName(
      'Administro el laboratorio Clínicas, productos, fases, usuarios y cuentas.',
    )
  })

  it('la flecha es un nodo oculto al lector', () => {
    const { container } = render(<Portada />)
    const flechas = container.querySelectorAll('.portada__flecha')
    expect(flechas).toHaveLength(5)
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
