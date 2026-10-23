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
      'srcset',
      '/img/capturas/recepcion/nuevo-trabajo-formulario.escritorio.png 2x',
    )
    expect(img).toHaveAttribute('loading', 'lazy')
  })

  it('declara la imagen como 2x: se muestra a la mitad de sus píxeles, nítida y sin estirarse', () => {
    render(<Captura nombre="primeros-pasos/entrar-formulario" alt="Entrar" telefono />)
    expect(screen.getAllByRole('img').map((i) => i.getAttribute('srcset'))).toEqual([
      '/img/capturas/primeros-pasos/entrar-formulario.escritorio.png 2x',
      '/img/capturas/primeros-pasos/entrar-formulario.telefono.png 2x',
    ])
  })

  it('sin `src`: con él, el navegador lo toma como candidata 1x y en una pantalla normal pinta la imagen al doble', () => {
    render(<Captura nombre="primeros-pasos/entrar-formulario" alt="Entrar" telefono />)
    for (const img of screen.getAllByRole('img')) expect(img).not.toHaveAttribute('src')
  })

  it('con `telefono`, añade la variante de teléfono con su propio alt', () => {
    render(<Captura nombre="mensajero/entregas-del-dia" alt="Entregas del día" telefono />)
    const imgs = screen.getAllByRole('img')
    expect(imgs.map((i) => i.getAttribute('srcset'))).toEqual([
      '/img/capturas/mensajero/entregas-del-dia.escritorio.png 2x',
      '/img/capturas/mensajero/entregas-del-dia.telefono.png 2x',
    ])
    expect(
      screen.getByRole('img', { name: 'Entregas del día (en el teléfono)' }),
    ).toBeInTheDocument()
  })

  it('con `solo="telefono"`, solo la del teléfono', () => {
    render(<Captura nombre="mensajero/recogido" alt="Botón Recogido" solo="telefono" />)
    expect(screen.getAllByRole('img')).toHaveLength(1)
    expect(screen.getByRole('img')).toHaveAttribute(
      'srcset',
      '/img/capturas/mensajero/recogido.telefono.png 2x',
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
      'srcset',
      '/img/capturas/recepcion/inicio.escritorio.png 2x',
    )
  })

  it('el pie, si lo hay, va en un figcaption', () => {
    render(<Captura nombre="x/y" alt="x" pie="Así se ve con una recogida pendiente." />)
    expect(screen.getByText('Así se ve con una recogida pendiente.').tagName).toBe('FIGCAPTION')
  })
})
