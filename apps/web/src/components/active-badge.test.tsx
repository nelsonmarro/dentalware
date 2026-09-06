import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ActiveBadge } from './active-badge'

describe('ActiveBadge', () => {
  it('muestra "Activo" cuando active es true', () => {
    render(<ActiveBadge active />)
    expect(screen.getByText('Activo')).toBeInTheDocument()
  })

  it('muestra "Inactivo" cuando active es false', () => {
    render(<ActiveBadge active={false} />)
    expect(screen.getByText('Inactivo')).toBeInTheDocument()
  })
})
