import { DELIVERY_NOT_PENDING_MESSAGE } from '@dentalware/shared'
import { describe, expect, it } from 'vitest'
import { DeliveryForbiddenError, DeliveryInputError } from './errors.ts'
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
  clinic: { id: 'cl1', name: 'Clínica A', address: null, phone: null },
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
  } = {},
) {
  const { repo, rows } = fakeDeliveriesRepo(
    opts.cases ?? new Map([['c1', CASE_REF]]),
    new Map(),
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
          toValue: '2026-10-12',
          reason: 'No había nadie',
          actorId: 'mensajero-1',
        },
      ])
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
})
