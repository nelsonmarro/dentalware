import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen, within } from '@testing-library/react'
import type { ReactElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as ApiModule from './api'
import type { CaseDetail, CaseEvent } from './api'
import { CaseHistory, EVENT_LABEL, historyTabLabel } from './case-history'

// UX3-13: el historial no consulta la lista de técnicos (los nombres vienen con el evento);
// si volviera a hacerlo, este mock lo delata en el test de abajo.
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
    fromName: null,
    toName: null,
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
})

describe('CaseHistory', () => {
  // UX3-26: en un trabajo largo lo último que pasó quedaba al fondo; la API entrega los
  // eventos de más antiguo a más reciente y el historial los pinta al revés.
  it('muestra el trabajo creado y un comentario con su texto y autor, lo más reciente primero', async () => {
    renderWithProviders(
      <CaseHistory
        case={caso()}
        stages={[]}
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
    expect(items[0]).toHaveTextContent('Comentario')
    expect(items[0]).toHaveTextContent('Beto')
    expect(items[0]).toHaveTextContent('Todo listo para retirar')
    expect(items[1]).toHaveTextContent('Trabajo creado')
  })

  it('sin eventos muestra un mensaje de "sin actividad"', async () => {
    renderWithProviders(<CaseHistory case={caso()} stages={[]} events={[]} />)
    expect(await screen.findByText('Sin actividad todavía.')).toBeInTheDocument()
  })

  // I-1 (ola de fixes del PR 1, lote B): aceptar y finalizar escriben ambos `status_changed`;
  // sin el destino en el historial se ven como dos «Estado cambiado» indistinguibles.
  it('distingue aceptar de finalizar con el rótulo humano del estado destino', async () => {
    renderWithProviders(
      <CaseHistory
        case={caso()}
        stages={[]}
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
    // Lo más reciente primero (UX3-26): finalizar, luego aceptar.
    expect(items[0]).toHaveTextContent('Nuevo estado: Terminado')
    expect(items[1]).toHaveTextContent('Nuevo estado: En proceso')
    // nunca la clave cruda
    expect(screen.queryByText(/en_proceso/)).not.toBeInTheDocument()
  })

  // Revisión de la Tarea 4: `shipped`/`delivered` guardan fecha y constancia en `toValue`, no un
  // estado; el historial los dice con palabras y nunca enseña la fecha cruda ni el id.
  it.each([
    [
      'pickup_scheduled',
      { toValue: '2026-10-05', reason: 'Mario Mensajero' },
      'Recogida programada',
      'Con Mario Mensajero para el 05/10/2026',
    ],
    // #118: `picked_up` es «el mensajero recogió en la clínica», con su nombre en `reason`.
    ['picked_up', { reason: 'Mario Mensajero' }, 'Recogido', 'Por Mario Mensajero'],
    // Los `picked_up` viejos (los escribía «Recibido», sin nombre): «Recogido» a secas.
    ['picked_up', { fromValue: 'por_recoger', toValue: 'nuevo' }, 'Recogido', null],
    // #118: «Recibido» (`recibir`) escribe su propio evento `received`.
    [
      'received',
      { fromValue: 'por_recoger', toValue: 'nuevo' },
      'Recibido en el laboratorio',
      null,
    ],
    [
      'shipped',
      { fromValue: 'terminado', toValue: '2026-10-05', reason: 'Mario Mensajero' },
      'Enviado',
      'Con Mario Mensajero para el 05/10/2026',
    ],
    [
      'delivered',
      { fromValue: 'enviado', toValue: '9b2f7c1e-0000-4000-8000-000000000001' },
      'Entregado',
      'Con foto de constancia',
    ],
    [
      'delivery_failed',
      { fromValue: 'recogida', toValue: '2026-10-06', reason: 'Clínica cerrada' },
      'Recogida fallida',
      'Motivo: Clínica cerrada — nueva fecha 06/10/2026',
    ],
    [
      'delivery_failed',
      { fromValue: 'entrega', toValue: '2026-10-06', reason: 'Clínica cerrada' },
      'Entrega fallida',
      'Motivo: Clínica cerrada — nueva fecha 06/10/2026',
    ],
    // Los eventos anteriores a UX4-16 no guardan el tipo: siguen con el texto genérico.
    [
      'delivery_failed',
      { toValue: '2026-10-06', reason: 'Clínica cerrada' },
      'Entrega o recogida fallida',
      'Motivo: Clínica cerrada — nueva fecha 06/10/2026',
    ],
  ] as const)(
    'el evento %s se lee con palabras, no con su valor crudo',
    async (type, campos, rotulo, detalle) => {
      renderWithProviders(
        <CaseHistory case={caso()} stages={[]} events={[event({ type, ...campos })]} />,
      )
      const item = await screen.findByRole('listitem')
      expect(within(item).getByText(rotulo)).toBeInTheDocument()
      if (detalle) expect(within(item).getByText(detalle)).toBeInTheDocument()
      else expect(item).not.toHaveTextContent(/Por |Con |Motivo/)
      expect(item).not.toHaveTextContent('2026-10-0')
      expect(item).not.toHaveTextContent('9b2f7c1e')
      expect(item).not.toHaveTextContent('Nuevo estado')
    },
  )

  // M-4 de la revisión final del PR 1 de la Iteración 5: admin y recepción ven el monto y el
  // motivo de los eventos de cobro, con palabras y el monto con formato.
  it.each([
    [
      'payment_applied',
      { toValue: '50.00', reason: 'Transferencia · TRX-1' },
      'Pago aplicado',
      '$ 50.00 · Transferencia · TRX-1',
    ],
    [
      'payment_voided',
      { toValue: '50.00', reason: 'Pago duplicado' },
      'Pago anulado',
      'Se devolvieron $ 50.00 · Motivo: Pago duplicado',
    ],
    [
      'adjustment_added',
      { toValue: '-10.00', reason: 'Acuerdo de precio' },
      'Ajuste registrado',
      'Descuento de $ 10.00 · Motivo: Acuerdo de precio',
    ],
    [
      'adjustment_added',
      { toValue: '5.50', reason: 'Envío urgente' },
      'Ajuste registrado',
      'Recargo de $ 5.50 · Motivo: Envío urgente',
    ],
  ] as const)('el evento %s dice su monto y su motivo', async (type, campos, rotulo, detalle) => {
    renderWithProviders(
      <CaseHistory case={caso()} stages={[]} events={[event({ type, ...campos })]} />,
    )
    const item = await screen.findByRole('listitem')
    expect(within(item).getByText(rotulo)).toBeInTheDocument()
    expect(item).toHaveTextContent(detalle)
  })

  // Técnico y mensajero reciben estos eventos enmascarados (`maskPriceEvents`: `fromValue`,
  // `toValue` y `reason` en null): se ve qué pasó, nunca un monto ni un hueco roto.
  it.each(['payment_applied', 'payment_voided', 'adjustment_added'] as const)(
    'el evento %s enmascarado se lee sin monto ni motivo',
    async (type) => {
      renderWithProviders(
        <CaseHistory
          case={caso()}
          stages={[]}
          events={[event({ type, fromValue: null, toValue: null, reason: null })]}
        />,
      )
      const item = await screen.findByRole('listitem')
      expect(item).toHaveTextContent(EVENT_LABEL[type])
      expect(item).not.toHaveTextContent(/\$|Motivo|null|undefined|NaN/)
    },
  )

  // UX4-16: el evento con constancia enlaza la foto, que se abre aparte.
  it('un evento delivered con constancia enlaza «Ver constancia» a la imagen', async () => {
    renderWithProviders(
      <CaseHistory
        case={caso()}
        stages={[]}
        events={[
          event({
            type: 'delivered',
            fromValue: 'enviado',
            toValue: '9b2f7c1e-0000-4000-8000-000000000001',
          }),
        ]}
      />,
    )
    const link = await screen.findByRole('link', { name: 'Ver constancia' })
    expect(link).toHaveAttribute('href', '/api/adjuntos/9b2f7c1e-0000-4000-8000-000000000001')
    expect(link).toHaveAttribute('target', '_blank')
  })

  // Revisión final del PR 1 de la Iteración 4 (M-1): un `delivered` de la Iteración 3 guarda el
  // estado (`entregado`) en `toValue` y no tiene foto; no puede decir que la tiene.
  it('un evento delivered anterior a la Iteración 4 (sin constancia) no dice que tiene foto', async () => {
    renderWithProviders(
      <CaseHistory
        case={caso()}
        stages={[]}
        events={[event({ type: 'delivered', fromValue: 'enviado', toValue: 'entregado' })]}
      />,
    )
    const item = await screen.findByRole('listitem')
    expect(within(item).getByText('Entregado')).toBeInTheDocument()
    expect(item).not.toHaveTextContent('Con foto de constancia')
    expect(within(item).queryByRole('link')).not.toBeInTheDocument()
  })

  // Iteración 5 (cuentas y cobro): el cobro escribe tres eventos nuevos y lleva el trabajo a
  // `cobrado` con un `status_changed`; todos se nombran en español, nunca con la clave.
  it('nombra en español los eventos del cobro y el paso a cobrado', async () => {
    renderWithProviders(
      <CaseHistory
        case={caso()}
        stages={[]}
        events={[
          event({ id: 'e1', type: 'payment_applied', toValue: '40.00' }),
          event({ id: 'e2', type: 'status_changed', fromValue: 'entregado', toValue: 'cobrado' }),
          event({ id: 'e3', type: 'payment_voided', toValue: '40.00', reason: 'Duplicado' }),
          event({ id: 'e4', type: 'adjustment_added', toValue: '-5.00', reason: 'Descuento' }),
        ]}
      />,
    )
    const items = await screen.findAllByRole('listitem')
    expect(items[0]).toHaveTextContent('Ajuste registrado')
    expect(items[1]).toHaveTextContent('Pago anulado')
    expect(items[2]).toHaveTextContent('Nuevo estado: Cobrado')
    expect(items[3]).toHaveTextContent('Pago aplicado')
  })

  it('una pausa muestra su motivo', async () => {
    renderWithProviders(
      <CaseHistory
        case={caso()}
        stages={[]}
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

  it('sin nombre en el evento, la asignación cae al técnico actual de la ficha', async () => {
    renderWithProviders(
      <CaseHistory
        case={caso({ technician: { id: 't1', name: 'Ana Técnica' } })}
        stages={[]}
        events={[event({ type: 'assigned', fromValue: null, toValue: 't1' })]}
      />,
    )
    expect(await screen.findByText('Sin asignar → Ana Técnica')).toBeInTheDocument()
  })

  it('no consulta la lista de técnicos: el nombre del técnico actual sale de la ficha', async () => {
    renderWithProviders(
      <CaseHistory
        case={caso({ technician: { id: 't1', name: 'Ana Técnica' } })}
        stages={[]}
        events={[event({ type: 'assigned', fromValue: null, toValue: 't1' })]}
      />,
    )
    expect(await screen.findByText('Sin asignar → Ana Técnica')).toBeInTheDocument()
    expect(fetchTechnicians).not.toHaveBeenCalled()
  })

  // UX3-13: el técnico leía «Técnico UX It3 → Técnico» para uno anterior que seguía activo;
  // los nombres llegan con el evento (`fromName`/`toName` de `/eventos`).
  it('un técnico ve por nombre a un técnico anterior en una reasignación', async () => {
    renderWithProviders(
      <CaseHistory
        case={caso({ technician: { id: 't1', name: 'Ana Técnica' } })}
        stages={[]}
        events={[
          event({
            type: 'assigned',
            fromValue: 't0',
            toValue: 't1',
            fromName: 'Beto Técnico',
            toName: 'Ana Técnica',
          }),
        ]}
      />,
    )
    expect(await screen.findByText('Beto Técnico → Ana Técnica')).toBeInTheDocument()
  })

  // I-2 (ola de fixes del PR 1, lote B): en la ficha del padre, `remake_created` enlaza al
  // hijo por el id que ya resuelve la API (`relatedCaseId`, a6bf622).
  it('en la ficha del padre, la repetición enlaza al hijo por su código', async () => {
    renderWithProviders(
      <CaseHistory
        case={caso({ id: 'padre-1' })}
        stages={[]}
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
