import { DELIVERY_NOT_PENDING_MESSAGE } from '@dentalware/shared'
import { describe, expect, it } from 'vitest'
import { DeliveryForbiddenError, DeliveryInputError, DeliveryNotPendingError } from './errors.ts'
import {
  fakeCaseEventLog,
  fakeCouriersQuery,
  fakeDeliveriesRepo,
  fakeDeliveriesUnitOfWork,
  type DeliveryCaseRef,
} from './fakes.ts'
import type { DeliveryRow } from './ports.ts'
import { createDeliveriesService } from './service.ts'

const CLOCK = { today: () => '2026-10-10', now: () => new Date('2026-10-10T12:00:00Z') }

const CASE_REF: DeliveryCaseRef = {
  code: '26-00001',
  patientRef: 'Paciente 1',
  status: 'en_proceso',
  priority: 'normal',
  clinic: { id: 'cl1', name: 'Clínica A', address: null, city: null, phone: null },
}

function makeRow(over: Partial<DeliveryRow> = {}): DeliveryRow {
  return {
    id: 'd1',
    caseId: 'c1',
    type: 'entrega',
    status: 'pendiente',
    courierId: 'mensajero-1',
    scheduledFor: '2026-10-10',
    doneAt: null,
    proofAttachmentId: null,
    failedReason: null,
    createdAt: new Date('2026-10-08T00:00:00Z'),
    ...over,
  }
}

function makeService(
  opts: {
    cases?: Map<string, DeliveryCaseRef>
    seed?: DeliveryRow[]
    /** Nombre de cada mensajero por id (el join a `users` del repo). */
    couriers?: Map<string, string>
  } = {},
) {
  const { repo, rows } = fakeDeliveriesRepo(
    opts.cases ?? new Map([['c1', CASE_REF]]),
    opts.couriers ?? new Map(),
    opts.seed ?? [],
  )
  const { log, events } = fakeCaseEventLog()
  const uow = fakeDeliveriesUnitOfWork(repo, log)
  const service = createDeliveriesService({
    deliveries: repo,
    couriers: fakeCouriersQuery(),
    uow,
    clock: CLOCK,
  })
  return { service, rows, events }
}

describe('features/deliveries/service', () => {
  it('couriers devuelve los mensajeros activos tal como los da el puerto, solo id y nombre', async () => {
    const service = createDeliveriesService({
      deliveries: fakeDeliveriesRepo(new Map()).repo,
      couriers: fakeCouriersQuery([
        { id: 'u3', name: 'Luis Mensajero' },
        { id: 'u4', name: 'Mario Mensajero' },
      ]),
      uow: fakeDeliveriesUnitOfWork(fakeDeliveriesRepo(new Map()).repo, fakeCaseEventLog().log),
      clock: CLOCK,
    })
    expect(await service.couriers()).toEqual([
      { id: 'u3', name: 'Luis Mensajero' },
      { id: 'u4', name: 'Mario Mensajero' },
    ])
  })

  describe('list', () => {
    it('el mensajero no ve las de otro aunque pida su mensajeroId', async () => {
      const { service } = makeService({
        seed: [
          makeRow({ id: 'd1', courierId: 'yo' }),
          makeRow({ id: 'd2', courierId: 'otro-mensajero' }),
        ],
      })
      const result = await service.list(
        { dia: '2026-10-10', mensajeroId: 'otro-mensajero' },
        { userId: 'yo', role: 'mensajero' },
      )
      expect(result.map((d) => d.id)).toEqual(['d1'])
    })

    // M-1 de la revisión final del PR 2: el filtro forzado es un permiso y se decide con
    // `DELIVERY_MANAGE_ROLES`, no con `role === 'mensajero'`: cualquier rol que no administra
    // entregas (aquí un técnico, si la ruta se aflojara) solo ve las suyas.
    it('un rol que no administra entregas solo ve las suyas aunque pida otro mensajeroId', async () => {
      const { service } = makeService({
        seed: [
          makeRow({ id: 'd1', courierId: 'yo' }),
          makeRow({ id: 'd2', courierId: 'otro-mensajero' }),
        ],
      })
      const result = await service.list(
        { dia: '2026-10-10', mensajeroId: 'otro-mensajero' },
        { userId: 'yo', role: 'tecnico' },
      )
      expect(result.map((d) => d.id)).toEqual(['d1'])
    })

    it('recepción filtra por el mensajero que pide', async () => {
      const { service } = makeService({
        seed: [makeRow({ id: 'd1', courierId: 'uno' }), makeRow({ id: 'd2', courierId: 'dos' })],
      })
      const result = await service.list(
        { dia: '2026-10-10', mensajeroId: 'dos' },
        { userId: 'recep1', role: 'recepcion' },
      )
      expect(result.map((d) => d.id)).toEqual(['d2'])
    })

    it('admin puede ver las de cualquier mensajero', async () => {
      const { service } = makeService({
        seed: [makeRow({ id: 'd1', courierId: 'uno' }), makeRow({ id: 'd2', courierId: 'dos' })],
      })
      const result = await service.list({ dia: '2026-10-10' }, { userId: 'admin1', role: 'admin' })
      expect(result.map((d) => d.id).sort()).toEqual(['d1', 'd2'])
    })

    it('hoy incluye las pendientes atrasadas; otro día no', async () => {
      const { service } = makeService({
        seed: [makeRow({ id: 'd1', scheduledFor: '2026-10-08' })],
      })
      const hoy = await service.list({ dia: '2026-10-10' }, { userId: 'a1', role: 'admin' })
      expect(hoy.map((d) => d.id)).toEqual(['d1'])

      const otroDia = await service.list({ dia: '2026-10-09' }, { userId: 'a1', role: 'admin' })
      expect(otroDia).toEqual([])
    })

    // #118: lo que viene en camino al laboratorio sigue en la lista de hoy.
    it('hoy incluye las recogidas hechas antes cuyo trabajo sigue por recoger; el mensajero, las suyas', async () => {
      const { service } = makeService({
        cases: new Map([
          ['c1', { ...CASE_REF, status: 'por_recoger' }],
          ['c2', { ...CASE_REF, code: '26-00002', status: 'nuevo' }],
          ['c3', { ...CASE_REF, code: '26-00003', status: 'por_recoger' }],
        ]),
        seed: [
          makeRow({
            id: 'd1',
            caseId: 'c1',
            type: 'recogida',
            status: 'hecha',
            scheduledFor: '2026-10-08',
          }),
          // Ya recibido: no viene en camino.
          makeRow({
            id: 'd2',
            caseId: 'c2',
            type: 'recogida',
            status: 'hecha',
            scheduledFor: '2026-10-08',
          }),
          makeRow({
            id: 'd3',
            caseId: 'c3',
            type: 'recogida',
            status: 'hecha',
            scheduledFor: '2026-10-08',
            courierId: 'otro-mensajero',
          }),
        ],
      })
      const hoy = await service.list({ dia: '2026-10-10' }, { userId: 'a1', role: 'admin' })
      expect(hoy.map((d) => d.id)).toEqual(['d1', 'd3'])
      const delMensajero = await service.list(
        { dia: '2026-10-10' },
        { userId: 'mensajero-1', role: 'mensajero' },
      )
      expect(delMensajero.map((d) => d.id)).toEqual(['d1'])
      const otroDia = await service.list({ dia: '2026-10-09' }, { userId: 'a1', role: 'admin' })
      expect(otroDia).toEqual([])
    })
  })

  describe('fail', () => {
    it('cierra la entrega como fallida, crea la nueva pendiente y escribe el evento', async () => {
      const { service, rows, events } = makeService({
        seed: [makeRow({ id: 'd1', caseId: 'c1', type: 'entrega', courierId: 'mensajero-1' })],
      })
      const nueva = await service.fail(
        'd1',
        { motivo: 'No había nadie', nuevaFecha: '2026-10-12' },
        { userId: 'mensajero-1', role: 'mensajero' },
      )
      expect(nueva).toMatchObject({
        caseId: 'c1',
        type: 'entrega',
        courierId: 'mensajero-1',
        status: 'pendiente',
        scheduledFor: '2026-10-12',
      })
      expect(rows.get('d1')).toMatchObject({ status: 'fallida', failedReason: 'No había nadie' })
      expect(events).toEqual([
        {
          caseId: 'c1',
          type: 'delivery_failed',
          fromValue: 'entrega',
          toValue: '2026-10-12',
          reason: 'No había nadie',
          actorId: 'mensajero-1',
        },
      ])
    })

    it('la lista del día dice a qué fecha se reprogramó la fallida (UX4-18)', async () => {
      const { service } = makeService({ seed: [makeRow({ id: 'd1' })] })
      const admin = { userId: 'a1', role: 'admin' } as const
      await service.fail('d1', { motivo: 'Clínica cerrada', nuevaFecha: '2026-10-13' }, admin)
      const [fallida] = await service.list({ dia: '2026-10-10' }, admin)
      expect(fallida).toMatchObject({ id: 'd1', status: 'fallida', rescheduledFor: '2026-10-13' })
    })

    it('el evento de una recogida fallida guarda el tipo en fromValue (UX4-16)', async () => {
      const { service, events } = makeService({
        seed: [makeRow({ id: 'd1', type: 'recogida', courierId: 'mensajero-1' })],
      })
      await service.fail(
        'd1',
        { motivo: 'Cerrado', nuevaFecha: '2026-10-12' },
        { userId: 'mensajero-1', role: 'mensajero' },
      )
      expect(events).toEqual([expect.objectContaining({ fromValue: 'recogida' })])
    })

    it('de una entrega que ya no está pendiente responde con el literal de shared (409)', async () => {
      const { service } = makeService({ seed: [makeRow({ id: 'd1', status: 'hecha' })] })
      await expect(
        service.fail(
          'd1',
          { motivo: 'x', nuevaFecha: '2026-10-12' },
          { userId: 'mensajero-1', role: 'mensajero' },
        ),
      ).rejects.toThrow(DELIVERY_NOT_PENDING_MESSAGE)
    })

    it('de una entrega fallida por cancelación del trabajo también responde 409', async () => {
      const { service } = makeService({
        cases: new Map([['c1', { ...CASE_REF, status: 'cancelado' }]]),
        seed: [
          makeRow({
            id: 'd1',
            status: 'fallida',
            failedReason: 'Trabajo cancelado: no se necesita',
          }),
        ],
      })
      await expect(
        service.fail(
          'd1',
          { motivo: 'x', nuevaFecha: '2026-10-12' },
          { userId: 'admin1', role: 'admin' },
        ),
      ).rejects.toThrow(DELIVERY_NOT_PENDING_MESSAGE)
    })

    it('si otra persona la cierra entre la lectura y el cierre responde 409 y no reprograma', async () => {
      const { service, rows, events } = makeService({ seed: [makeRow({ id: 'd1' })] })
      // `byId` la ve pendiente, pero «Entregado» la cierra antes de que `fail` la marque.
      const original = rows.get.bind(rows)
      let leida = false
      rows.get = (id: string) => {
        const row = original(id)
        if (row && !leida) {
          leida = true
          rows.set(id, { ...row, status: 'hecha' })
        }
        return row
      }
      await expect(
        service.fail(
          'd1',
          { motivo: 'x', nuevaFecha: '2026-10-12' },
          { userId: 'mensajero-1', role: 'mensajero' },
        ),
      ).rejects.toThrow(DELIVERY_NOT_PENDING_MESSAGE)
      expect(original('d1')!.status).toBe('hecha')
      expect(rows.size).toBe(1)
      expect(events).toEqual([])
    })

    it('de otro mensajero responde 403', async () => {
      const { service } = makeService({
        seed: [makeRow({ id: 'd1', courierId: 'mensajero-1' })],
      })
      await expect(
        service.fail(
          'd1',
          { motivo: 'x', nuevaFecha: '2026-10-12' },
          { userId: 'otro-mensajero', role: 'mensajero' },
        ),
      ).rejects.toThrow(DeliveryForbiddenError)
    })

    it('admin y recepción pueden reprogramar la de cualquier mensajero', async () => {
      const { service } = makeService({
        seed: [makeRow({ id: 'd1', courierId: 'mensajero-1' })],
      })
      const nueva = await service.fail(
        'd1',
        { motivo: 'x', nuevaFecha: '2026-10-12' },
        { userId: 'recep1', role: 'recepcion' },
      )
      expect(nueva.courierId).toBe('mensajero-1')
    })

    it('con una fecha anterior a hoy responde con DeliveryInputError (422)', async () => {
      const { service } = makeService({ seed: [makeRow({ id: 'd1' })] })
      await expect(
        service.fail(
          'd1',
          { motivo: 'x', nuevaFecha: '2026-10-09' },
          { userId: 'mensajero-1', role: 'mensajero' },
        ),
      ).rejects.toThrow(DeliveryInputError)
    })
  })
  // #118: «Recogido» cierra la recogida en la clínica sin cambiar el estado del trabajo.
  describe('pickUp', () => {
    const recogida = (over: Partial<DeliveryRow> = {}) =>
      makeRow({ id: 'd1', type: 'recogida', courierId: 'mensajero-1', ...over })
    const couriers = new Map([
      ['mensajero-1', 'Luis Mensajero'],
      ['mensajero-2', 'Mario Mensajero'],
    ])
    const yo = { userId: 'mensajero-1', role: 'mensajero' } as const

    it('el mensajero en la suya: la recogida queda hecha y hay evento picked_up con su nombre', async () => {
      const { service, rows, events } = makeService({ seed: [recogida()], couriers })
      const row = await service.pickUp('d1', yo)
      expect(row).toMatchObject({
        id: 'd1',
        status: 'hecha',
        doneAt: new Date('2026-10-10T12:00:00Z'),
        proofAttachmentId: null,
      })
      expect(rows.get('d1')).toMatchObject({ status: 'hecha', proofAttachmentId: null })
      expect(events).toEqual([
        {
          caseId: 'c1',
          type: 'picked_up',
          fromValue: null,
          toValue: null,
          reason: 'Luis Mensajero',
          actorId: 'mensajero-1',
        },
      ])
    })

    it('recepción la marca en cualquiera y el evento nombra al mensajero asignado, no a quien marca', async () => {
      const { service, rows, events } = makeService({
        seed: [recogida({ courierId: 'mensajero-2' })],
        couriers,
      })
      await service.pickUp('d1', { userId: 'recep1', role: 'recepcion' })
      expect(rows.get('d1')!.status).toBe('hecha')
      expect(events).toMatchObject([{ reason: 'Mario Mensajero', actorId: 'recep1' }])
    })

    it('el mensajero en la de otro responde 403 y no la cierra', async () => {
      const { service, rows, events } = makeService({
        seed: [recogida({ courierId: 'mensajero-2' })],
        couriers,
      })
      await expect(service.pickUp('d1', yo)).rejects.toThrow(DeliveryForbiddenError)
      expect(rows.get('d1')!.status).toBe('pendiente')
      expect(events).toEqual([])
    })

    it.each(['hecha', 'fallida'] as const)(
      'una recogida %s ya no está pendiente: 409 con el literal de shared',
      async (status) => {
        const { service, events } = makeService({ seed: [recogida({ status })], couriers })
        await expect(service.pickUp('d1', yo)).rejects.toThrow(DELIVERY_NOT_PENDING_MESSAGE)
        expect(events).toEqual([])
      },
    )

    it('una que no existe responde 409', async () => {
      const { service } = makeService({ couriers })
      await expect(service.pickUp('no-existe', yo)).rejects.toThrow(DeliveryNotPendingError)
    })

    it('si otra persona la cierra entre la lectura y el cierre responde 409 y no escribe evento', async () => {
      const { service, rows, events } = makeService({ seed: [recogida()], couriers })
      // La lectura la ve pendiente, pero «Recibido» la cierra antes de que `pickUp` la marque.
      const original = rows.get.bind(rows)
      let leida = false
      rows.get = (id: string) => {
        const row = original(id)
        if (row && !leida) {
          leida = true
          rows.set(id, { ...row, status: 'hecha', doneAt: new Date('2026-10-10T11:00:00Z') })
        }
        return row
      }
      await expect(service.pickUp('d1', yo)).rejects.toThrow(DeliveryNotPendingError)
      expect(original('d1')!.doneAt).toEqual(new Date('2026-10-10T11:00:00Z'))
      expect(events).toEqual([])
    })

    it('una entrega no se marca como recogida (422)', async () => {
      const { service, rows, events } = makeService({
        seed: [makeRow({ id: 'd1', type: 'entrega', courierId: 'mensajero-1' })],
        couriers,
      })
      const error = await service.pickUp('d1', yo).catch((e: unknown) => e)
      expect(error).toBeInstanceOf(DeliveryInputError)
      expect(error).toMatchObject({ message: 'Solo una recogida se marca como recogida' })
      expect(rows.get('d1')!.status).toBe('pendiente')
      expect(events).toEqual([])
    })
  })
})
