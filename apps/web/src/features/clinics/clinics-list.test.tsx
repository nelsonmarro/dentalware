import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { setMatchMedia } from '@/test/match-media'
import { renderWithQueryAndRouter } from '@/test/render'
import { fetchClinics } from './api'
import { ClinicsList } from './clinics-list'
import { useClinics } from './use-clinics'

vi.mock('./api', () => ({ fetchClinics: vi.fn() }))

function Harness() {
  const clinics = useClinics(false)
  return <ClinicsList clinics={clinics} onEdit={vi.fn()} onToggle={vi.fn()} />
}

describe('ClinicsList', () => {
  it('muestra la tabla cuando el catálogo carga bien', async () => {
    setMatchMedia(true)
    vi.mocked(fetchClinics).mockResolvedValue([
      {
        id: 'c1',
        name: 'Clínica Uno',
        city: 'Quito',
        whatsapp: null,
        paymentTermsDays: 30,
        active: true,
      },
    ] as Awaited<ReturnType<typeof fetchClinics>>)

    renderWithQueryAndRouter(<Harness />)

    expect(await screen.findByText('Clínica Uno')).toBeInTheDocument()
  })

  // Ronda de fixes 1 (UX3-02, punto 3): un fallo de red mostraba la tabla vacía (sin
  // clínicas), confundiéndose con que el laboratorio no tiene ninguna.
  it('un fallo de red ofrece reintentar, en vez de una tabla vacía', async () => {
    setMatchMedia(true)
    vi.mocked(fetchClinics).mockRejectedValue(new TypeError('Failed to fetch'))

    renderWithQueryAndRouter(<Harness />)

    const retry = await screen.findByRole('button', { name: 'Reintentar' })
    expect(retry).toBeInTheDocument()
    // Ronda de fixes 2 (I-1): embebido en la lista (no sustituye toda la pantalla), así que
    // no debe robar el foco.
    expect(retry).not.toHaveFocus()
  })
})
