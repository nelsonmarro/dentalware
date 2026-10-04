import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EmptyState } from './empty-state'

describe('EmptyState', () => {
  it('muestra título, descripción y acción', () => {
    render(<EmptyState title="Sin datos" description="Nada aquí" action={<button>Crear</button>} />)
    expect(screen.getByText('Sin datos')).toBeInTheDocument()
    expect(screen.getByText('Nada aquí')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Crear' })).toBeInTheDocument()
  })

  it('como título de página, el título es el h1', () => {
    render(<EmptyState title="No encontrado" pageTitle />)
    expect(screen.getByRole('heading', { level: 1, name: 'No encontrado' })).toBeInTheDocument()
  })

  it('por omisión no es un encabezado (se usa dentro de otras pantallas)', () => {
    render(<EmptyState title="Sin fotos" />)
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  })
})
