import { screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import type { CaseDetail } from './api'
import { CaseActions } from './case-actions'
import { useCase } from './use-cases'

const { postCaseAction, fetchCase } = vi.hoisted(() => ({
  postCaseAction: vi.fn(),
  fetchCase: vi.fn(),
}))
vi.mock('./api', () => ({ postCaseAction, fetchCase }))

beforeEach(() => {
  postCaseAction.mockClear()
  fetchCase.mockClear()
})

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
    status: 'nuevo',
    currentStageId: null,
    assignedTechnicianId: null,
    priority: 'normal',
    receivedAt: '2026-01-01',
    dueDate: '2026-01-15',
    promisedDate: null,
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

describe('CaseActions', () => {
  it('en un trabajo nuevo y completo ofrece Aceptar y Cancelar a recepción', async () => {
    renderWithProviders(
      <CaseActions case={caso({ status: 'nuevo' })} missing={[]} role="recepcion" />,
    )
    expect(await screen.findByRole('button', { name: 'Aceptar' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Cancelar trabajo' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Finalizar' })).not.toBeInTheDocument()
  })

  it('deshabilita Aceptar cuando el trabajo está incompleto', async () => {
    renderWithProviders(
      <CaseActions
        case={caso({ status: 'nuevo' })}
        missing={['Color', 'Prescripción']}
        role="recepcion"
      />,
    )
    // El texto de qué falta lo pinta `CaseHeader` ("Para aceptar falta: …"); aquí solo
    // importa que "Aceptar" quede deshabilitado, sin repetir el aviso (M-1).
    expect(await screen.findByRole('button', { name: 'Aceptar' })).toBeDisabled()
  })

  it('a un técnico no le ofrece Aceptar ni Cancelar', async () => {
    renderWithProviders(
      <CaseActions case={caso({ status: 'nuevo' })} missing={[]} role="tecnico" />,
    )
    await waitFor(() => expect(screen.queryAllByRole('button')).toHaveLength(0))
    expect(screen.queryByRole('button', { name: 'Aceptar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancelar trabajo' })).not.toBeInTheDocument()
  })

  it('pausar pide motivo y no envía hasta que se escribe', async () => {
    const { user } = renderWithProviders(
      <CaseActions case={caso({ status: 'en_proceso' })} missing={[]} role="recepcion" />,
    )
    await user.click(await screen.findByRole('button', { name: 'Pausar' }))
    const confirmar = screen.getByRole('button', { name: 'Confirmar' })
    await user.click(confirmar)
    expect(await screen.findByText('Escribe el motivo')).toBeInTheDocument()
    expect(postCaseAction).not.toHaveBeenCalled()
    await user.type(screen.getByLabelText('Motivo'), 'Falta antagonista')
    await user.click(confirmar)
    await waitFor(() =>
      expect(postCaseAction).toHaveBeenCalledWith('c1', {
        accion: 'pausar',
        motivo: 'Falta antagonista',
      }),
    )
  })

  it('un trabajo entregado no ofrece ninguna acción de estado', async () => {
    renderWithProviders(
      <CaseActions case={caso({ status: 'entregado' })} missing={[]} role="recepcion" />,
    )
    await waitFor(() => expect(screen.queryAllByRole('button')).toHaveLength(0))
  })

  it('finalizar pide confirmación con la consecuencia concreta y no se envía hasta confirmar', async () => {
    const { user } = renderWithProviders(
      <CaseActions case={caso({ status: 'en_proceso' })} missing={[]} role="recepcion" />,
    )
    await user.click(await screen.findByRole('button', { name: 'Finalizar' }))
    const dialog = screen.getByRole('alertdialog')
    expect(
      within(dialog).getByText(/No hay ninguna acción para devolverlo a "En proceso"/),
    ).toBeInTheDocument()
    expect(postCaseAction).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Finalizar' }))
    await waitFor(() =>
      expect(postCaseAction).toHaveBeenCalledWith('c1', { accion: 'finalizar', motivo: null }),
    )
  })

  it('un segundo clic mientras se confirma el cambio de estado no duplica la acción', async () => {
    // La lista de trabajos también monta `useCase('c1')` (misma clave que invalida la
    // mutación): así la invalidación de `useCaseAction` dispara un refetch real que
    // podemos mantener pendiente para reproducir la ventana entre "la API respondió" y
    // "el detalle todavía muestra el estado viejo" (M-3).
    fetchCase.mockResolvedValueOnce({ case: caso({ status: 'en_proceso' }), missing: [] })
    let resolveRefetch!: (value: unknown) => void
    fetchCase.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRefetch = resolve
      }),
    )

    function Harness() {
      useCase('c1')
      return <CaseActions case={caso({ status: 'en_proceso' })} missing={[]} role="recepcion" />
    }
    const { user } = renderWithProviders(<Harness />)

    const finalizarBtn = await screen.findByRole('button', { name: 'Finalizar' })
    await user.click(finalizarBtn)
    const dialog = screen.getByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Finalizar' }))

    await waitFor(() => expect(finalizarBtn).toBeDisabled())
    await user.click(finalizarBtn) // botón deshabilitado: no debe disparar una segunda mutación

    resolveRefetch({ case: caso({ status: 'terminado' }), missing: [] })

    await waitFor(() => expect(finalizarBtn).not.toBeDisabled())
    expect(postCaseAction).toHaveBeenCalledTimes(1)
  })
})
