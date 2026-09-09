import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { setMatchMedia } from '@/test/match-media'
import { renderWithRouter } from '@/test/router'
import type { Clinic } from './api'
import { ClinicsTable } from './clinics-table'

const CLINICS: Clinic[] = [
  {
    id: 'c1',
    name: 'Clínica Uno',
    city: 'Quito',
    whatsapp: null,
    paymentTermsDays: 30,
    active: true,
  },
  {
    id: 'c2',
    name: 'Zirconio Dental',
    city: 'Quito',
    whatsapp: null,
    paymentTermsDays: 30,
    active: true,
  },
] as unknown as Clinic[]

describe('ClinicsTable', () => {
  it('el buscador tiene una etiqueta visible asociada (UX1-09)', async () => {
    setMatchMedia(true)
    renderWithRouter(<ClinicsTable clinics={CLINICS} onEdit={vi.fn()} onToggle={vi.fn()} />)

    expect(await screen.findByLabelText('Buscar clínica')).toBeInTheDocument()
  })

  it('filtra por nombre al escribir, insensible a mayúsculas y acentos', async () => {
    setMatchMedia(true)
    const user = userEvent.setup()
    renderWithRouter(<ClinicsTable clinics={CLINICS} onEdit={vi.fn()} onToggle={vi.fn()} />)

    await user.type(await screen.findByLabelText('Buscar clínica'), 'zir')

    expect(screen.getByText('Zirconio Dental')).toBeInTheDocument()
    expect(screen.queryByText('Clínica Uno')).not.toBeInTheDocument()
  })

  it('muestra un estado vacío cuando ninguna clínica coincide con la búsqueda', async () => {
    setMatchMedia(true)
    const user = userEvent.setup()
    renderWithRouter(<ClinicsTable clinics={CLINICS} onEdit={vi.fn()} onToggle={vi.fn()} />)

    await user.type(await screen.findByLabelText('Buscar clínica'), 'no existe')

    expect(await screen.findByText(/Ninguna clínica coincide con "no existe"/)).toBeInTheDocument()
  })
})
