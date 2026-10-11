import { screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { setMatchMedia } from '@/test/match-media'
import { renderWithQueryAndRouter } from '@/test/render'
import { fetchClinics } from './api'
import { ClinicsPage } from './clinics-page'

vi.mock('./api', () => ({
  fetchClinics: vi.fn(),
  createClinic: vi.fn(),
  updateClinic: vi.fn(),
  setClinicActive: vi.fn(),
  fetchClinic: vi.fn(),
}))

const clinics = [
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
    name: 'Clínica Dos',
    city: 'Quito',
    whatsapp: null,
    paymentTermsDays: 30,
    active: true,
  },
] as Awaited<ReturnType<typeof fetchClinics>>

describe('ClinicsPage ?editar (AVI-4)', () => {
  it('con editar=<id>, abre el diálogo de esa clínica una vez cargada la lista', async () => {
    setMatchMedia(true)
    vi.mocked(fetchClinics).mockResolvedValue(clinics)
    const onHandled = vi.fn()
    renderWithQueryAndRouter(<ClinicsPage editId="c2" onEditHandled={onHandled} />)
    expect(await screen.findByRole('dialog', { name: 'Editar clínica' })).toBeInTheDocument()
    expect(screen.getByLabelText('Nombre')).toHaveValue('Clínica Dos')
    expect(onHandled).toHaveBeenCalledTimes(1)
  })

  it('un editar desconocido no abre nada, pero se da por atendido', async () => {
    setMatchMedia(true)
    vi.mocked(fetchClinics).mockResolvedValue(clinics)
    const onHandled = vi.fn()
    renderWithQueryAndRouter(<ClinicsPage editId="zzz" onEditHandled={onHandled} />)
    expect(await screen.findByText('Clínica Uno')).toBeInTheDocument()
    await waitFor(() => expect(onHandled).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('sin editar, no abre ningún diálogo', async () => {
    setMatchMedia(true)
    vi.mocked(fetchClinics).mockResolvedValue(clinics)
    const onHandled = vi.fn()
    renderWithQueryAndRouter(<ClinicsPage onEditHandled={onHandled} />)
    expect(await screen.findByText('Clínica Uno')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(onHandled).not.toHaveBeenCalled()
  })
})
