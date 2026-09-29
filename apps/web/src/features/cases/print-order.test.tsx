import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderWithProviders } from '@/test/render'
import type { LabSettings } from '@/features/config/api'
import type { CaseDetail } from './api'
import { PrintOrder } from './print-order'

function settings(overrides: Partial<LabSettings> = {}): LabSettings {
  return {
    id: 'lab-1',
    name: 'Arte Dental',
    ruc: '1791234567001',
    address: 'Puerto Rico N27-33 y La Isla',
    phone: '0961440991 / 0996081498',
    logoUrl: null,
    codePrefix: null,
    ivaPct: 15,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as unknown as LabSettings
}

function casoCompleto(overrides: Partial<CaseDetail> = {}): CaseDetail {
  return {
    id: 'caso-1',
    code: '26-00123',
    boxNumber: null,
    clinicId: 'clinica-1',
    doctorId: 'doctor-1',
    patientRef: 'JP-14',
    patientAge: 42,
    patientSex: 'M',
    status: 'nuevo',
    currentStageId: null,
    assignedTechnicianId: null,
    priority: 'normal',
    receivedAt: '2026-01-01',
    dueDate: '2026-01-10',
    promisedDate: '2026-01-12',
    finishedAt: null,
    shippedAt: null,
    deliveredAt: null,
    paidAt: null,
    shade: 'A2',
    shadeSystem: 'vita_classical',
    reference: 'Guía adjunta',
    checklist: { antagonista: true, mordida: false, color: true, fotos: false },
    observations: 'Ajustar oclusión',
    prescription: null,
    internalNotes: 'Nota interna confidencial: no imprimir',
    holdReason: null,
    parentCaseId: null,
    parentCase: null,
    remakeReason: null,
    remakeResponsibility: null,
    remakeChargePct: null,
    total: '147.00',
    createdBy: 'user-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    clinic: { id: 'clinica-1', name: 'Clínica Uno' },
    doctor: { id: 'doctor-1', name: 'Dr. Gómez' },
    technician: { id: 'tec-1', name: 'Carlos Pilco' },
    stage: null,
    items: [
      {
        id: 'item-1',
        caseId: 'caso-1',
        productId: 'producto-1',
        description: null,
        quantity: 1,
        teeth: [11],
        unitPrice: '100.00',
        discountPct: '0.00',
        lineTotal: '100.00',
        material: null,
        notes: null,
        sort: 0,
        product: {
          id: 'producto-1',
          code: 'ZR',
          name: 'Corona de zirconio',
          pricingUnit: 'por_pieza',
        },
      },
      {
        id: 'item-2',
        caseId: 'caso-1',
        productId: 'producto-2',
        description: null,
        quantity: 1,
        teeth: [],
        unitPrice: '47.00',
        discountPct: '0.00',
        lineTotal: '47.00',
        material: null,
        notes: null,
        sort: 1,
        product: { id: 'producto-2', code: 'AC', name: 'Placa acrílica', pricingUnit: 'unidad' },
      },
    ],
    ...overrides,
  } as unknown as CaseDetail
}

describe('PrintOrder', () => {
  it('reproduce los bloques de la orden en papel y en su orden', async () => {
    renderWithProviders(
      <PrintOrder case={casoCompleto()} settings={settings()} hidePrices={false} />,
    )
    const titulos = (await screen.findAllByRole('heading')).map((h) => h.textContent)
    expect(titulos).toEqual([
      'Arte Dental',
      'Trabajo 26-00123',
      'Paciente',
      'Color y sistema',
      'Odontograma',
      'Líneas',
      'Observaciones',
      'Lista de verificación',
      'Firmas',
    ])
  })

  it('no muestra precios ni el total cuando la imprime un técnico', async () => {
    renderWithProviders(<PrintOrder case={casoCompleto()} settings={settings()} hidePrices />)
    await screen.findByText('26-00123', { exact: false })
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Total/)).not.toBeInTheDocument()
  })

  it('muestra los precios y el total para recepción', async () => {
    renderWithProviders(
      <PrintOrder case={casoCompleto()} settings={settings()} hidePrices={false} />,
    )
    expect(await screen.findByText('$ 147.00')).toBeInTheDocument()
  })

  it('marca en el odontograma solo las piezas del trabajo', async () => {
    renderWithProviders(
      <PrintOrder case={casoCompleto()} settings={settings()} hidePrices={false} />,
    )
    expect(await screen.findByTestId('pieza-11')).toHaveAttribute('data-marcada', 'true')
    expect(screen.getByTestId('pieza-21')).toHaveAttribute('data-marcada', 'false')
  })

  it('nunca imprime las notas internas, ni para admin', async () => {
    renderWithProviders(
      <PrintOrder case={casoCompleto()} settings={settings()} hidePrices={false} />,
    )
    await screen.findByText('26-00123', { exact: false })
    expect(screen.queryByText(/Nota interna confidencial/)).not.toBeInTheDocument()
  })

  it('el QR codifica la ficha corta del trabajo', async () => {
    renderWithProviders(
      <PrintOrder case={casoCompleto()} settings={settings()} hidePrices={false} />,
    )
    expect(
      await screen.findByRole('img', { name: /Código QR del trabajo 26-00123/ }),
    ).toBeInTheDocument()
  })
})
