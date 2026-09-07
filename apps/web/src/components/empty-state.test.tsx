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
})
