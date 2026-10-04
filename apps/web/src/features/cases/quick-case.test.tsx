import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api-error'
import type { Stage } from '@/features/stages/api'
import type * as ApiModule from './api'
import type { CaseDetail } from './api'
import { QuickCase } from './quick-case'

const { changeStage, fetchCaseByCode, postCaseAction } = vi.hoisted(() => ({
  changeStage: vi.fn(),
  fetchCaseByCode: vi.fn(),
  postCaseAction: vi.fn(),
}))
vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof ApiModule>()),
  changeStage,
  fetchCaseByCode,
  postCaseAction,
}))
const { fetchAttachments, uploadAttachment } = vi.hoisted(() => ({
  fetchAttachments: vi.fn(),
  uploadAttachment: vi.fn(),
}))
vi.mock('./attachments-api', () => ({ fetchAttachments, uploadAttachment }))
vi.mock('@/features/stages/api', () => ({ fetchStages: vi.fn() }))

import { fetchStages } from '@/features/stages/api'

beforeEach(() => {
  changeStage.mockReset()
  postCaseAction.mockReset()
  fetchCaseByCode.mockReset()
  uploadAttachment.mockReset()
  fetchAttachments.mockReset()
  fetchAttachments.mockResolvedValue([])
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
    await user.click(screen.getByRole('button', { name: 'Avanzar a Fresado' }))

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
    expect(screen.queryByRole('button', { name: /^Avanzar/ })).not.toBeInTheDocument()
  })

  it('un mensajero no ve el botón de avanzar fase (sin motivo: es por rol, no por estado)', async () => {
    fetchCaseByCode.mockResolvedValue({ case: caso(), missing: [] })
    vi.mocked(fetchStages).mockResolvedValue(fases)

    renderWithProviders(<QuickCase code="26-00123" role="mensajero" />)

    await screen.findByText('Modelado')
    expect(screen.queryByRole('button', { name: /^Avanzar/ })).not.toBeInTheDocument()
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

    // M-2 (revisión de la Tarea 5): «Entrega: —» no se lee; se dice con palabras.
    it('sin ninguna fecha dice «Entrega: sin fecha»', async () => {
      fetchCaseByCode.mockResolvedValue({
        case: caso({ dueDate: null, promisedDate: null }),
        missing: [],
      })
      vi.mocked(fetchStages).mockResolvedValue(fases)

      renderWithProviders(<QuickCase code="26-00123" role="tecnico" />)

      expect(await screen.findByText('Entrega: sin fecha')).toBeInTheDocument()
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

    // M-4 (revisión de la Tarea 5): hora fija. Con el reloj real, entre la fecha del test y el
    // `new Date()` del componente podía cambiar el día (medianoche) y el test fallaba al azar.
    // Solo se falsea `Date`: los temporizadores reales siguen moviendo `findBy*` y React Query.
    describe('con el reloj fijo', () => {
      beforeEach(() => {
        vi.useFakeTimers({ toFake: ['Date'] })
        vi.setSystemTime(new Date(2026, 9, 3, 23, 59, 59))
      })
      afterEach(() => {
        vi.useRealTimers()
      })

      it('con la entrega hoy dice «Vence hoy»', async () => {
        fetchCaseByCode.mockResolvedValue({
          case: caso({ promisedDate: '2026-10-03' }),
          missing: [],
        })
        vi.mocked(fetchStages).mockResolvedValue(fases)

        renderWithProviders(<QuickCase code="26-00123" role="tecnico" />)

        expect(await screen.findByText('Vence hoy')).toBeInTheDocument()
      })
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

    // Pantalla completa: «No encontrado» es su h1 (un h1 por página, convenciones §5).
    expect(
      await screen.findByRole('heading', { level: 1, name: 'No encontrado' }),
    ).toBeInTheDocument()
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

  // UX3-27: el botón dice a qué fase lleva; un toque accidental solo se deshace desde la
  // ficha completa y con motivo.
  it('tiene los botones «Avanzar a {fase siguiente}» y «Añadir foto»', async () => {
    fetchCaseByCode.mockResolvedValue({ case: caso(), missing: [] })
    vi.mocked(fetchStages).mockResolvedValue(fases)

    renderWithProviders(<QuickCase code="26-00123" role="tecnico" />)

    expect(await screen.findByRole('button', { name: 'Avanzar a Fresado' })).toBeInTheDocument()
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

  // UX3-08: «Fotos: N» confirma en la propia ficha que la foto entró (el aviso se va).
  // I-1 (revisión de la Tarea 5): foto es lo que tiene MIME de imagen, la misma regla que la
  // pestaña de la ficha completa; `kind` lo puede forzar el cliente (un escaneo es imagen).
  it('cuenta las fotos por su MIME, no por `kind`: una imagen «scan» sí, un PDF no', async () => {
    fetchCaseByCode.mockResolvedValue({ case: caso(), missing: [] })
    vi.mocked(fetchStages).mockResolvedValue(fases)
    fetchAttachments.mockResolvedValue([
      { id: 'a1', kind: 'photo', mime: 'image/jpeg' },
      { id: 'a2', kind: 'scan', mime: 'image/png' },
      { id: 'a3', kind: 'photo', mime: 'application/pdf' },
      { id: 'a4', kind: 'document', mime: 'application/pdf' },
      { id: 'a5', kind: 'document', mime: 'image/jpeg' },
    ])

    renderWithProviders(<QuickCase code="26-00123" role="tecnico" />)

    expect(await screen.findByText('Fotos: 3')).toBeInTheDocument()
    expect(fetchAttachments).toHaveBeenCalledWith('c1')
    // Mientras el código se resuelve no hay id: no se piden adjuntos de un trabajo vacío.
    expect(fetchAttachments).not.toHaveBeenCalledWith('')
  })

  it('tras subir una foto el contador sube', async () => {
    fetchCaseByCode.mockResolvedValue({ case: caso(), missing: [] })
    vi.mocked(fetchStages).mockResolvedValue(fases)
    fetchAttachments
      .mockResolvedValueOnce([])
      .mockResolvedValue([{ id: 'a1', kind: 'photo', mime: 'image/webp' }])
    uploadAttachment.mockResolvedValue({ attachment: { id: 'a1' } })
    const user = userEvent.setup()
    renderWithProviders(<QuickCase code="26-00123" role="tecnico" />)
    expect(await screen.findByText('Fotos: 0')).toBeInTheDocument()

    const file = new File(['contenido'], 'foto.png', { type: 'image/png' })
    await user.upload(screen.getByLabelText('Añadir foto'), file)

    expect(await screen.findByText('Fotos: 1')).toBeInTheDocument()
  })

  it('si las fases no cargan lo dice, en vez de dejar el botón deshabilitado sin motivo', async () => {
    fetchCaseByCode.mockResolvedValue({ case: caso(), missing: [] })
    vi.mocked(fetchStages).mockRejectedValue(new ApiError('Fallo', 500))

    renderWithProviders(<QuickCase code="26-00123" role="tecnico" />)

    expect(
      await screen.findByText('No se pudieron cargar las fases. Recarga la página.'),
    ).toBeInTheDocument()
    // Sin la lista de fases no se sabe cuál sigue: el botón no inventa un destino.
    expect(screen.getByRole('button', { name: 'Avanzar fase' })).toBeDisabled()
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

  // UX3-27: el texto sugería buscar en la lista, pero no había cómo llegar a ella.
  it('«No encontrado» ofrece ir a la lista de trabajos', async () => {
    fetchCaseByCode.mockRejectedValue(new ApiError('No encontrado', 404))
    vi.mocked(fetchStages).mockResolvedValue(fases)

    renderWithProviders(<QuickCase code="26-99999" role="tecnico" />)

    const link = await screen.findByRole('link', { name: 'Ir a trabajos' })
    expect(link).toHaveAttribute('href', '/trabajos')
  })

  it('«No encontrado» orienta a revisar el código impreso', async () => {
    fetchCaseByCode.mockRejectedValue(new ApiError('No encontrado', 404))
    vi.mocked(fetchStages).mockResolvedValue(fases)

    renderWithProviders(<QuickCase code="26-99999" role="tecnico" />)

    expect(await screen.findByText('No encontrado')).toBeInTheDocument()
    expect(screen.getByText(/Revisa el código impreso en la orden/)).toBeInTheDocument()
  })

  // #105: la ficha corta del mensajero es su acción de entrega, en grande y con el mismo diálogo
  // de la ficha completa; su foto es la constancia, no «Añadir foto».
  describe('como mensajero', () => {
    const mario = { id: 'm7', name: 'Mario Mensajero' }

    it.each([
      ['por_recoger', 'Recibido'],
      ['terminado', 'Marcar enviado'],
      ['enviado', 'Marcar entregado'],
    ] as const)('en «%s» ve «%s» grande y a todo el ancho', async (status, accion) => {
      fetchCaseByCode.mockResolvedValue({ case: caso({ status }), missing: [] })
      vi.mocked(fetchStages).mockResolvedValue(fases)
      renderWithProviders(<QuickCase code="26-00123" role="mensajero" self={mario} />)

      const boton = await screen.findByRole('button', { name: accion })
      expect(boton).toHaveClass('h-14', 'w-full')
      expect(screen.queryByRole('button', { name: 'Añadir foto' })).not.toBeInTheDocument()
      expect(screen.queryByLabelText('Añadir foto')).not.toBeInTheDocument()
    })

    it('«Marcar enviado» abre el mismo diálogo con su nombre fijo', async () => {
      fetchCaseByCode.mockResolvedValue({ case: caso({ status: 'terminado' }), missing: [] })
      vi.mocked(fetchStages).mockResolvedValue(fases)
      const user = userEvent.setup()
      renderWithProviders(<QuickCase code="26-00123" role="mensajero" self={mario} />)

      await user.click(await screen.findByRole('button', { name: 'Marcar enviado' }))
      const dialog = await screen.findByRole('dialog', { name: 'Marcar enviado' })
      expect(within(dialog).getByText('Mario Mensajero')).toBeInTheDocument()
    })

    it('«Recibido» se envía al primer toque', async () => {
      fetchCaseByCode.mockResolvedValue({ case: caso({ status: 'por_recoger' }), missing: [] })
      vi.mocked(fetchStages).mockResolvedValue(fases)
      postCaseAction.mockResolvedValue(caso({ status: 'nuevo' }))
      const user = userEvent.setup()
      renderWithProviders(<QuickCase code="26-00123" role="mensajero" self={mario} />)

      await user.click(await screen.findByRole('button', { name: 'Recibido' }))
      await waitFor(() =>
        expect(postCaseAction).toHaveBeenCalledWith('c1', { accion: 'recibir', motivo: null }),
      )
    })

    it('técnico y admin no cambian: sin acciones de entrega en la ficha corta', async () => {
      fetchCaseByCode.mockResolvedValue({ case: caso({ status: 'terminado' }), missing: [] })
      vi.mocked(fetchStages).mockResolvedValue(fases)
      for (const role of ['tecnico', 'admin'] as const) {
        const r = renderWithProviders(<QuickCase code="26-00123" role={role} self={mario} />)
        expect(await screen.findByRole('button', { name: 'Añadir foto' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Marcar enviado' })).not.toBeInTheDocument()
        r.unmount()
      }
    })
  })
})
