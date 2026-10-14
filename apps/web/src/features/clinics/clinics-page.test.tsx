import { screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setMatchMedia } from '@/test/match-media'
import { renderWithQueryAndRouter } from '@/test/render'
import { toast } from 'sonner'
import { ApiError } from '@/lib/api-error'
import { fetchClinic, fetchClinics, updateClinic } from './api'
import { ClinicsPage } from './clinics-page'

vi.mock('./api', () => ({
  fetchClinics: vi.fn(),
  createClinic: vi.fn(),
  updateClinic: vi.fn(),
  setClinicActive: vi.fn(),
  fetchClinic: vi.fn(),
}))

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

beforeEach(() => {
  vi.clearAllMocks()
})

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

  it('guardar el WhatsApp pedido desde la ficha avisa y vuelve a ella con foco', async () => {
    setMatchMedia(true)
    vi.mocked(fetchClinics).mockResolvedValue(clinics)
    vi.mocked(updateClinic).mockResolvedValue({
      ...clinics[1],
      whatsapp: '+593991234567',
    } as Awaited<ReturnType<typeof updateClinic>>)
    const { user, router } = renderWithQueryAndRouter(
      <ClinicsPage
        editId="c2"
        returnTo="/trabajos/t1"
        focusField="whatsapp"
        onEditHandled={() => {}}
      />,
    )
    const whatsapp = await screen.findByLabelText('WhatsApp')
    await waitFor(() => expect(whatsapp).toHaveFocus())
    await user.type(whatsapp, '099 123 4567')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('WhatsApp de Clínica Dos guardado'),
    )
    await waitFor(() =>
      expect(router.state.location.href).toMatch(/\/trabajos\/t1\?foco=whatsapp$/),
    )
  })

  it('guardar una clínica descarta los trabajos cacheados: su ficha trae el contacto', async () => {
    setMatchMedia(true)
    vi.mocked(fetchClinics).mockResolvedValue(clinics)
    vi.mocked(updateClinic).mockResolvedValue(
      clinics[1] as Awaited<ReturnType<typeof updateClinic>>,
    )
    const { user, client } = renderWithQueryAndRouter(
      <ClinicsPage editId="c2" onEditHandled={() => {}} />,
    )
    client.setQueryData(['trabajos', 't1'], { id: 't1' })
    await user.click(await screen.findByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(client.getQueryData(['trabajos', 't1'])).toBeUndefined())
  })

  it('cancelar vuelve a la ficha sin aviso ni foco', async () => {
    setMatchMedia(true)
    vi.mocked(fetchClinics).mockResolvedValue(clinics)
    const { user, router } = renderWithQueryAndRouter(
      <ClinicsPage
        editId="c2"
        returnTo="/trabajos/t1"
        focusField="whatsapp"
        onEditHandled={() => {}}
      />,
    )
    await user.click(await screen.findByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(router.state.location.href).toBe('/trabajos/t1'))
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('sin returnTo, guardar deja la URL y avisa «Clínica actualizada»', async () => {
    setMatchMedia(true)
    vi.mocked(fetchClinics).mockResolvedValue(clinics)
    vi.mocked(updateClinic).mockResolvedValue(
      clinics[1] as Awaited<ReturnType<typeof updateClinic>>,
    )
    const { user, router } = renderWithQueryAndRouter(
      <ClinicsPage editId="c2" onEditHandled={() => {}} />,
    )
    await user.click(await screen.findByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Clínica actualizada'))
    expect(router.state.location.href).toBe('/')
  })

  it('una clínica que no está en la lista (inactiva) se busca y abre con su nota', async () => {
    setMatchMedia(true)
    vi.mocked(fetchClinics).mockResolvedValue(clinics)
    vi.mocked(fetchClinic).mockResolvedValue({
      ...clinics[0],
      id: 'c9',
      name: 'Clínica Vieja',
      active: false,
      doctors: [],
    } as unknown as Awaited<ReturnType<typeof fetchClinic>>)
    const onHandled = vi.fn()
    renderWithQueryAndRouter(<ClinicsPage editId="c9" onEditHandled={onHandled} />)
    const dialog = await screen.findByRole('dialog', { name: 'Editar clínica' })
    expect(screen.getByLabelText('Nombre')).toHaveValue('Clínica Vieja')
    expect(dialog).toHaveAccessibleDescription(
      'Clínica inactiva: actívala para que vuelva a salir en las listas.',
    )
    expect(onHandled).toHaveBeenCalledTimes(1)
  })

  it('una clínica inexistente avisa y no abre nada', async () => {
    setMatchMedia(true)
    vi.mocked(fetchClinics).mockResolvedValue(clinics)
    vi.mocked(fetchClinic).mockRejectedValue(new ApiError('La clínica no existe', 404))
    const onHandled = vi.fn()
    renderWithQueryAndRouter(<ClinicsPage editId="zzz" onEditHandled={onHandled} />)
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Esa clínica ya no existe'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(onHandled).toHaveBeenCalledTimes(1)
  })

  it('un fallo al buscar la clínica avisa con su mensaje y no abre nada', async () => {
    setMatchMedia(true)
    vi.mocked(fetchClinics).mockResolvedValue(clinics)
    vi.mocked(fetchClinic).mockRejectedValue(new ApiError('Error', 500))
    renderWithQueryAndRouter(<ClinicsPage editId="zzz" onEditHandled={() => {}} />)
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Error'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('cerrado el diálogo, el mismo editar no lo reabre', async () => {
    setMatchMedia(true)
    vi.mocked(fetchClinics).mockResolvedValue(clinics)
    function Harness() {
      const [n, setN] = useState(0)
      return (
        <>
          <button onClick={() => setN(n + 1)}>Repintar {n}</button>
          <ClinicsPage editId="c2" onEditHandled={() => {}} />
        </>
      )
    }
    const { user } = renderWithQueryAndRouter(<Harness />)
    await user.click(await screen.findByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /Repintar/ }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('un segundo editar para la misma clínica, tras limpiarse de la URL, vuelve a abrirla', async () => {
    setMatchMedia(true)
    vi.mocked(fetchClinics).mockResolvedValue(clinics)
    function Harness() {
      const [id, setId] = useState<string | undefined>('c2')
      return (
        <>
          <button onClick={() => setId('c2')}>Editar de nuevo</button>
          <ClinicsPage editId={id} onEditHandled={() => setId(undefined)} />
        </>
      )
    }
    const { user } = renderWithQueryAndRouter(<Harness />)
    await user.click(await screen.findByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Editar de nuevo' }))
    expect(await screen.findByRole('dialog', { name: 'Editar clínica' })).toBeInTheDocument()
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
