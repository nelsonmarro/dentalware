import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { UserRole } from '@dentalware/shared'
import { Rol } from './rol'

describe('Rol', () => {
  it('lista quién puede hacerlo, con los rótulos de la app', () => {
    render(<Rol roles={['admin', 'recepcion']} />)
    expect(screen.getByText('Administrador')).toBeInTheDocument()
    expect(screen.getByText('Recepción')).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Quién puede hacerlo' })).toBeInTheDocument()
  })

  it('rotula mensajero y técnico con los nombres de la app', () => {
    render(<Rol roles={['mensajero', 'tecnico']} />)
    expect(screen.getByText('Mensajero')).toBeInTheDocument()
    expect(screen.getByText('Técnico')).toBeInTheDocument()
  })

  it('un rol sin rótulo (el MDX no pasa por tsc) lanza un error en español y rompe el build', () => {
    // Simula `roles={['recepción']}` escrito en un MDX: con tilde, no es un `UserRole`.
    const roles = ['recepción'] as unknown as UserRole[]
    expect(() => render(<Rol roles={roles} />)).toThrow(
      'Rol desconocido en <Rol>: «recepción». Usa admin, recepcion, tecnico o mensajero.',
    )
  })
})
