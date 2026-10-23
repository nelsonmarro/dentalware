import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Captura } from './captura'

// Un sitio publicado bajo otra ruta (`baseUrl: '/manual/'`): Docusaurus antepone su base.
vi.mock('@docusaurus/useBaseUrl', () => ({
  default: (url: string) => `/manual${url}`,
}))

describe('Captura bajo un baseUrl', () => {
  it('pasa la ruta de la imagen por useBaseUrl', () => {
    render(<Captura nombre="primeros-pasos/entrar-formulario" alt="Entrar" />)
    expect(screen.getByRole('img', { name: 'Entrar' })).toHaveAttribute(
      'srcset',
      '/manual/img/capturas/primeros-pasos/entrar-formulario.escritorio.png 2x',
    )
  })
})
