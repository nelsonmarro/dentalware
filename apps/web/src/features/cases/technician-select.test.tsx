import { screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import type { CaseDetail } from './api'
import { TechnicianSelect } from './technician-select'

const { assignTechnician, fetchTechnicians } = vi.hoisted(() => ({
  assignTechnician: vi.fn(),
  fetchTechnicians: vi.fn(),
}))
vi.mock('./api', () => ({ assignTechnician, fetchTechnicians }))

beforeEach(() => {
  assignTechnician.mockClear()
  assignTechnician.mockResolvedValue({ id: 'c1', assignedTechnicianId: 't2' })
  fetchTechnicians.mockReset()
  fetchTechnicians.mockResolvedValue([
    { id: 't1', name: 'Ana Técnica' },
    { id: 't2', name: 'Beto Técnico' },
  ])
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

describe('TechnicianSelect', () => {
  it('lista solo técnicos activos y guarda el cambio', async () => {
    const { user } = renderWithProviders(<TechnicianSelect case={caso({})} role="recepcion" />)
    const select = await screen.findByLabelText('Técnico responsable')
    await screen.findByRole('option', { name: 'Beto Técnico' })
    await user.selectOptions(select, 't2')
    await waitFor(() => expect(assignTechnician).toHaveBeenCalledWith('c1', { tecnicoId: 't2' }))
  })

  it('permite desasignar seleccionando "Sin asignar"', async () => {
    const { user } = renderWithProviders(
      <TechnicianSelect case={caso({ assignedTechnicianId: 't1' })} role="admin" />,
    )
    const select = await screen.findByLabelText('Técnico responsable')
    await user.selectOptions(select, '')
    await waitFor(() => expect(assignTechnician).toHaveBeenCalledWith('c1', { tecnicoId: null }))
  })

  it('un técnico ve el nombre pero no puede cambiarlo', async () => {
    renderWithProviders(
      <TechnicianSelect
        case={caso({ assignedTechnicianId: 't1', technician: { id: 't1', name: 'Ana Técnica' } })}
        role="tecnico"
      />,
    )
    expect(await screen.findByText('Ana Técnica')).toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(fetchTechnicians).not.toHaveBeenCalled()
  })

  it('un técnico sin asignar ve "Sin asignar"', async () => {
    renderWithProviders(<TechnicianSelect case={caso({})} role="mensajero" />)
    expect(await screen.findByText('Sin asignar')).toBeInTheDocument()
  })
})
