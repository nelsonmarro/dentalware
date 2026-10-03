import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { toIsoDate } from '@dentalware/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api-error'
import type { Stage } from '@/features/stages/api'
import type * as ApiModule from './api'
import type { CaseDetail } from './api'
import { QuickCase } from './quick-case'

const { changeStage, fetchCaseByCode } = vi.hoisted(() => ({
  changeStage: vi.fn(),
  fetchCaseByCode: vi.fn(),
}))
vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof ApiModule>()),
  changeStage,
  fetchCaseByCode,
}))
const { uploadAttachment } = vi.hoisted(() => ({ uploadAttachment: vi.fn() }))
vi.mock('./attachments-api', () => ({ uploadAttachment }))
vi.mock('@/features/stages/api', () => ({ fetchStages: vi.fn() }))

import { fetchStages } from '@/features/stages/api'

beforeEach(() => {
  changeStage.mockReset()
  fetchCaseByCode.mockReset()
  uploadAttachment.mockReset()
  vi.mocked(fetchStages).mockReset()
  changeStage.mockResolvedValue({ id: 'c1', currentStageId: 'f2' })
})

/** Router + QueryClient a la vez (mismo patrón que `my-cases.test.tsx`): `QuickCase` fetchea
 * con `useCaseByCode`/`useStages` (TanStack Query) y enlaza "Ver ficha completa" con `<Link>`. */
function renderWithProviders(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const router = createRouter({
    routeTree: createRootRoute({
      component: () => <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
    }),
    history: createMemoryHistory(),
  })
  return render(<RouterProvider router={router} />)
}

function stage(overrides: Partial<Stage> = {}): Stage {
  return {
    id: 'f1',
    name: 'Modelado',
    color: '#0F766E',
    sort: 0,
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as unknown as Stage
}

const fases: Stage[] = [
  stage({ id: 'f1', name: 'Modelado', sort: 0 }),
  stage({ id: 'f2', name: 'Fresado', sort: 1 }),
]

function caso(overrides: Partial<CaseDetail> = {}): CaseDetail {
  return {
    id: 'c1',
    code: '26-00123',
    boxNumber: null,
    clinicId: 'clinica-1',
    doctorId: 'doctor-1',
    patientRef: 'Juan Pérez',
    patientAge: null,
    patientSex: null,
    status: 'en_proceso',
    currentStageId: 'f1',
    assignedTechnicianId: null,
    priority: 'normal',
    receivedAt: '2026-01-01',
    dueDate: '2026-01-15',
    promisedDate: '2026-01-20',
    finishedAt: null,
    shippedAt: null,
    deliveredAt: null,
    paidAt: null,
    shade: null,
    shadeSystem: null,
    reference: null,
    checklist: { antagonista: false, mordida: false, color: false, fotos: false },
    observations: null,
    prescription: null,
    internalNotes: null,
    holdReason: null,
    parentCaseId: null,
    remakeReason: null,
    remakeResponsibility: null,
    remakeChargePct: null,
    total: null,
    createdBy: 'user-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    clinic: { id: 'clinica-1', name: 'Clínica Uno' },
    doctor: { id: 'doctor-1', name: 'Dr. Gómez' },
    technician: null,
    stage: { id: 'f1', name: 'Modelado', color: '#0F766E' },
    items: [],
    ...overrides,
  } as unknown as CaseDetail
}

describe('QuickCase', () => {
  it('muestra el código, el paciente y la fase actual', async () => {
    fetchCaseByCode.mockResolvedValue({ case: caso(), missing: [] })
    vi.mocked(fetchStages).mockResolvedValue(fases)

    renderWithProviders(<QuickCase code="26-00123" role="tecnico" />)

    expect(await screen.findByRole('heading', { level: 1, name: '26-00123' })).toBeInTheDocument()
    expect(screen.getByText('Juan Pérez')).toBeInTheDocument()
    expect(screen.getByText('Modelado')).toBeInTheDocument()
  })

  it('avanza la fase y muestra la fase nueva tras la mutación', async () => {
    fetchCaseByCode.mockResolvedValueOnce({ case: caso(), missing: [] })
    fetchCaseByCode.mockResolvedValueOnce({
      case: caso({ currentStageId: 'f2', stage: { id: 'f2', name: 'Fresado', color: '#0F766E' } }),
      missing: [],
    })
    vi.mocked(fetchStages).mockResolvedValue(fases)

    const user = userEvent.setup()
    renderWithProviders(<QuickCase code="26-00123" role="tecnico" />)

    await screen.findByText('Modelado')
    await user.click(screen.getByRole('button', { name: 'Avanzar fase' }))

    await waitFor(() =>
      expect(changeStage).toHaveBeenCalledWith('c1', { direccion: 'avanzar', motivo: null }),
    )
    expect(await screen.findByText('Fresado')).toBeInTheDocument()
    expect(screen.queryByText('Modelado')).not.toBeInTheDocument()
  })

  it('bloqueada por el estado muestra el motivo, sin botón de avanzar', async () => {
    fetchCaseByCode.mockResolvedValue({
      case: caso({ status: 'en_espera', holdReason: 'Falta color' }),
      missing: [],
    })
    vi.mocked(fetchStages).mockResolvedValue(fases)

    renderWithProviders(<QuickCase code="26-00123" role="tecnico" />)

    expect(
      await screen.findByText('El trabajo está en espera: reanúdalo para poder cambiar de fase.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Avanzar fase' })).not.toBeInTheDocument()
  })

  it('un mensajero no ve el botón de avanzar fase (sin motivo: es por rol, no por estado)', async () => {
    fetchCaseByCode.mockResolvedValue({ case: caso(), missing: [] })
    vi.mocked(fetchStages).mockResolvedValue(fases)

    renderWithProviders(<QuickCase code="26-00123" role="mensajero" />)

    await screen.findByText('Modelado')
    expect(screen.queryByRole('button', { name: 'Avanzar fase' })).not.toBeInTheDocument()
  })

  // UX3-23: `finalizar`/`cancelar` no limpian `currentStageId`, así que un trabajo terminado
  // sigue trayendo fase; la ficha corta decía «Fase: Recepción» de un trabajo ya hecho.
  it('un trabajo terminado no muestra la fase en la que quedó', async () => {
    fetchCaseByCode.mockResolvedValue({ case: caso({ status: 'terminado' }), missing: [] })
    vi.mocked(fetchStages).mockResolvedValue(fases)

    renderWithProviders(<QuickCase code="26-00123" role="tecnico" />)

    await screen.findByRole('heading', { level: 1, name: '26-00123' })
    expect(screen.queryByText('Fase:')).not.toBeInTheDocument()
    expect(screen.queryByText('Modelado')).not.toBeInTheDocument()
  })

  it('un trabajo en espera sí muestra la fase en la que se quedó', async () => {
    fetchCaseByCode.mockResolvedValue({ case: caso({ status: 'en_espera' }), missing: [] })
    vi.mocked(fetchStages).mockResolvedValue(fases)

    renderWithProviders(<QuickCase code="26-00123" role="tecnico" />)

    expect(await screen.findByText('Modelado')).toBeInTheDocument()
  })

  // UX3-22: lo que el técnico necesita saber en el banco es para cuándo es y si urge; antes
  // solo lo decía la ficha completa.
  describe('entrega y urgencia', () => {
    it('dice la fecha de entrega comprometida', async () => {
      fetchCaseByCode.mockResolvedValue({
        case: caso({ dueDate: '2999-03-01', promisedDate: '2999-03-04' }),
        missing: [],
      })
      vi.mocked(fetchStages).mockResolvedValue(fases)

      renderWithProviders(<QuickCase code="26-00123" role="tecnico" />)

      expect(await screen.findByText('Entrega: 04/03/2999')).toBeInTheDocument()
    })

    it('sin fecha comprometida dice la deseada', async () => {
      fetchCaseByCode.mockResolvedValue({
        case: caso({ dueDate: '2999-03-01', promisedDate: null }),
        missing: [],
      })
      vi.mocked(fetchStages).mockResolvedValue(fases)

      renderWithProviders(<QuickCase code="26-00123" role="tecnico" />)

      expect(await screen.findByText('Entrega: 01/03/2999')).toBeInTheDocument()
    })

    it('un trabajo urgente lo dice con texto', async () => {
      fetchCaseByCode.mockResolvedValue({
        case: caso({ priority: 'urgente', promisedDate: '2999-03-04' }),
        missing: [],
      })
      vi.mocked(fetchStages).mockResolvedValue(fases)

      renderWithProviders(<QuickCase code="26-00123" role="tecnico" />)

      expect(await screen.findByText('Urgente')).toBeInTheDocument()
    })

    it('un trabajo normal a tiempo no muestra avisos', async () => {
      fetchCaseByCode.mockResolvedValue({ case: caso({ promisedDate: '2999-03-04' }), missing: [] })
      vi.mocked(fetchStages).mockResolvedValue(fases)

      renderWithProviders(<QuickCase code="26-00123" role="tecnico" />)

      await screen.findByText('Entrega: 04/03/2999')
      expect(screen.queryByText('Urgente')).not.toBeInTheDocument()
      expect(screen.queryByText('Atrasado')).not.toBeInTheDocument()
      expect(screen.queryByText('Vence hoy')).not.toBeInTheDocument()
    })

    it('con la entrega vencida dice «Atrasado»', async () => {
      fetchCaseByCode.mockResolvedValue({ case: caso({ promisedDate: '2020-01-15' }), missing: [] })
      vi.mocked(fetchStages).mockResolvedValue(fases)

      renderWithProviders(<QuickCase code="26-00123" role="tecnico" />)

      expect(await screen.findByText('Atrasado')).toBeInTheDocument()
    })

    it('con la entrega hoy dice «Vence hoy»', async () => {
      fetchCaseByCode.mockResolvedValue({
        case: caso({ promisedDate: toIsoDate(new Date()) }),
        missing: [],
      })
      vi.mocked(fetchStages).mockResolvedValue(fases)

      renderWithProviders(<QuickCase code="26-00123" role="tecnico" />)

      expect(await screen.findByText('Vence hoy')).toBeInTheDocument()
    })

    it('un trabajo terminado con la fecha pasada no se marca atrasado (misma regla que la lista)', async () => {
      fetchCaseByCode.mockResolvedValue({
        case: caso({ status: 'terminado', promisedDate: '2020-01-15' }),
        missing: [],
      })
      vi.mocked(fetchStages).mockResolvedValue(fases)

      renderWithProviders(<QuickCase code="26-00123" role="tecnico" />)

      await screen.findByText('Entrega: 15/01/2020')
      expect(screen.queryByText('Atrasado')).not.toBeInTheDocument()
    })
  })

  it('un código inexistente muestra No encontrado', async () => {
    fetchCaseByCode.mockRejectedValue(new ApiError('No encontrado', 404))
    vi.mocked(fetchStages).mockResolvedValue(fases)

    renderWithProviders(<QuickCase code="26-99999" role="tecnico" />)

    expect(await screen.findByText('No encontrado')).toBeInTheDocument()
  })

  it('un código mal formado (422) también muestra No encontrado', async () => {
    fetchCaseByCode.mockRejectedValue(new ApiError('Datos inválidos', 422))
    vi.mocked(fetchStages).mockResolvedValue(fases)

    renderWithProviders(<QuickCase code="no-es-un-codigo" role="tecnico" />)

    expect(await screen.findByText('No encontrado')).toBeInTheDocument()
  })

  it('no muestra precios', async () => {
    fetchCaseByCode.mockResolvedValue({ case: caso({ total: '450.00' }), missing: [] })
    vi.mocked(fetchStages).mockResolvedValue(fases)

    renderWithProviders(<QuickCase code="26-00123" role="tecnico" />)

    await screen.findByRole('heading', { level: 1, name: '26-00123' })
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument()
    expect(screen.queryByText('450.00')).not.toBeInTheDocument()
  })

  it('tiene los botones "Avanzar fase" y "Añadir foto"', async () => {
    fetchCaseByCode.mockResolvedValue({ case: caso(), missing: [] })
    vi.mocked(fetchStages).mockResolvedValue(fases)

    renderWithProviders(<QuickCase code="26-00123" role="tecnico" />)

    expect(await screen.findByRole('button', { name: 'Avanzar fase' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Añadir foto' })).toBeInTheDocument()
    expect(screen.getByLabelText('Añadir foto')).toHaveAttribute('capture', 'environment')
  })

  it('enlaza a la ficha completa del trabajo', async () => {
    fetchCaseByCode.mockResolvedValue({ case: caso(), missing: [] })
    vi.mocked(fetchStages).mockResolvedValue(fases)

    renderWithProviders(<QuickCase code="26-00123" role="tecnico" />)

    const link = await screen.findByRole('link', { name: 'Ver ficha completa' })
    expect(link).toHaveAttribute('href', '/trabajos/c1')
  })

  it('«Añadir foto» sube la imagen al trabajo del código escaneado', async () => {
    // Hallazgo I-1 de la revisión de la Tarea 15: sin este test, desconectar el input o
    // subir a un id vacío pasaba desapercibido.
    fetchCaseByCode.mockResolvedValue({ case: caso(), missing: [] })
    vi.mocked(fetchStages).mockResolvedValue(fases)
    uploadAttachment.mockResolvedValue({ attachment: { id: 'a1' } })
    const user = userEvent.setup()
    renderWithProviders(<QuickCase code="26-00123" role="tecnico" />)
    await screen.findByRole('heading', { level: 1, name: '26-00123' })

    const file = new File(['contenido'], 'foto.png', { type: 'image/png' })
    await user.upload(screen.getByLabelText('Añadir foto'), file)

    await waitFor(() => expect(uploadAttachment).toHaveBeenCalledWith('c1', expect.any(FormData)))
  })

  it('si las fases no cargan lo dice, en vez de dejar el botón deshabilitado sin motivo', async () => {
    fetchCaseByCode.mockResolvedValue({ case: caso(), missing: [] })
    vi.mocked(fetchStages).mockRejectedValue(new ApiError('Fallo', 500))

    renderWithProviders(<QuickCase code="26-00123" role="tecnico" />)

    expect(
      await screen.findByText('No se pudieron cargar las fases. Recarga la página.'),
    ).toBeInTheDocument()
  })

  it('si la fase actual está desactivada explica cómo seguir', async () => {
    fetchCaseByCode.mockResolvedValue({ case: caso(), missing: [] })
    vi.mocked(fetchStages).mockResolvedValue([
      stage({ id: 'f1', name: 'Modelado', sort: 0, active: false }),
      stage({ id: 'f2', name: 'Fresado', sort: 1 }),
    ])

    renderWithProviders(<QuickCase code="26-00123" role="tecnico" />)

    expect(
      await screen.findByText(/La fase en la que estaba este trabajo ya no está activa/),
    ).toBeInTheDocument()
  })

  // UX3-02: un fallo de red o del servidor no es "no encontrado" — ese texto sugiere que el
  // código no existe, cuando en realidad la petición ni llegó a resolverse.
  it('un fallo de red no muestra "No encontrado": ofrece reintentar, ya enfocado', async () => {
    fetchCaseByCode.mockRejectedValue(new TypeError('Failed to fetch'))
    vi.mocked(fetchStages).mockResolvedValue(fases)

    renderWithProviders(<QuickCase code="26-00123" role="tecnico" />)

    const retry = await screen.findByRole('button', { name: 'Reintentar' })
    expect(screen.queryByText('No encontrado')).not.toBeInTheDocument()
    // Ronda de fixes 2 (I-1): este `LoadError` sustituye toda la ficha corta, así que enfoca.
    expect(retry).toHaveFocus()
  })

  it('un error 500 del servidor tampoco muestra "No encontrado"', async () => {
    fetchCaseByCode.mockRejectedValue(new ApiError('Error interno', 500))
    vi.mocked(fetchStages).mockResolvedValue(fases)

    renderWithProviders(<QuickCase code="26-00123" role="tecnico" />)

    expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    expect(screen.queryByText('No encontrado')).not.toBeInTheDocument()
  })

  it('«No encontrado» orienta a revisar el código impreso', async () => {
    fetchCaseByCode.mockRejectedValue(new ApiError('No encontrado', 404))
    vi.mocked(fetchStages).mockResolvedValue(fases)

    renderWithProviders(<QuickCase code="26-99999" role="tecnico" />)

    expect(await screen.findByText('No encontrado')).toBeInTheDocument()
    expect(screen.getByText(/Revisa el código impreso en la orden/)).toBeInTheDocument()
  })
})
