import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Captura } from './captura'

// Un sitio publicado bajo otra ruta (`baseUrl: '/manual/'`): Docusaurus antepone su base.
vi.mock('@docusaurus/useBaseUrl', () => ({
  default: (url: string) => `/manual${url}`,
}))

describe('Captura bajo un baseUrl', () => {
  it('pasa la ruta de la imagen (src y srcset) por useBaseUrl', () => {
    render(<Captura nombre="primeros-pasos/entrar-formulario" alt="Entrar" />)
    const img = screen.getByRole('img', { name: 'Entrar' })
    expect(img).toHaveAttribute(
      'src',
      '/manual/img/capturas/primeros-pasos/entrar-formulario.escritorio.png',
    )
    expect(img).toHaveAttribute(
      'srcset',
      '/manual/img/capturas/primeros-pasos/entrar-formulario.escritorio.png 2x',
    )
  })
})
