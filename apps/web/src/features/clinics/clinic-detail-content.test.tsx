import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { setMatchMedia } from '@/test/match-media'
import { renderWithQueryAndRouter } from '@/test/render'
import { ApiError } from '@/lib/api-error'
import { ClinicDetailContent } from './clinic-detail-content'
import type * as ClinicsApiModule from './api'
import type * as DoctorsApiModule from '@/features/doctors/api'

const { fetchClinic, fetchDoctors } = vi.hoisted(() => ({
  fetchClinic: vi.fn(),
  fetchDoctors: vi.fn(),
}))
vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof ClinicsApiModule>()),
  fetchClinic,
}))
vi.mock('@/features/doctors/api', async (importOriginal) => ({
  ...(await importOriginal<typeof DoctorsApiModule>()),
  fetchDoctors,
}))

describe('ClinicDetailContent', () => {
  it('muestra la clínica cuando carga bien', async () => {
    setMatchMedia(true)
    fetchClinic.mockResolvedValue({
      id: 'c1',
      name: 'Clínica Uno',
      city: null,
      address: null,
      phone: null,
      whatsapp: null,
    })
    fetchDoctors.mockResolvedValue([])

    renderWithQueryAndRouter(<ClinicDetailContent clinicId="c1" />)

    expect(await screen.findByRole('heading', { name: 'Clínica Uno' })).toBeInTheDocument()
  })

  it('una clínica inexistente (404) dice que no existe, con salida a la lista y su propio h1', async () => {
    fetchClinic.mockRejectedValue(new ApiError('No encontrado', 404))

    renderWithQueryAndRouter(<ClinicDetailContent clinicId="c-no-existe" />)

    // M-1 (ronda de fixes 2): la rama de error también tiene su `h1` — antes esta pantalla se
    // quedaba sin encabezado.
    expect(await screen.findByRole('heading', { name: 'Clínica' })).toBeInTheDocument()
    expect(screen.getByText('La clínica no existe')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Volver a clínicas' })).toBeInTheDocument()
  })

  // Ronda de fixes 1 (UX3-02, punto 3): antes, cualquier fallo (también un 500 o sin red)
  // mostraba "La clínica no existe.", aunque el problema fuera de red.
  it('un fallo de red no dice que la clínica no existe: ofrece reintentar, con su h1 y enfocado', async () => {
    fetchClinic.mockRejectedValue(new TypeError('Failed to fetch'))

    renderWithQueryAndRouter(<ClinicDetailContent clinicId="c1" />)

    expect(await screen.findByRole('heading', { name: 'Clínica' })).toBeInTheDocument()
    const retry = screen.getByRole('button', { name: 'Reintentar' })
    expect(screen.queryByText('La clínica no existe')).not.toBeInTheDocument()
    // Ronda de fixes 2 (I-1): este `LoadError` sustituye toda la pantalla, así que sí enfoca.
    expect(retry).toHaveFocus()
  })

  it('un fallo al cargar los doctores ofrece reintentar en esa pestaña, sin robar el foco', async () => {
    setMatchMedia(true)
    fetchClinic.mockResolvedValue({
      id: 'c1',
      name: 'Clínica Uno',
      city: null,
      address: null,
      phone: null,
      whatsapp: null,
    })
    fetchDoctors.mockRejectedValue(new TypeError('Failed to fetch'))

    renderWithQueryAndRouter(<ClinicDetailContent clinicId="c1" />)

    const retry = await screen.findByRole('button', { name: 'Reintentar' })
    expect(retry).toBeInTheDocument()
    // Ronda de fixes 2 (I-1): embebido en la pestaña "Doctores", junto al resto de la
    // pantalla (cabecera, pestañas) — no debe robar el foco.
    expect(retry).not.toHaveFocus()
  })
})
