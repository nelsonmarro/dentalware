import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderWithProviders } from '@/test/render'
import type { CaseDetail } from './api'
import { CaseDetailTab } from './case-detail-tab'

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
    shade: 'A2',
    shadeSystem: null,
    reference: null,
    checklist: { antagonista: true, mordida: false, color: true, fotos: false },
    observations: null,
    prescription: null,
    internalNotes: 'Nota interna confidencial',
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
    items: [
      {
        id: 'item-1',
        caseId: 'caso-1',
        productId: 'producto-1',
        description: null,
        quantity: 2,
        teeth: [11, 12],
        unitPrice: '50.00',
        discountPct: '10.00',
        lineTotal: '90.00',
        material: null,
        notes: null,
        sort: 0,
        product: { id: 'producto-1', code: 'ZR', name: 'Zirconio', pricingUnit: 'por_pieza' },
      },
    ],
    ...overrides,
  } as unknown as CaseDetail
}

describe('CaseDetailTab', () => {
  it('admin ve precio, descuento y total por línea, y las notas internas', () => {
    renderWithProviders(<CaseDetailTab case={baseCase()} hidePrices={false} role="admin" />)
    expect(screen.getByText('Precio')).toBeInTheDocument()
    expect(screen.getByText('$ 50.00')).toBeInTheDocument()
    expect(screen.getByText('Descuento')).toBeInTheDocument()
    expect(screen.getByText('10 %')).toBeInTheDocument()
    expect(screen.getByText('Total')).toBeInTheDocument()
    expect(screen.getByText('$ 90.00')).toBeInTheDocument()
    expect(screen.getByText('Notas internas')).toBeInTheDocument()
    expect(screen.getByText('Nota interna confidencial')).toBeInTheDocument()
  })

  it('técnico no ve precio, descuento, total ni notas internas, pero sí piezas y checklist', () => {
    renderWithProviders(<CaseDetailTab case={baseCase()} hidePrices role="tecnico" />)
    expect(screen.queryByText('Precio')).not.toBeInTheDocument()
    expect(screen.queryByText('$ 50.00')).not.toBeInTheDocument()
    expect(screen.queryByText('$ 90.00')).not.toBeInTheDocument()
    expect(screen.queryByText('Descuento')).not.toBeInTheDocument()
    expect(screen.queryByText('Total')).not.toBeInTheDocument()
    expect(screen.queryByText('Notas internas')).not.toBeInTheDocument()
    expect(screen.queryByText('Nota interna confidencial')).not.toBeInTheDocument()

    expect(screen.getByRole('button', { name: /11 ·/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /12 ·/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Antagonista')).toBeInTheDocument()
    expect(screen.getByText('Mordida')).toBeInTheDocument()
  })
})
