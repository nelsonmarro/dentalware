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
    ...overrides,
  } as unknown as CaseDetail
}

function primarios(panel: HTMLElement) {
  return within(panel)
    .getAllByRole('button')
    .filter((b) => b.getAttribute('data-variant') === 'default')
    .map((b) => b.textContent)
}

describe('ProductionPanel', () => {
  it('es una sección con encabezado «Producción» y la fase como subencabezado', async () => {
    renderWithProviders(<ProductionPanel case={caso()} missing={[]} role="admin" stages={fases} />)
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

  it('reúne la fase, el técnico responsable y las acciones de estado', async () => {
    renderWithProviders(
      <ProductionPanel
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
        case={caso({ status: 'entregado' })}
        missing={[]}
        role="tecnico"
        stages={fases}
      />,
    )
    await screen.findByRole('region', { name: 'Producción' })
    expect(screen.queryByRole('button', { name: 'Repetir' })).not.toBeInTheDocument()
  })

  // UX3-25: nada de contenedores vacíos cuando una parte no aplica.
  it('en un trabajo nuevo no deja hueco de fase ni de «Repetir»', async () => {
    renderWithProviders(
      <ProductionPanel
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
})
