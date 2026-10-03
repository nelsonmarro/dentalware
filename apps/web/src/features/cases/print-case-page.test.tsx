import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { LabSettings } from '@/features/config/api'
import type * as ConfigApiModule from '@/features/config/api'
import type { CaseDetail } from './api'
import type * as ApiModule from './api'
import { PrintCasePage } from './print-case-page'

// I-3: la ruta de impresión computa `hidePrices` a partir del rol de sesión — mismo criterio
// que `hidesPrices` de shared, pero era la quinta copia a mano sin test propio. Este test lo
// cubre directamente sobre `PrintCasePage` (la pieza con la lógica; el archivo de ruta solo lee
// `Route.useParams()`/`useRouteContext()` y la reenvía, ver `docs/architecture.md` §3.3).
const { fetchCase } = vi.hoisted(() => ({ fetchCase: vi.fn() }))
vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof ApiModule>()),
  fetchCase,
}))

const { fetchLabSettings } = vi.hoisted(() => ({ fetchLabSettings: vi.fn() }))
vi.mock('@/features/config/api', async (importOriginal) => ({
  ...(await importOriginal<typeof ConfigApiModule>()),
  fetchLabSettings,
}))

function renderWithProviders(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const router = createRouter({
    routeTree: createRootRoute({
      component: () => <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
    }),
    history: createMemoryHistory(),
  })
  return render(<RouterProvider router={router} />)
}

function stubCaseAndSettings(priority: 'normal' | 'urgente' = 'normal') {
  fetchCase.mockResolvedValue({
    case: {
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
      priority,
      receivedAt: '2026-01-01',
      dueDate: '2026-01-10',
      promisedDate: '2026-01-12',
      finishedAt: null,
      shippedAt: null,
      deliveredAt: null,
      paidAt: null,
      shade: 'A2',
      shadeSystem: 'vita_classical',
      reference: null,
      checklist: { antagonista: false, mordida: false, color: false, fotos: false },
      observations: null,
      prescription: null,
      internalNotes: null,
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
      technician: null,
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
          product: { id: 'producto-1', code: 'ZR', name: 'Corona de zirconio' },
        },
      ],
    },
    missing: [],
  } as unknown as { case: CaseDetail; missing: string[] })
  fetchLabSettings.mockResolvedValue({
    id: 'lab-1',
    name: 'Arte Dental',
    ruc: null,
    address: null,
    phone: null,
    logoUrl: null,
    codePrefix: null,
    ivaPct: 15,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  } as unknown as LabSettings)
}

function rotulos() {
  return screen.getAllByTestId('rotulo-copia').map((el) => el.textContent)
}

describe('PrintCasePage', () => {
  // UX3-21: el técnico (y el mensajero) solo imprime la copia laboratorio, sin precios; ni
  // siquiera ve la opción de una copia clínica.
  it.each(['tecnico', 'mensajero'] as const)(
    '%s solo ve la copia laboratorio, sin precios ni total (I-3, UX3-21)',
    async (role) => {
      stubCaseAndSettings()
      renderWithProviders(<PrintCasePage caseId="caso-1" role={role} />)

      await screen.findByRole('heading', { name: /Orden de trabajo 26-00123/ })
      expect(rotulos()).toEqual(['Copia laboratorio'])
      expect(screen.queryByText(/Copia clínica/)).not.toBeInTheDocument()
      expect(screen.queryByRole('tab')).not.toBeInTheDocument()
      expect(screen.queryByText(/\$/)).not.toBeInTheDocument()
      expect(screen.queryByText(/Total/)).not.toBeInTheDocument()
    },
  )

  it('recepción imprime por omisión las dos copias, y solo la clínica lleva precios (UX3-21)', async () => {
    stubCaseAndSettings()
    renderWithProviders(<PrintCasePage caseId="caso-1" role="recepcion" />)

    expect(await screen.findByRole('tab', { name: 'Ambas', selected: true })).toBeInTheDocument()
    expect(rotulos()).toEqual(['Copia laboratorio', 'Copia clínica'])
    // Un solo `h1` en la página aunque haya dos hojas (convenciones §5, accesibilidad).
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    // Un solo total: el de la copia clínica.
    expect(screen.getAllByText('$ 147.00')).toHaveLength(1)
    const [laboratorio, clinica] = screen.getAllByRole('article')
    expect(within(laboratorio!).queryByText(/\$/)).not.toBeInTheDocument()
    expect(within(clinica!).getByText('$ 147.00')).toBeInTheDocument()
  })

  it('recepción puede imprimir solo la copia laboratorio, sin precios (UX3-21)', async () => {
    stubCaseAndSettings()
    const user = userEvent.setup()
    renderWithProviders(<PrintCasePage caseId="caso-1" role="recepcion" />)

    await user.click(await screen.findByRole('tab', { name: 'Laboratorio' }))
    expect(rotulos()).toEqual(['Copia laboratorio'])
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument()
  })

  it('admin puede imprimir solo la copia clínica, con precios (UX3-21)', async () => {
    stubCaseAndSettings()
    const user = userEvent.setup()
    renderWithProviders(<PrintCasePage caseId="caso-1" role="admin" />)

    await user.click(await screen.findByRole('tab', { name: 'Clínica' }))
    expect(rotulos()).toEqual(['Copia clínica'])
    expect(screen.getByText('$ 147.00')).toBeInTheDocument()
  })

  it('un trabajo urgente lleva «URGENTE» en cada copia (UX3-07)', async () => {
    stubCaseAndSettings('urgente')
    renderWithProviders(<PrintCasePage caseId="caso-1" role="recepcion" />)

    await screen.findByRole('tab', { name: 'Ambas', selected: true })
    const [laboratorio, clinica] = screen.getAllByRole('article')
    expect(within(laboratorio!).getByText('URGENTE')).toBeInTheDocument()
    expect(within(clinica!).getByText('URGENTE')).toBeInTheDocument()
  })
})
