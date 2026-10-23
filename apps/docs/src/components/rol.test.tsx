import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Rol } from './rol'

describe('Rol', () => {
  it('lista quién puede hacerlo, con los rótulos de la app', () => {
    render(<Rol roles={['admin', 'recepcion']} />)
    expect(screen.getByText('Administración')).toBeInTheDocument()
    expect(screen.getByText('Recepción')).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Quién puede hacerlo' })).toBeInTheDocument()
  })

  it('no acepta un rol que no existe (tipo exhaustivo): el mensajero sale como «Mensajero»', () => {
    render(<Rol roles={['mensajero', 'tecnico']} />)
    expect(screen.getByText('Mensajero')).toBeInTheDocument()
    expect(screen.getByText('Técnico')).toBeInTheDocument()
  })
})
