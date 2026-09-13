import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { setMatchMedia } from '@/test/match-media'
import { renderWithRouter } from '@/test/router'
import type { Stage } from './api'
import { StagesTable } from './stages-table'

const STAGES = [
  { id: 's1', name: 'Recepción', color: '#111111', sort: 1, active: true },
  { id: 's2', name: 'Modelo', color: '#222222', sort: 2, active: true },
] as unknown as Stage[]

describe('StagesTable', () => {
  it('conserva el orden manual: sin botones de orden ni buscador, Subir deshabilitado en la primera', async () => {
    setMatchMedia(true)
    renderWithRouter(
      <StagesTable stages={STAGES} onEdit={vi.fn()} onToggle={vi.fn()} onMove={vi.fn()} />,
    )
    await screen.findByRole('table')
    expect(screen.queryByRole('button', { name: /Ordenar por/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('search')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Subir Recepción' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Bajar Modelo' })).toBeDisabled()
  })
})
