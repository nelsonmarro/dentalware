import { screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import type { CaseDetail } from './api'
import { CaseActions } from './case-actions'

const { postCaseAction } = vi.hoisted(() => ({ postCaseAction: vi.fn() }))
vi.mock('./api', () => ({ postCaseAction }))

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

  it('deshabilita Aceptar y dice qué falta cuando el trabajo está incompleto', async () => {
    renderWithProviders(
      <CaseActions
        case={caso({ status: 'nuevo' })}
        missing={['Color', 'Prescripción']}
        role="recepcion"
      />,
    )
    expect(await screen.findByRole('button', { name: 'Aceptar' })).toBeDisabled()
    expect(screen.getByText(/Falta: Color, Prescripción/)).toBeInTheDocument()
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
})
