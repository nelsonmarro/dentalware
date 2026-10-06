import { screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import type { Stage } from '@/features/stages/api'
import type { CaseDetail } from './api'
import { ProductionPanel } from './production-panel'

const { changeStage, postCaseAction, fetchTechnicians, assignTechnician, createRemake, fetchCase } =
  vi.hoisted(() => ({
    changeStage: vi.fn(),
    postCaseAction: vi.fn(),
    fetchTechnicians: vi.fn(),
    assignTechnician: vi.fn(),
    createRemake: vi.fn(),
    fetchCase: vi.fn(),
  }))
vi.mock('./api', () => ({
  changeStage,
  postCaseAction,
  fetchTechnicians,
  assignTechnician,
  createRemake,
  fetchCase,
}))

beforeEach(() => {
  vi.clearAllMocks()
  fetchTechnicians.mockResolvedValue([{ id: 't1', name: 'Ana Técnica' }])
})

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
  stage({ id: 'f3', name: 'Acabado', sort: 2 }),
]

function caso(overrides: Partial<CaseDetail> = {}): CaseDetail {
  return {
    id: 'c1',
    code: '26-00001',
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
    total: '90.00',
    createdBy: 'user-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    clinic: { id: 'clinica-1', name: 'Clínica Uno' },
    doctor: { id: 'doctor-1', name: 'Dr. Gómez' },
    technician: null,
    stage: null,
    items: [],
    pendingDelivery: null,
    lastDelivered: null,
    ...overrides,
  } as unknown as CaseDetail
}

function primarios(panel: HTMLElement) {
  return within(panel)
    .getAllByRole('button')
    .filter((b) => b.getAttribute('data-variant') === 'default')
    .map((b) => b.textContent)
}

/** Quien usa la app (`self`, obligatorio donde un mensajero llega al envío). */
const yo = { id: 'u-yo', name: 'Yo' }

describe('ProductionPanel', () => {
  // Tarea 5 (ENT-2): la ficha completa pasa quién usa la app hasta el diálogo de envío, para
  // que el mensajero envíe con él mismo.
  it('el mensajero marca enviado con su nombre fijo en el diálogo', async () => {
    const { user } = renderWithProviders(
      <ProductionPanel
        case={caso({ status: 'terminado', currentStageId: null })}
        missing={[]}
        role="mensajero"
        self={{ id: 'm7', name: 'Mario Mensajero' }}
        stages={fases}
      />,
    )
    await user.click(await screen.findByRole('button', { name: 'Marcar enviado' }))
    const dialog = await screen.findByRole('dialog', { name: 'Marcar enviado' })
    expect(within(dialog).getByText('Mario Mensajero')).toBeInTheDocument()
  })

  it('es una sección con encabezado «Producción» y la fase como subencabezado', async () => {
    renderWithProviders(
      <ProductionPanel self={yo} case={caso()} missing={[]} role="admin" stages={fases} />,
    )
    expect(await screen.findByRole('region', { name: 'Producción' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Producción' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Fase' })).toBeInTheDocument()
  })

  // UX3-04/UX3-05: antes de la última fase el único primario es «Avanzar fase»; «Finalizar»
  // sigue disponible, pero en secundario.
  it.each(['admin', 'tecnico'] as const)(
    'antes de la última fase el único primario para %s es «Avanzar fase»',
    async (role) => {
      renderWithProviders(
        <ProductionPanel
          self={yo}
          case={caso({ currentStageId: 'f1' })}
          missing={[]}
          role={role}
          stages={fases}
        />,
      )
      const panel = await screen.findByRole('region', { name: 'Producción' })
      expect(primarios(panel)).toEqual(['Avanzar fase'])
      expect(within(panel).getByRole('button', { name: 'Finalizar' })).toHaveAttribute(
        'data-variant',
        'outline',
      )
    },
  )

  it('en la última fase el único primario es «Finalizar»', async () => {
    renderWithProviders(
      <ProductionPanel
        self={yo}
        case={caso({ currentStageId: 'f3' })}
        missing={[]}
        role="tecnico"
        stages={fases}
      />,
    )
    const panel = await screen.findByRole('region', { name: 'Producción' })
    expect(primarios(panel)).toEqual(['Finalizar'])
    expect(within(panel).queryByRole('button', { name: 'Avanzar fase' })).not.toBeInTheDocument()
  })

  it('mientras las fases cargan «Finalizar» no se adelanta como primario', async () => {
    renderWithProviders(
      <ProductionPanel
        self={yo}
        case={caso({ currentStageId: 'f1' })}
        missing={[]}
        role="admin"
        stages={[]}
      />,
    )
    const panel = await screen.findByRole('region', { name: 'Producción' })
    expect(within(panel).getByRole('button', { name: 'Finalizar' })).toHaveAttribute(
      'data-variant',
      'outline',
    )
  })

  // M-1/M-2 (revisión de la Tarea 4): sin fase siguiente conocida «Avanzar fase» sigue montado
  // (deshabilitado) pero no como primario; el único primario es «Finalizar».
  it('si las fases no se pudieron cargar el único primario es «Finalizar»', async () => {
    renderWithProviders(
      <ProductionPanel
        self={yo}
        case={caso({ currentStageId: 'f1' })}
        missing={[]}
        role="admin"
        stages={[]}
        stagesError
      />,
    )
    const panel = await screen.findByRole('region', { name: 'Producción' })
    expect(primarios(panel)).toEqual(['Finalizar'])
  })

  it('si la fase actual fue desactivada el único primario es «Finalizar»', async () => {
    renderWithProviders(
      <ProductionPanel
        self={yo}
        case={caso({ currentStageId: 'f2' })}
        missing={[]}
        role="tecnico"
        stages={[
          fases[0]!,
          stage({ id: 'f2', name: 'Fresado', sort: 1, active: false }),
          fases[2]!,
        ]}
      />,
    )
    const panel = await screen.findByRole('region', { name: 'Producción' })
    expect(primarios(panel)).toEqual(['Finalizar'])
    expect(within(panel).getByRole('button', { name: 'Avanzar fase' })).toBeDisabled()
  })

  it('mientras las fases cargan no hay ningún primario', async () => {
    renderWithProviders(
      <ProductionPanel
        self={yo}
        case={caso({ currentStageId: 'f1' })}
        missing={[]}
        role="admin"
        stages={[]}
      />,
    )
    const panel = await screen.findByRole('region', { name: 'Producción' })
    expect(primarios(panel)).toEqual([])
  })

  it('reúne la fase, el técnico responsable y las acciones de estado', async () => {
    renderWithProviders(
      <ProductionPanel
        self={yo}
        case={caso({ currentStageId: 'f2' })}
        missing={[]}
        role="recepcion"
        stages={fases}
      />,
    )
    const panel = await screen.findByRole('region', { name: 'Producción' })
    expect(within(panel).getByText('Fresado')).toBeInTheDocument()
    expect(within(panel).getByLabelText('Técnico responsable')).toBeInTheDocument()
    expect(within(panel).getByRole('group', { name: 'Acciones del trabajo' })).toBeInTheDocument()
    expect(within(panel).getByRole('button', { name: 'Pausar' })).toBeInTheDocument()
  })

  // UX3-05: «Repetir» va en la barra de acciones como secundaria, no suelto entre tarjetas.
  it('«Repetir» va en la barra de acciones como secundaria para recepción', async () => {
    renderWithProviders(
      <ProductionPanel
        self={yo}
        case={caso({ status: 'entregado' })}
        missing={[]}
        role="recepcion"
        stages={fases}
      />,
    )
    const barra = await screen.findByRole('group', { name: 'Acciones del trabajo' })
    expect(within(barra).getByRole('button', { name: 'Repetir' })).toHaveAttribute(
      'data-variant',
      'outline',
    )
  })

  it('un técnico no ve «Repetir» en un trabajo entregado', async () => {
    // `RemakeDialog` no recibe `role`: toda la defensa de la UI es el guardián de quien lo
    // monta (I-3 de la revisión de la Tarea 9). La API ya lo rechaza; esto fija la UI.
    renderWithProviders(
      <ProductionPanel
        self={yo}
        case={caso({ status: 'entregado' })}
        missing={[]}
        role="tecnico"
        stages={fases}
      />,
    )
    await screen.findByRole('region', { name: 'Entrega' })
    expect(screen.queryByRole('button', { name: 'Repetir' })).not.toBeInTheDocument()
  })

  // UX3-25: nada de contenedores vacíos cuando una parte no aplica.
  it('en un trabajo nuevo no deja hueco de fase ni de «Repetir»', async () => {
    renderWithProviders(
      <ProductionPanel
        self={yo}
        case={caso({ status: 'nuevo', currentStageId: null })}
        missing={[]}
        role="admin"
        stages={fases}
      />,
    )
    const panel = await screen.findByRole('region', { name: 'Producción' })
    expect(within(panel).queryByRole('heading', { name: 'Fase' })).toBeNull()
    expect(primarios(panel)).toEqual(['Aceptar'])
    for (const el of panel.querySelectorAll('div')) {
      expect(el.childNodes.length, el.outerHTML).toBeGreaterThan(0)
    }
  })

  // UX4-09: la entrega va en el mismo panel que su acción.
  it('en un trabajo enviado dice con quién salió y para cuándo', async () => {
    renderWithProviders(
      <ProductionPanel
        self={yo}
        case={caso({
          status: 'enviado',
          currentStageId: null,
          pendingDelivery: {
            id: 'd1',
            type: 'entrega',
            courierId: 'm1',
            courierName: 'Mario Mensajero',
            scheduledFor: '2999-10-09',
          },
        })}
        missing={[]}
        role="recepcion"
        stages={fases}
      />,
    )
    expect(await screen.findByText('Sale el 09/10/2999 con Mario Mensajero')).toBeInTheDocument()
  })

  // #118: recogido y aún sin recibir, recepción lo ve en camino y sigue teniendo «Recibido».
  it('lo que viene en camino lo dice en el panel «Recogida» y recepción sigue con «Recibido»', async () => {
    renderWithProviders(
      <ProductionPanel
        self={yo}
        case={caso({
          status: 'por_recoger',
          currentStageId: null,
          pendingDelivery: null,
          // Hoy a las 10:32 locales: recogido hoy, solo la hora.
          lastPickedUp: {
            doneAt: new Date(new Date().setHours(10, 32, 0, 0)).toISOString(),
            courierName: 'Mario Mensajero',
          },
        })}
        missing={[]}
        role="recepcion"
        stages={fases}
      />,
    )
    const panel = await screen.findByRole('region', { name: 'Recogida' })
    expect(
      within(panel).getByText(
        'En camino al laboratorio · Recogido por Mario Mensajero a las 10:32',
      ),
    ).toBeInTheDocument()
    expect(within(panel).getByRole('button', { name: 'Recibido' })).toBeInTheDocument()
  })

  // UX4-24: el panel se llama por lo que toca hacer y, al traer o llevar el trabajo, la acción
  // va antes que el técnico responsable.
  it.each([
    ['por_recoger', 'Recogida', 'Recibido'],
    ['terminado', 'Entrega', 'Marcar enviado'],
    ['enviado', 'Entrega', 'Marcar entregado'],
  ] as const)(
    'en «%s» el panel se llama «%s» y «%s» va antes del técnico',
    async (status, titulo, accion) => {
      renderWithProviders(
        <ProductionPanel
          self={yo}
          case={caso({ status, currentStageId: null })}
          missing={[]}
          role="recepcion"
          stages={fases}
        />,
      )
      const panel = await screen.findByRole('region', { name: titulo })
      expect(within(panel).getByRole('heading', { level: 2, name: titulo })).toBeInTheDocument()
      const boton = within(panel).getByRole('button', { name: accion })
      const tecnico = within(panel).getByText('Técnico responsable')
      expect(boton.compareDocumentPosition(tecnico) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    },
  )

  it('en producción el técnico va antes de las acciones', async () => {
    renderWithProviders(
      <ProductionPanel
        self={yo}
        case={caso({ status: 'nuevo', currentStageId: null })}
        missing={[]}
        role="recepcion"
        stages={fases}
      />,
    )
    const panel = await screen.findByRole('region', { name: 'Producción' })
    const tecnico = within(panel).getByText('Técnico responsable')
    const boton = within(panel).getByRole('button', { name: 'Aceptar' })
    expect(tecnico.compareDocumentPosition(boton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  // M-5 (revisión de la Tarea 4): ids de `useId()`, no escritos a mano, para que dos paneles
  // (o una prueba que monta varios) no compartan el id del título.
  it('dos paneles montados no comparten ids de título', async () => {
    renderWithProviders(
      <>
        <ProductionPanel self={yo} case={caso()} missing={[]} role="admin" stages={fases} />
        <ProductionPanel self={yo} case={caso()} missing={[]} role="admin" stages={fases} />
      </>,
    )
    const regiones = await screen.findAllByRole('region', { name: 'Producción' })
    expect(regiones).toHaveLength(2)
    const ids = [...document.querySelectorAll('[aria-labelledby]')].map((el) =>
      el.getAttribute('aria-labelledby'),
    )
    expect(ids).toHaveLength(4)
    expect(new Set(ids).size).toBe(4)
  })
})
