import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as ApiModule from './api'
import type { CaseDetail, CaseEvent } from './api'
import { CaseHistory, historyTabLabel } from './case-history'

const { fetchTechnicians } = vi.hoisted(() => ({ fetchTechnicians: vi.fn() }))
vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof ApiModule>()),
  fetchTechnicians,
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

function event(overrides: Partial<CaseEvent>): CaseEvent {
  return {
    id: 'e1',
    caseId: 'c1',
    type: 'created',
    fromValue: null,
    toValue: null,
    reason: null,
    relatedCaseId: null,
    actorId: 'u1',
    actor: { id: 'u1', name: 'Ana' },
    createdAt: new Date().toISOString(),
    ...overrides,
  } as CaseEvent
}

function caso(overrides: Partial<CaseDetail> = {}): CaseDetail {
  return {
    id: 'c1',
    code: '26-00001',
    technician: null,
    ...overrides,
  } as unknown as CaseDetail
}

const STAGES = [
  {
    id: 's1',
    name: 'Recepción',
    color: '#000',
    active: true,
    sort: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 's2',
    name: 'Modelo',
    color: '#000',
    active: true,
    sort: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
]

beforeEach(() => {
  fetchTechnicians.mockReset()
  // fetchTechnicians por defecto resuelve técnicos activos; los tests de rol técnico/
  // mensajero verifican que ni siquiera se llama (useTechnicians con `enabled: false`).
  fetchTechnicians.mockResolvedValue([{ id: 't1', name: 'Ana Técnica' }])
})

describe('CaseHistory', () => {
  it('muestra el trabajo creado y un comentario con su texto y autor, en orden ascendente', async () => {
    renderWithProviders(
      <CaseHistory
        case={caso()}
        stages={[]}
        role="admin"
        events={[
          event({ id: 'e1', type: 'created', toValue: 'AA-00001' }),
          event({
            id: 'e2',
            type: 'comment',
            toValue: 'Todo listo para retirar',
            actor: { id: 'u2', name: 'Beto' },
          }),
        ]}
      />,
    )
    const items = await screen.findAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('Trabajo creado')
    expect(items[1]).toHaveTextContent('Comentario')
    expect(items[1]).toHaveTextContent('Beto')
    expect(items[1]).toHaveTextContent('Todo listo para retirar')
  })

  it('sin eventos muestra un mensaje de "sin actividad"', async () => {
    renderWithProviders(<CaseHistory case={caso()} stages={[]} role="admin" events={[]} />)
    expect(await screen.findByText('Sin actividad todavía.')).toBeInTheDocument()
  })

  // I-1 (ola de fixes del PR 1, lote B): aceptar y finalizar escriben ambos `status_changed`;
  // sin el destino en el historial se ven como dos «Estado cambiado» indistinguibles.
  it('distingue aceptar de finalizar con el rótulo humano del estado destino', async () => {
    renderWithProviders(
      <CaseHistory
        case={caso()}
        stages={[]}
        role="admin"
        events={[
          event({ id: 'e1', type: 'status_changed', fromValue: 'nuevo', toValue: 'en_proceso' }),
          event({
            id: 'e2',
            type: 'status_changed',
            fromValue: 'en_proceso',
            toValue: 'terminado',
          }),
        ]}
      />,
    )
    const items = await screen.findAllByRole('listitem')
    expect(items[0]).toHaveTextContent('Nuevo estado: En proceso')
    expect(items[1]).toHaveTextContent('Nuevo estado: Terminado')
    // nunca la clave cruda
    expect(screen.queryByText(/en_proceso/)).not.toBeInTheDocument()
  })

  it('una pausa muestra su motivo', async () => {
    renderWithProviders(
      <CaseHistory
        case={caso()}
        stages={[]}
        role="admin"
        events={[
          event({
            type: 'hold',
            fromValue: 'en_proceso',
            toValue: 'en_espera',
            reason: 'Falta antagonista',
          }),
        ]}
      />,
    )
    expect(await screen.findByText('Motivo: Falta antagonista')).toBeInTheDocument()
  })

  it('una cancelación muestra su motivo cuando existe', async () => {
    renderWithProviders(
      <CaseHistory
        case={caso()}
        stages={[]}
        role="admin"
        events={[
          event({
            type: 'cancelled',
            fromValue: 'nuevo',
            toValue: 'cancelado',
            reason: 'El paciente cambió de clínica',
          }),
        ]}
      />,
    )
    expect(await screen.findByText('Motivo: El paciente cambió de clínica')).toBeInTheDocument()
  })

  it('un cambio de fase muestra la fase anterior y la nueva por nombre, y el motivo si retrocede', async () => {
    renderWithProviders(
      <CaseHistory
        case={caso()}
        stages={STAGES}
        role="admin"
        events={[
          event({
            type: 'stage_changed',
            fromValue: 's2',
            toValue: 's1',
            reason: 'Ajuste de oclusión',
          }),
        ]}
      />,
    )
    expect(await screen.findByText('Modelo → Recepción')).toBeInTheDocument()
    expect(screen.getByText('Motivo: Ajuste de oclusión')).toBeInTheDocument()
  })

  it('una asignación de técnico resuelve nombres para quien puede consultar técnicos', async () => {
    renderWithProviders(
      <CaseHistory
        case={caso({ technician: { id: 't1', name: 'Ana Técnica' } })}
        stages={[]}
        role="recepcion"
        events={[event({ type: 'assigned', fromValue: null, toValue: 't1' })]}
      />,
    )
    expect(await screen.findByText('Sin asignar → Ana Técnica')).toBeInTheDocument()
  })

  it('un técnico no dispara la consulta de técnicos y sigue viendo el nombre actual', async () => {
    renderWithProviders(
      <CaseHistory
        case={caso({ technician: { id: 't1', name: 'Ana Técnica' } })}
        stages={[]}
        role="tecnico"
        events={[event({ type: 'assigned', fromValue: null, toValue: 't1' })]}
      />,
    )
    expect(await screen.findByText('Sin asignar → Ana Técnica')).toBeInTheDocument()
    expect(fetchTechnicians).not.toHaveBeenCalled()
  })

  // I-2 (ola de fixes del PR 1, lote B): en la ficha del padre, `remake_created` enlaza al
  // hijo por el id que ya resuelve la API (`relatedCaseId`, a6bf622).
  it('en la ficha del padre, la repetición enlaza al hijo por su código', async () => {
    renderWithProviders(
      <CaseHistory
        case={caso({ id: 'padre-1' })}
        stages={[]}
        role="admin"
        events={[
          event({
            type: 'remake_created',
            fromValue: '26-00001',
            toValue: '26-00002',
            reason: 'Fractura en cerámica',
            relatedCaseId: 'hijo-1',
          }),
        ]}
      />,
    )
    const link = await screen.findByRole('link', { name: /Ver repetición 26-00002/ })
    expect(link).toHaveAttribute('href', '/trabajos/hijo-1')
    expect(screen.getByText('Motivo: Fractura en cerámica')).toBeInTheDocument()
  })

  it('en la ficha del propio hijo, el evento de repetición no se enlaza a sí mismo', async () => {
    renderWithProviders(
      <CaseHistory
        case={caso({ id: 'hijo-1' })}
        stages={[]}
        role="admin"
        events={[
          event({
            type: 'remake_created',
            fromValue: '26-00001',
            toValue: '26-00002',
            relatedCaseId: 'hijo-1',
          }),
        ]}
      />,
    )
    await screen.findByText('Repetición creada')
    expect(screen.queryByRole('link', { name: /Ver repetición/ })).not.toBeInTheDocument()
  })
})

describe('historyTabLabel', () => {
  it('sin eventos devuelve "Historial" sin número', () => {
    expect(historyTabLabel(0)).toBe('Historial')
  })

  it('con eventos (incluidos los comentarios) devuelve "Historial (N)" con el total combinado', () => {
    // 2 eventos automáticos + 1 comentario ya vienen combinados desde `/eventos`.
    expect(historyTabLabel(3)).toBe('Historial (3)')
  })
})
