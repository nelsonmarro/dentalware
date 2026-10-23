import { render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import NotFoundContent from './index'

// Como Docusaurus en el build: cada `Translate` pinta el mensaje de `i18n/es/code.json` por su id
// y deja marcado el id, para comprobar que ningún texto de la 404 va escrito a mano.
vi.mock('@docusaurus/Translate', async () => {
  const { default: codigo } = (await import('@site/i18n/es/code.json')) as {
    default: Record<string, { message: string } | undefined>
  }
  return {
    default: ({ id = '', children }: { id?: string; children?: ReactNode }) => (
      <span data-traduccion={id}>{codigo[id]?.message ?? children}</span>
    ),
  }
})

describe('NotFoundContent', () => {
  it('es la 404 del tema, con un solo main y su h1', () => {
    render(<NotFoundContent />)
    expect(screen.getAllByRole('main')).toHaveLength(1)
    expect(within(screen.getByRole('main')).getByRole('heading', { level: 1 })).toHaveTextContent(
      'Página no encontrada',
    )
  })

  it('ofrece volver a la portada con un botón, dentro de main', () => {
    render(<NotFoundContent />)
    const enlace = within(screen.getByRole('main')).getByRole('link', { name: 'Ir a la portada' })
    expect(enlace).toHaveAttribute('href', '/')
    expect(enlace).toHaveClass('button')
  })

  it('el texto del botón sale de code.json, como los demás', () => {
    render(<NotFoundContent />)
    const enlace = screen.getByRole('link', { name: 'Ir a la portada' })
    expect(enlace.querySelector('[data-traduccion="theme.NotFound.volver"]')).toHaveTextContent(
      'Ir a la portada',
    )
  })
})
