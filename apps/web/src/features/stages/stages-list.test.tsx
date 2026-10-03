import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { fetchStages } from './api'
import { StagesList } from './stages-list'
import { useStages } from './use-stages'

vi.mock('./api', () => ({ fetchStages: vi.fn() }))

function Harness() {
  const stages = useStages(false)
  return <StagesList stages={stages} onEdit={vi.fn()} onToggle={vi.fn()} onMove={vi.fn()} />
}

describe('StagesList', () => {
  it('muestra la tabla cuando el catálogo carga bien', async () => {
    vi.mocked(fetchStages).mockResolvedValue([
      {
        id: 'f1',
        name: 'Modelado',
        color: '#0F766E',
        sort: 0,
        active: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ] as Awaited<ReturnType<typeof fetchStages>>)

    renderWithProviders(<Harness />)

    expect(await screen.findByText('Modelado')).toBeInTheDocument()
  })

  // Ronda de fixes 1 (UX3-02, punto 3): un fallo de red mostraba la tabla vacía (sin fases).
  it('un fallo de red ofrece reintentar, en vez de una tabla vacía', async () => {
    vi.mocked(fetchStages).mockRejectedValue(new TypeError('Failed to fetch'))

    renderWithProviders(<Harness />)

    expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })
})
