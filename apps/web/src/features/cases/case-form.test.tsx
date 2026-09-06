import { toothLabel } from '@dentalware/shared'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { CaseDetail } from './api'
import { CaseForm } from './case-form'

const { CLINIC, DOCTOR, PRODUCT_ZR, PRODUCT_AC, CLINIC_PRICES } = vi.hoisted(() => {
  const now = '2026-01-01T00:00:00.000Z'
  const CLINIC = {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Clínica Uno',
    ruc: null,
    address: null,
    city: null,
    phone: null,
    whatsapp: null,
    email: null,
    paymentTermsDays: 0,
    notes: null,
    active: true,
    createdAt: now,
    updatedAt: now,
  }
  const DOCTOR = {
    id: '22222222-2222-4222-8222-222222222222',
    clinicId: '11111111-1111-4111-8111-111111111111',
    name: 'Dr. Pérez',
    phone: null,
    email: null,
    notes: null,
    active: true,
    createdAt: now,
    updatedAt: now,
  }
  const CATEGORY = { id: '55555555-5555-4555-8555-555555555555', name: 'Coronas' }
  const PRODUCT_ZR = {
    id: '33333333-3333-4333-8333-333333333333',
    code: 'ZR',
    name: 'Corona de zirconio',
    categoryId: CATEGORY.id,
    category: CATEGORY,
    pricingUnit: 'por_pieza' as const,
    basePrice: '45.00',
    turnaroundDays: 5,
    requiresTryIn: false,
    active: true,
    createdAt: now,
    updatedAt: now,
  }
  const PRODUCT_AC = {
    id: '44444444-4444-4444-8444-444444444444',
    code: 'AC',
    name: 'Acrílico removible',
    categoryId: CATEGORY.id,
    category: CATEGORY,
    pricingUnit: 'por_arcada' as const,
    basePrice: '80.00',
    turnaroundDays: 7,
    requiresTryIn: false,
    active: true,
    createdAt: now,
    updatedAt: now,
  }
  const CLINIC_PRICES = [{ productId: PRODUCT_ZR.id, price: '40.00' }]
  return { CLINIC, DOCTOR, PRODUCT_ZR, PRODUCT_AC, CLINIC_PRICES }
})

vi.mock('@/features/cases/api')
vi.mock('@/features/clinics/api', () => ({
  fetchClinics: vi.fn().mockResolvedValue([CLINIC]),
}))
vi.mock('@/features/doctors/api', () => ({
  fetchDoctors: vi.fn().mockResolvedValue([DOCTOR]),
}))
vi.mock('@/features/products/api', () => ({
  fetchProducts: vi.fn().mockResolvedValue([PRODUCT_ZR, PRODUCT_AC]),
  fetchClinicPrices: vi.fn().mockResolvedValue(CLINIC_PRICES),
}))

function renderForm(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const router = createRouter({
    routeTree: createRootRoute({
      component: () => <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
    }),
    history: createMemoryHistory(),
  })
  return { user: userEvent.setup(), client, ...render(<RouterProvider router={router} />) }
}

// TanStack Router resuelve el primer match de forma asíncrona (un tick de microtarea)
// aunque la ruta raíz no tenga `loader`; por eso la primera consulta de cada prueba usa
// `findByRole` (espera) y el resto puede usar `getByRole` con seguridad.
async function pickOption(
  user: ReturnType<typeof userEvent.setup>,
  comboName: string,
  optionName: RegExp | string,
) {
  await user.click(await screen.findByRole('combobox', { name: comboName }))
  await user.click(await screen.findByRole('option', { name: optionName }))
}

async function fillMinimalCase(user: ReturnType<typeof userEvent.setup>) {
  await pickOption(user, 'Clínica', 'Clínica Uno')
  await pickOption(user, 'Doctor', 'Dr. Pérez')
  await user.type(screen.getByRole('textbox', { name: 'Referencia del paciente' }), 'Juan Pérez')
  await user.click(screen.getByRole('button', { name: 'Agregar línea' }))
  await pickOption(user, 'Producto', /ZR/)
}

describe('CaseForm', () => {
  it('enviar vacío muestra los errores obligatorios y no llama a onSubmit', async () => {
    const onSubmit = vi.fn()
    const { user } = renderForm(<CaseForm role="admin" pending={false} onSubmit={onSubmit} />)

    await user.click(await screen.findByRole('button', { name: 'Guardar' }))

    expect(await screen.findByText('La referencia del paciente es obligatoria')).toBeInTheDocument()
    expect(screen.getByText('Agrega al menos una línea de trabajo')).toBeInTheDocument()
    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('elegir clínica habilita el doctor; el producto con precio especial rellena el precio y el total', async () => {
    const { user } = renderForm(<CaseForm role="admin" pending={false} onSubmit={vi.fn()} />)

    expect(await screen.findByRole('combobox', { name: 'Doctor' })).toBeDisabled()

    await pickOption(user, 'Clínica', 'Clínica Uno')
    expect(screen.getByRole('combobox', { name: 'Doctor' })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: 'Agregar línea' }))
    await pickOption(user, 'Producto', /ZR/)

    const row = screen.getByTestId('case-item-row')
    expect(await within(row).findByRole('spinbutton', { name: 'Precio unitario' })).toHaveValue(40)
    expect(within(row).getByText('$ 40.00')).toBeInTheDocument()

    const quantity = within(row).getByRole('spinbutton', { name: 'Cantidad' })
    await user.clear(quantity)
    await user.type(quantity, '2')
    expect(within(row).getByText('$ 80.00')).toBeInTheDocument()
  })

  it('el panel "Para aceptar falta" lista "Fecha deseada" hasta que se completa', async () => {
    const { user } = renderForm(<CaseForm role="admin" pending={false} onSubmit={vi.fn()} />)

    await fillMinimalCase(user)
    const panel = screen.getByTestId('missing-panel')
    expect(within(panel).getByText('Fecha deseada')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Fecha deseada'), { target: { value: '2026-12-01' } })

    await waitFor(() => expect(within(panel).queryByText('Fecha deseada')).not.toBeInTheDocument())
  })

  it('con role "tecnico" no se renderiza el precio unitario', async () => {
    const { user } = renderForm(<CaseForm role="tecnico" pending={false} onSubmit={vi.fn()} />)

    await user.click(await screen.findByRole('button', { name: 'Agregar línea' }))

    expect(screen.queryByRole('spinbutton', { name: 'Precio unitario' })).not.toBeInTheDocument()
    expect(screen.getByRole('spinbutton', { name: 'Cantidad' })).toBeInTheDocument()
  })

  it('"Guardar y nuevo" llama a onSubmit(input, true) con las piezas elegidas en el diálogo', async () => {
    const onSubmit = vi.fn()
    const { user } = renderForm(<CaseForm role="admin" pending={false} onSubmit={onSubmit} />)

    await fillMinimalCase(user)
    fireEvent.change(screen.getByLabelText('Fecha deseada'), { target: { value: '2026-12-01' } })

    await user.click(screen.getByRole('button', { name: 'Piezas (0)' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: toothLabel(11) }))
    await user.click(within(dialog).getByRole('button', { name: toothLabel(12) }))
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }))

    expect(await screen.findByRole('button', { name: 'Piezas (2)' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Guardar y nuevo' }))

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        items: expect.arrayContaining([expect.objectContaining({ teeth: [11, 12] })]),
      }),
      true,
    )
  })

  it('al editar conserva el precio guardado hasta que se cambia de clínica', async () => {
    const now = '2026-01-01T00:00:00.000Z'
    const initial = {
      id: 'caso-1',
      code: '26-00001',
      boxNumber: null,
      clinicId: CLINIC.id,
      doctorId: DOCTOR.id,
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
      prescription: 'Prescripción en papel',
      internalNotes: null,
      holdReason: null,
      parentCaseId: null,
      remakeReason: null,
      remakeResponsibility: null,
      remakeChargePct: null,
      total: '55.00',
      createdBy: 'user-1',
      createdAt: now,
      updatedAt: now,
      clinic: { id: CLINIC.id, name: CLINIC.name },
      doctor: { id: DOCTOR.id, name: DOCTOR.name },
      technician: null,
      stage: null,
      items: [
        {
          id: 'item-1',
          caseId: 'caso-1',
          productId: PRODUCT_ZR.id,
          description: null,
          quantity: 1,
          teeth: [11],
          // Precio distinto del que resultaría de recalcular (precio especial 40.00):
          // simula que alguien lo ajustó a mano en un momento anterior.
          unitPrice: '55.00',
          discountPct: '0.00',
          lineTotal: '55.00',
          material: null,
          notes: null,
          sort: 0,
          product: {
            id: PRODUCT_ZR.id,
            code: PRODUCT_ZR.code,
            name: PRODUCT_ZR.name,
            pricingUnit: PRODUCT_ZR.pricingUnit,
          },
        },
      ],
    } as unknown as CaseDetail

    renderForm(<CaseForm role="admin" pending={false} initial={initial} onSubmit={vi.fn()} />)

    const row = await screen.findByTestId('case-item-row')
    expect(within(row).getByRole('spinbutton', { name: 'Precio unitario' })).toHaveValue(55)
    // No debe haber botón "Guardar y nuevo" al editar.
    expect(screen.queryByRole('button', { name: 'Guardar y nuevo' })).not.toBeInTheDocument()
  })
})
