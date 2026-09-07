import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderWithRouter } from '@/test/router'
import type { CaseDetail } from './api'
import { CaseHeader } from './case-header'

function baseCase(overrides: Partial<CaseDetail> = {}): CaseDetail {
  return {
    id: 'caso-1',
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

describe('CaseHeader', () => {
  it('admin en un trabajo "nuevo" ve el total y el enlace Editar', async () => {
    renderWithRouter(<CaseHeader case={baseCase()} missing={[]} role="admin" />)
    expect(await screen.findByText('$ 90.00')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Editar/ })).toBeInTheDocument()
  })

  it('el código del trabajo se renderiza como encabezado h1', async () => {
    renderWithRouter(<CaseHeader case={baseCase()} missing={[]} role="admin" />)
    expect(await screen.findByRole('heading', { level: 1, name: '26-00001' })).toBeInTheDocument()
  })

  it('técnico no ve el total ni el enlace Editar', async () => {
    renderWithRouter(<CaseHeader case={baseCase()} missing={[]} role="tecnico" />)
    await screen.findByText('26-00001')
    expect(screen.queryByText('$ 90.00')).not.toBeInTheDocument()
    expect(screen.queryByText('Total')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Editar/ })).not.toBeInTheDocument()
  })

  it('admin en un trabajo "terminado" no ve el enlace Editar', async () => {
    renderWithRouter(
      <CaseHeader case={baseCase({ status: 'terminado' })} missing={[]} role="admin" />,
    )
    await screen.findByText('26-00001')
    expect(screen.queryByRole('link', { name: /Editar/ })).not.toBeInTheDocument()
  })

  it('con datos faltantes muestra el aviso "Para aceptar falta: …"', async () => {
    renderWithRouter(
      <CaseHeader
        case={baseCase()}
        missing={['Fecha deseada', 'Prescripción (texto o documento)']}
        role="admin"
      />,
    )
    expect(
      await screen.findByText(
        'Para aceptar falta: Fecha deseada, Prescripción (texto o documento)',
      ),
    ).toBeInTheDocument()
  })
})
