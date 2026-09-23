import { screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import type { Stage } from '@/features/stages/api'
import type { CaseDetail } from './api'
import { StageControl } from './stage-control'
import { useCase } from './use-cases'

const { changeStage, fetchCase } = vi.hoisted(() => ({
  changeStage: vi.fn(),
  fetchCase: vi.fn(),
}))
vi.mock('./api', () => ({ changeStage, fetchCase }))

beforeEach(() => {
  changeStage.mockClear()
  fetchCase.mockClear()
  changeStage.mockResolvedValue({ id: 'c1', currentStageId: 'f2' })
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

describe('StageControl', () => {
  it('muestra la fase actual y avanza a la siguiente', async () => {
    const { user } = renderWithProviders(
      <StageControl
        case={caso({ status: 'en_proceso', currentStageId: 'f1' })}
        stages={fases}
        role="tecnico"
      />,
    )
    expect(await screen.findByText('Modelado')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Avanzar fase' }))
    await waitFor(() =>
      expect(changeStage).toHaveBeenCalledWith('c1', { direccion: 'avanzar', motivo: null }),
    )
  })

  it('retroceder pide motivo', async () => {
    const { user } = renderWithProviders(
      <StageControl
        case={caso({ status: 'en_proceso', currentStageId: 'f2' })}
        stages={fases}
        role="tecnico"
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Retroceder fase' }))
    expect(await screen.findByLabelText('Motivo')).toBeRequired()
  })

  it('retroceder envía el motivo escrito', async () => {
    const { user } = renderWithProviders(
      <StageControl
        case={caso({ status: 'en_proceso', currentStageId: 'f2' })}
        stages={fases}
        role="tecnico"
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Retroceder fase' }))
    await user.type(await screen.findByLabelText('Motivo'), 'Falla de encaje')
    await user.click(screen.getByRole('button', { name: 'Confirmar' }))
    await waitFor(() =>
      expect(changeStage).toHaveBeenCalledWith('c1', {
        direccion: 'retroceder',
        motivo: 'Falla de encaje',
      }),
    )
  })

  it('en la última fase no ofrece Avanzar y remite a las acciones de arriba', async () => {
    renderWithProviders(
      <StageControl
        case={caso({ status: 'en_proceso', currentStageId: 'f3' })}
        stages={fases}
        role="tecnico"
      />,
    )
    expect(await screen.findByText(/Es la última fase/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Avanzar fase' })).not.toBeInTheDocument()
    // "Finalizar" es de la barra de acciones (`case-actions.tsx`), único dueño de las
    // transiciones de estado: aquí duplicaba el botón y rompía los E2E por modo estricto.
    expect(screen.queryByRole('button', { name: 'Finalizar' })).not.toBeInTheDocument()
  })

  it('si la fase actual fue desactivada lo dice, sin dejar los botones mudos', async () => {
    renderWithProviders(
      <StageControl
        case={caso({ status: 'en_proceso', currentStageId: 'f2' })}
        stages={[
          fases[0]!,
          stage({ id: 'f2', name: 'Fresado', sort: 1, active: false }),
          fases[2]!,
        ]}
        role="tecnico"
      />,
    )
    // El nombre se sigue viendo: el técnico necesita saber en qué fase estaba.
    expect(await screen.findByText('Fresado')).toBeInTheDocument()
    expect(screen.getByText(/ya no está activa/)).toBeInTheDocument()
  })

  it('mientras las fases no han cargado dice "Cargando", no "Fase desconocida"', async () => {
    renderWithProviders(
      <StageControl
        case={caso({ status: 'en_proceso', currentStageId: 'f1' })}
        stages={[]}
        role="tecnico"
      />,
    )
    expect(await screen.findByText('Cargando…')).toBeInTheDocument()
    expect(screen.queryByText('Fase desconocida')).not.toBeInTheDocument()
  })

  it('retroceder no envía nada hasta que se escribe el motivo', async () => {
    const { user } = renderWithProviders(
      <StageControl
        case={caso({ status: 'en_proceso', currentStageId: 'f2' })}
        stages={fases}
        role="tecnico"
      />,
    )
    await user.click(await screen.findByRole('button', { name: 'Retroceder fase' }))
    const confirmar = screen.getByRole('button', { name: 'Confirmar' })
    await user.click(confirmar)
    expect(await screen.findByText('Escribe el motivo')).toBeInTheDocument()
    // Lo que de verdad importa: el `toBeRequired()` del textarea no bloquea nada en
    // ejecución (el formulario es `noValidate`), así que sin esta aserción el `zodResolver`
    // se podía quitar entero sin que cayera ningún test (M-3 de la revisión).
    expect(changeStage).not.toHaveBeenCalled()
    await user.type(screen.getByLabelText('Motivo'), 'La cofia no asienta')
    await user.click(confirmar)
    await waitFor(() =>
      expect(changeStage).toHaveBeenCalledWith('c1', {
        direccion: 'retroceder',
        motivo: 'La cofia no asienta',
      }),
    )
  })

  it('un trabajo en espera no deja cambiar de fase', async () => {
    renderWithProviders(
      <StageControl
        case={caso({ status: 'en_espera', currentStageId: 'f1' })}
        stages={fases}
        role="tecnico"
      />,
    )
    expect(await screen.findByText(/pausado/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Avanzar fase' })).not.toBeInTheDocument()
  })

  it('un mensajero no ve controles de fase, solo el nombre', async () => {
    renderWithProviders(
      <StageControl
        case={caso({ status: 'en_proceso', currentStageId: 'f1' })}
        stages={fases}
        role="mensajero"
      />,
    )
    expect(await screen.findByText('Modelado')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Avanzar fase' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Retroceder fase' })).not.toBeInTheDocument()
  })

  it('sin fase asignada (trabajo nuevo) no muestra nada', () => {
    const { container } = renderWithProviders(
      <StageControl
        case={caso({ status: 'nuevo', currentStageId: null })}
        stages={fases}
        role="tecnico"
      />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('un segundo toque mientras se confirma el avance no salta dos fases', async () => {
    // Mismo arnés que `case-actions.test.tsx`: la ruta monta `useCase(caseId)` junto al
    // componente, así que la invalidación dispara un refetch real que podemos retener para
    // reproducir la ventana entre "la API respondió" y "la tarjeta sigue mostrando la fase
    // anterior". Con `void invalidate()` el botón se rehabilitaba ahí y el técnico con
    // guantes saltaba dos fases, dejando dos `stage_changed` en la auditoría (I-2).
    fetchCase.mockResolvedValueOnce({
      case: caso({ status: 'en_proceso', currentStageId: 'f1' }),
      missing: [],
    })
    let resolveRefetch!: (value: unknown) => void
    fetchCase.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRefetch = resolve
      }),
    )

    function Harness() {
      useCase('c1')
      return (
        <StageControl
          case={caso({ status: 'en_proceso', currentStageId: 'f1' })}
          stages={fases}
          role="tecnico"
        />
      )
    }
    const { user } = renderWithProviders(<Harness />)

    const avanzar = await screen.findByRole('button', { name: 'Avanzar fase' })
    await user.click(avanzar)
    await waitFor(() => expect(avanzar).toBeDisabled())
    await user.click(avanzar) // deshabilitado: no debe disparar una segunda mutación

    resolveRefetch({ case: caso({ status: 'en_proceso', currentStageId: 'f2' }), missing: [] })

    await waitFor(() => expect(avanzar).not.toBeDisabled())
    expect(changeStage).toHaveBeenCalledTimes(1)
  })
})
