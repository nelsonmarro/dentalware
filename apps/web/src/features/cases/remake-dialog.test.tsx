import { screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import type { CaseDetail } from './api'
import { RemakeDialog } from './remake-dialog'

const { createRemake } = vi.hoisted(() => ({ createRemake: vi.fn() }))
vi.mock('./api', () => ({ createRemake }))

beforeEach(() => {
  createRemake.mockClear()
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
    status: 'entregado',
    currentStageId: null,
    assignedTechnicianId: null,
    priority: 'normal',
    receivedAt: '2026-01-01',
    dueDate: '2026-01-15',
    promisedDate: '2026-01-20',
    finishedAt: '2026-01-18T00:00:00.000Z',
    shippedAt: '2026-01-19T00:00:00.000Z',
    deliveredAt: '2026-01-20T00:00:00.000Z',
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

describe('RemakeDialog', () => {
  it('exige motivo antes de crear la repetición', async () => {
    const { user } = renderWithProviders(<RemakeDialog case={caso({ status: 'entregado' })} />)
    await user.click(await screen.findByRole('button', { name: 'Repetir' }))
    await user.click(screen.getByRole('button', { name: 'Crear repetición' }))
    expect(await screen.findByText('Escribe el motivo')).toBeInTheDocument()
    expect(createRemake).not.toHaveBeenCalled()
  })

  it('crea la repetición con los datos del formulario', async () => {
    const created = caso({ id: 'c2', code: '26-00002', status: 'nuevo', parentCaseId: 'c1' })
    createRemake.mockResolvedValue(created)
    const onCreated = vi.fn()
    const { user } = renderWithProviders(
      <RemakeDialog case={caso({ status: 'entregado' })} onCreated={onCreated} />,
    )
    await user.click(await screen.findByRole('button', { name: 'Repetir' }))
    await user.type(screen.getByLabelText('Motivo'), 'Fractura en cerámica al probar')
    await user.selectOptions(screen.getByLabelText('Responsabilidad'), 'laboratorio')
    await user.click(screen.getByRole('button', { name: 'Crear repetición' }))
    await waitFor(() =>
      expect(createRemake).toHaveBeenCalledWith('c1', {
        motivo: 'Fractura en cerámica al probar',
        responsabilidad: 'laboratorio',
        cobroPct: 100,
      }),
    )
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(created))
  })

  it('no ofrece repetir un trabajo que no se puede repetir', () => {
    renderWithProviders(<RemakeDialog case={caso({ status: 'nuevo' })} />)
    expect(screen.queryByRole('button', { name: 'Repetir' })).not.toBeInTheDocument()
  })
})
