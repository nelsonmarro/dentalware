import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Captura } from './captura'

describe('Captura', () => {
  it('pinta la imagen de escritorio con su alt y la ruta fija de capturas', () => {
    render(
      <Captura nombre="recepcion/nuevo-trabajo-formulario" alt="Formulario de nuevo trabajo" />,
    )
    const img = screen.getByRole('img', { name: 'Formulario de nuevo trabajo' })
    expect(img).toHaveAttribute(
      'src',
      '/img/capturas/recepcion/nuevo-trabajo-formulario.escritorio.png',
    )
    expect(img).toHaveAttribute('loading', 'lazy')
  })

  it('con `telefono`, añade la variante de teléfono con su propio alt', () => {
    render(<Captura nombre="mensajero/entregas-del-dia" alt="Entregas del día" telefono />)
    const imgs = screen.getAllByRole('img')
    expect(imgs.map((i) => i.getAttribute('src'))).toEqual([
      '/img/capturas/mensajero/entregas-del-dia.escritorio.png',
      '/img/capturas/mensajero/entregas-del-dia.telefono.png',
    ])
    expect(
      screen.getByRole('img', { name: 'Entregas del día (en el teléfono)' }),
    ).toBeInTheDocument()
  })

  it('con `solo="telefono"`, solo la del teléfono', () => {
    render(<Captura nombre="mensajero/recogido" alt="Botón Recogido" solo="telefono" />)
    expect(screen.getAllByRole('img')).toHaveLength(1)
    expect(screen.getByRole('img')).toHaveAttribute(
      'src',
      '/img/capturas/mensajero/recogido.telefono.png',
    )
    // Sola, no hay otra variante de la que distinguirla: el alt va sin «(en el teléfono)».
    expect(screen.getByRole('img', { name: 'Botón Recogido' })).toBeInTheDocument()
  })

  it('con `solo="escritorio"`, solo la de escritorio aunque lleve `telefono`', () => {
    render(
      <Captura nombre="recepcion/inicio" alt="Inicio de recepción" telefono solo="escritorio" />,
    )
    expect(screen.getAllByRole('img')).toHaveLength(1)
    expect(screen.getByRole('img', { name: 'Inicio de recepción' })).toHaveAttribute(
      'src',
      '/img/capturas/recepcion/inicio.escritorio.png',
    )
  })

  it('el pie, si lo hay, va en un figcaption', () => {
    render(<Captura nombre="x/y" alt="x" pie="Así se ve con una recogida pendiente." />)
    expect(screen.getByText('Así se ve con una recogida pendiente.').tagName).toBe('FIGCAPTION')
  })
})
