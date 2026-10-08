import type { CaseStatus, RemakeInput } from '@dentalware/shared'
import { describe, expect, it } from 'vitest'
import {
  CaseForbiddenError,
  CaseInputError,
  CaseNotFoundError,
  CaseStateError,
  DeliveryProofMissingError,
} from './errors.ts'
import {
  caseDetailFixture,
  caseInputFixture,
  fakeAttachmentsQuery,
  fakeCasesRepo,
  fakeCouriersLookup,
  fakeDeliveryLog,
  fakeStagesQuery,
  fakeTryins,
  fakeUow,
  fakeUsersQuery,
  fixedClock,
} from './fakes.ts'
import type { FakeAttachment } from './fakes.ts'
import type { CaseDetail, Named, UnitOfWork } from './ports.ts'
import { createCasesService, stripPrices, type CasesService } from './service.ts'

const admin = { userId: 'u1', role: 'admin' } as const
const tecnico = { userId: 'u2', role: 'tecnico' } as const
const mensajero = { userId: 'u3', role: 'mensajero' } as const
const recepcionCtx = { userId: 'u5', role: 'recepcion' } as const

/** Alias descriptivo: una ficha completa (todos los campos que `aceptar` exige), lista para
 * las pruebas de acciones de estado. */
const completo = caseDetailFixture

function build(seed = [caseDetailFixture()], hasDocument = false) {
  const { repo, events, lastListQuery } = fakeCasesRepo(seed)
  // `tryins` no es dependencia del servicio (ver M-1): solo lo necesita `uow.run` para
  // recrear los repos de la transacción, igual que hace `drizzleUnitOfWork` con `tx`.
  const service = createCasesService({
    cases: repo,
    attachments: fakeAttachmentsQuery(hasDocument),
    stages: fakeStagesQuery(),
    users: fakeUsersQuery(),
    couriers: fakeCouriersLookup(),
    deliveries: fakeDeliveryLog().log,
    uow: fakeUow(repo, fakeTryins()),
    clock: fixedClock(),
  })
  return { service, repo, events, lastListQuery }
}

/** Servicio listo para probar `action(...)`: un trabajo `seed`, prueba en boca y fases
 * inyectables, reloj fijo en el viernes 2026-09-18. */
function servicioCon(
  seed: CaseDetail,
  overrides: {
    tryins?: ReturnType<typeof fakeTryins>
    hasDocument?: boolean
    couriers?: Named[]
    attachments?: FakeAttachment[]
  } = {},
) {
  const { repo } = fakeCasesRepo([seed])
  const tryins = overrides.tryins ?? fakeTryins()
  return createCasesService({
    cases: repo,
    attachments: fakeAttachmentsQuery(overrides.hasDocument ?? true, overrides.attachments),
    stages: fakeStagesQuery(),
    users: fakeUsersQuery(),
    couriers: fakeCouriersLookup(overrides.couriers),
    deliveries: fakeDeliveryLog().log,
    uow: fakeUow(repo, tryins),
    clock: fixedClock('2026-09-18'),
  })
}

/** Servicio listo para probar `changeStage(...)`: fases activas `stageIds` (en ese orden,
 * `sort` correlativo) y un trabajo `1` con los overrides dados. */
function servicioConFases(stageIds: string[], overrides: Partial<CaseDetail>) {
  const { repo } = fakeCasesRepo([caseDetailFixture({ id: '1', ...overrides })])
  const stages = stageIds.map((id, sort) => ({ id, sort, active: true }))
  return createCasesService({
    cases: repo,
    attachments: fakeAttachmentsQuery(true),
    stages: fakeStagesQuery(stages),
    users: fakeUsersQuery(),
    couriers: fakeCouriersLookup(),
    deliveries: fakeDeliveryLog().log,
    uow: fakeUow(repo, fakeTryins()),
    clock: fixedClock(),
  })
}

/** Servicio listo para probar `assignTechnician(...)` y `technicians(...)`: técnicos activos
 * `technicians` (el `name` es opcional aquí — las pruebas de asignación solo comparan `id` —
 * y se completa con un nombre por defecto) y un trabajo `1` con los overrides dados. */
function servicioConTecnicos(
  technicians: { id: string; name?: string }[],
  overrides: Partial<CaseDetail>,
) {
  const { repo } = fakeCasesRepo([caseDetailFixture({ id: '1', ...overrides })])
  return createCasesService({
    cases: repo,
    attachments: fakeAttachmentsQuery(true),
    stages: fakeStagesQuery(),
    users: fakeUsersQuery(technicians.map((t) => ({ name: 'Técnico', ...t }))),
    couriers: fakeCouriersLookup(),
    deliveries: fakeDeliveryLog().log,
    uow: fakeUow(repo, fakeTryins()),
    clock: fixedClock(),
  })
}

/** Servicio listo para probar `summary()`: sin `hasDocument` ni fases/técnicos relevantes,
 * reloj fijo en `today`. */
function servicioParaResumen(seed: CaseDetail[], today: string) {
  const { repo } = fakeCasesRepo(seed)
  return createCasesService({
    cases: repo,
    attachments: fakeAttachmentsQuery(false),
    stages: fakeStagesQuery(),
    users: fakeUsersQuery(),
    couriers: fakeCouriersLookup(),
    deliveries: fakeDeliveryLog().log,
    uow: fakeUow(repo),
    clock: fixedClock(today),
  })
}

describe('createCasesService', () => {
  it('la lista oculta el total a técnico y mensajero y lo muestra a admin', async () => {
    const { service } = build()
    expect((await service.list({ pagina: 1 } as never, tecnico)).cases[0]!.total).toBeNull()
    expect((await service.list({ pagina: 1 } as never, admin)).cases[0]!.total).toBe('90.00')
  })

  it('la lista pasa `orden` al repositorio', async () => {
    const { service, lastListQuery } = build()
    await service.list({ pagina: 1, orden: 'entrega-desc' } as never, admin)
    expect(lastListQuery()?.orden).toBe('entrega-desc')
  })

  it('el detalle oculta precios y notas internas al técnico', async () => {
    const { service } = build()
    const r = await service.detail('c1', tecnico)
    expect(r.case.total).toBeNull()
    expect(r.case.internalNotes).toBeNull()
    expect(r.case.items[0]!.unitPrice).toBeNull()
  })

  it('el detalle reclama la prescripción cuando no hay texto ni documento adjunto', async () => {
    const { service } = build([caseDetailFixture({ prescription: null })], false)
    const r = await service.detail('c1', admin)
    expect(r.missing).toContain('Prescripción (texto o documento)')
  })

  it('el detalle no reclama la prescripción cuando existe un adjunto de tipo documento', async () => {
    const { service } = build([caseDetailFixture({ prescription: null })], true)
    const r = await service.detail('c1', admin)
    expect(r.missing).not.toContain('Prescripción (texto o documento)')
  })

  it('lanza CaseNotFoundError si el trabajo no existe', async () => {
    const { service } = build()
    await expect(service.detail('nope', admin)).rejects.toBeInstanceOf(CaseNotFoundError)
  })

  // Tarea 15 (FIC-2 #72): `GET /api/trabajos/codigo/:code` resuelve el trabajo por código y
  // aplica el mismo enmascarado por rol que `detail` (ruling: nada de duplicar `stripPrices`).
  it('detailByCode resuelve el trabajo por su código y oculta precios al técnico', async () => {
    const { service } = build()
    const r = await service.detailByCode('26-00001', tecnico)
    expect(r.case.id).toBe('c1')
    expect(r.case.total).toBeNull()
    expect(r.case.items[0]!.unitPrice).toBeNull()
  })

  it('detailByCode no oculta precios a admin', async () => {
    const { service } = build()
    const r = await service.detailByCode('26-00001', admin)
    expect(r.case.total).toBe('90.00')
  })

  it('detailByCode lanza CaseNotFoundError con un código inexistente', async () => {
    const { service } = build()
    await expect(service.detailByCode('26-99999', admin)).rejects.toBeInstanceOf(CaseNotFoundError)
  })

  it('crear devuelve el detalle recién creado y registra el evento created', async () => {
    const { service, events } = build([])
    const c = await service.create(caseInputFixture(), admin)
    expect(c.code).toMatch(/^26-/)
    expect(events.map((e) => e.type)).toEqual(['created'])
  })

  it('editar un trabajo en estado no editable lanza CaseStateError', async () => {
    const { service } = build([caseDetailFixture({ status: 'terminado' })])
    await expect(service.update('c1', caseInputFixture(), admin)).rejects.toBeInstanceOf(
      CaseStateError,
    )
  })

  it('editar un trabajo inexistente lanza CaseNotFoundError', async () => {
    const { service } = build([])
    await expect(service.update('nope', caseInputFixture(), admin)).rejects.toBeInstanceOf(
      CaseNotFoundError,
    )
  })

  it('los eventos price_changed llegan enmascarados al técnico', async () => {
    const { service, repo } = build()
    await repo.addEvent({
      caseId: 'c1',
      type: 'price_changed',
      fromValue: 'p1:45.00',
      toValue: 'p1:50.00',
      actorId: 'u1',
    })
    const ev = await service.events('c1', tecnico)
    expect(ev[0]).toMatchObject({ type: 'price_changed', fromValue: null, toValue: null })
    expect((await service.events('c1', admin))[0]!.toValue).toBe('p1:50.00')
  })

  describe('historial por rol: los eventos de cobro llevan importes (Iteración 5)', () => {
    const cobro = [
      { type: 'payment_applied', toValue: '45.00', reason: 'Transferencia · TRX-1' },
      { type: 'payment_voided', toValue: '45.00', reason: 'Pago duplicado' },
      { type: 'adjustment_added', toValue: '-5.00', reason: 'Descuento por demora' },
    ] as const

    async function withPaymentEvents() {
      const built = build()
      for (const e of cobro) {
        await built.repo.addEvent({ caseId: 'c1', fromValue: null, actorId: 'u1', ...e })
      }
      return built.service
    }

    it.each([
      ['técnico', tecnico],
      ['mensajero', mensajero],
    ])('al %s le llegan sin monto, método, referencia ni motivo', async (_label, ctx) => {
      const service = await withPaymentEvents()
      expect(await service.events('c1', ctx)).toEqual(
        cobro.map((e) =>
          expect.objectContaining({ type: e.type, fromValue: null, toValue: null, reason: null }),
        ),
      )
    })

    it.each([
      ['admin', admin],
      ['recepción', recepcionCtx],
    ])('%s los ve con su monto y su motivo', async (_label, ctx) => {
      const service = await withPaymentEvents()
      expect(await service.events('c1', ctx)).toEqual(
        cobro.map((e) => expect.objectContaining({ ...e, fromValue: null })),
      )
    })
  })

  it('comentar registra un evento comment y devuelve ese evento', async () => {
    const { service } = build()
    const e = await service.comment('c1', 'Hola', admin)
    expect(e).toMatchObject({ type: 'comment', toValue: 'Hola' })
  })

  it('comentar en un trabajo inexistente lanza CaseNotFoundError', async () => {
    const { service } = build([])
    await expect(service.comment('nope', 'Hola', admin)).rejects.toBeInstanceOf(CaseNotFoundError)
  })

  it('stripPrices anula precios, totales y el porcentaje de cobro de la repetición (M-7)', () => {
    const s = stripPrices({
      total: '10.00',
      internalNotes: 'nota',
      remakeChargePct: '50.00',
      items: [{ unitPrice: '1.00', lineTotal: '1.00', discountPct: '0.00', quantity: 1 }],
    })
    expect(s.total).toBeNull()
    expect(s.internalNotes).toBeNull()
    expect(s.remakeChargePct).toBeNull()
    expect(s.items[0]).toMatchObject({
      unitPrice: null,
      lineTotal: null,
      discountPct: null,
      quantity: 1,
    })
  })
})

describe('acciones de estado', () => {
  it('aceptar fija la fecha comprometida en días hábiles y la fase inicial', async () => {
    // viernes 2026-09-18 + 5 días hábiles = viernes 2026-09-25
    const { repo } = fakeCasesRepo([completo({ id: '1', status: 'nuevo' })])
    const service = createCasesService({
      cases: repo,
      attachments: fakeAttachmentsQuery(true),
      stages: fakeStagesQuery([{ id: 'f1', sort: 1, active: true }]),
      deliveries: fakeDeliveryLog().log,
      uow: fakeUow(repo, fakeTryins()),
      clock: fixedClock('2026-09-18'),
    })
    await service.action('1', { accion: 'aceptar', motivo: null }, admin)
    const guardado = await service.detail('1', admin)
    expect(guardado.case.status).toBe('en_proceso')
    expect(guardado.case.promisedDate).toBe('2026-09-25')
    expect(guardado.case.currentStageId).toBe('f1')
  })

  it('aceptar con datos incompletos lanza CaseInputError con el detalle de lo que falta', async () => {
    const service = servicioCon(completo({ id: '1', status: 'nuevo', patientRef: '' }))
    await expect(service.action('1', { accion: 'aceptar', motivo: null }, admin)).rejects.toThrow(
      CaseInputError,
    )
  })

  it('un técnico no puede aceptar', async () => {
    const service = servicioCon(completo({ id: '1', status: 'nuevo' }))
    await expect(service.action('1', { accion: 'aceptar', motivo: null }, tecnico)).rejects.toThrow(
      CaseForbiddenError,
    )
  })

  it('pausar guarda el motivo y reanudar lo limpia', async () => {
    const service = servicioCon(completo({ id: '1', status: 'en_proceso' }))
    await service.action('1', { accion: 'pausar', motivo: 'Falta antagonista' }, admin)
    expect((await service.detail('1', admin)).case.holdReason).toBe('Falta antagonista')
    await service.action('1', { accion: 'reanudar', motivo: null }, admin)
    expect((await service.detail('1', admin)).case.holdReason).toBeNull()
  })

  it('enviar a prueba abre una prueba y recibirla la cierra', async () => {
    const tryins = fakeTryins()
    const service = servicioCon(completo({ id: '1', status: 'en_proceso' }), { tryins })
    await service.action('1', { accion: 'enviar_prueba', motivo: null }, admin)
    expect(await tryins.open('1')).toMatchObject({ sentAt: '2026-09-18', returnedAt: null })
    await service.action('1', { accion: 'recibir_prueba', motivo: null }, admin)
    expect(await tryins.open('1')).toBeUndefined()
  })

  it('una transición inválida lanza CaseStateError', async () => {
    const service = servicioCon(completo({ id: '1', status: 'nuevo' }))
    await expect(service.action('1', { accion: 'finalizar', motivo: null }, admin)).rejects.toThrow(
      CaseStateError,
    )
  })

  // UX3-03: el mensaje del 409 llega tal cual al toast de quien tenía la ficha abierta.
  it('una transición inválida explica la acción y el estado con sus rótulos', async () => {
    const service = servicioCon(completo({ id: '1', status: 'en_proceso' }))
    await expect(
      service.action('1', { accion: 'marcar_entregado', motivo: null }, admin),
    ).rejects.toThrow(
      'No se puede "Marcar entregado": el trabajo está en estado "En proceso". Puede que otra persona lo haya cambiado.',
    )
  })

  it('cancelar registra el motivo en el evento', async () => {
    const service = servicioCon(completo({ id: '1', status: 'en_proceso' }))
    await service.action('1', { accion: 'cancelar', motivo: 'Paciente desistió' }, admin)
    expect((await service.detail('1', admin)).case.status).toBe('cancelado')
    const eventos = await service.events('1', admin)
    expect(eventos.at(-1)).toMatchObject({ type: 'cancelled', reason: 'Paciente desistió' })
  })

  it('cada acción escribe su evento con el actor y el motivo', async () => {
    const service = servicioCon(completo({ id: '1', status: 'en_proceso' }))
    await service.action('1', { accion: 'pausar', motivo: 'Falta antagonista' }, admin)
    let eventos = await service.events('1', admin)
    expect(eventos.at(-1)).toMatchObject({
      type: 'hold',
      actorId: admin.userId,
      reason: 'Falta antagonista',
    })
    await service.action('1', { accion: 'reanudar', motivo: null }, admin)
    eventos = await service.events('1', admin)
    expect(eventos.at(-1)).toMatchObject({ type: 'resumed', actorId: admin.userId })
  })

  it('al finalizar, el técnico tiene permiso pero no recibe el total ni las notas internas', async () => {
    const service = servicioCon(completo({ id: '1', status: 'en_proceso', total: '90.00' }))
    const c = await service.action('1', { accion: 'finalizar', motivo: null }, tecnico)
    expect(c.status).toBe('terminado')
    expect(c.total).toBeNull()
    expect(c.internalNotes).toBeNull()
  })

  it('finalizar fija finishedAt', async () => {
    const service = servicioCon(completo({ id: '1', status: 'en_proceso' }))
    await service.action('1', { accion: 'finalizar', motivo: null }, admin)
    expect((await service.detail('1', admin)).case.finishedAt).not.toBeNull()
  })

  it('cada acción escribe el tipo de evento y el estado antes/después que le corresponden', async () => {
    const tryins = fakeTryins()
    const service = servicioCon(completo({ id: '1', status: 'nuevo' }), {
      tryins,
      couriers: [{ id: 'u3', name: 'Mario Mensajero' }],
      attachments: [{ id: 'a1', caseId: '1', mime: 'image/jpeg', kind: 'constancia' }],
    })

    await service.action('1', { accion: 'aceptar', motivo: null }, admin)
    await service.action('1', { accion: 'enviar_prueba', motivo: null }, admin)
    await service.action('1', { accion: 'recibir_prueba', motivo: null }, admin)
    await service.action('1', { accion: 'finalizar', motivo: null }, admin)
    await service.action(
      '1',
      {
        accion: 'marcar_enviado',
        motivo: null,
        envio: { mensajeroId: 'u3', fecha: '2026-09-18' },
      },
      admin,
    )
    await service.action(
      '1',
      { accion: 'marcar_entregado', motivo: null, constanciaId: 'a1' },
      admin,
    )

    const eventos = await service.events('1', admin)
    expect(eventos.map((e) => e.type)).toEqual([
      'status_changed', // aceptar
      'tryin_sent',
      'tryin_returned',
      'status_changed', // finalizar
      'shipped',
      'delivered',
    ])
    expect(eventos[0]).toMatchObject({ fromValue: 'nuevo', toValue: 'en_proceso' })
    expect(eventos[3]).toMatchObject({ fromValue: 'en_proceso', toValue: 'terminado' })
    // `shipped` lleva la fecha de entrega y `delivered` la constancia (Iteración 4, ENT-3/ENT-4).
    expect(eventos[4]).toMatchObject({ fromValue: 'terminado', toValue: '2026-09-18' })
    expect(eventos[5]).toMatchObject({ fromValue: 'enviado', toValue: 'a1' })
  })
})

describe('cambio de fase', () => {
  it('avanza a la siguiente fase activa y deja el evento con la fase anterior y la nueva', async () => {
    const service = servicioConFases(['f1', 'f2'], { status: 'en_proceso', currentStageId: 'f1' })
    await service.changeStage('1', { direccion: 'avanzar', motivo: null }, admin)
    expect((await service.detail('1', admin)).case.currentStageId).toBe('f2')
    // Desviación del snippet del brief (fromStageId/toStageId): `case_events` solo tiene las
    // columnas genéricas `from_value`/`to_value` (ya usadas por `status_changed`/`price_changed`);
    // esta tarea no trae migración nueva (schema.ts no está en su lista de archivos).
    expect((await service.events('1', admin)).at(-1)).toMatchObject({
      type: 'stage_changed',
      fromValue: 'f1',
      toValue: 'f2',
    })
  })

  it('no avanza desde la última fase: hay que finalizar', async () => {
    const service = servicioConFases(['f1'], { status: 'en_proceso', currentStageId: 'f1' })
    await expect(
      service.changeStage('1', { direccion: 'avanzar', motivo: null }, admin),
    ).rejects.toThrow(
      'No se puede avanzar: el trabajo ya está en la última fase. Usa "Finalizar" para terminarlo.',
    )
  })

  it('un trabajo en espera o en prueba no cambia de fase', async () => {
    for (const status of ['en_espera', 'en_prueba'] as const) {
      const service = servicioConFases(['f1', 'f2'], { status, currentStageId: 'f1' })
      await expect(
        service.changeStage('1', { direccion: 'avanzar', motivo: null }, admin),
      ).rejects.toThrow(CaseStateError)
    }
  })

  // I-1 (ronda de fixes 1): `en_proceso` es lista blanca, no lista negra. Antes de este fix,
  // un trabajo `entregado`/`cancelado` seguía cambiando de fase (bug real, reproducido con
  // fakes): un técnico que abre por error la ficha de un trabajo ya entregado y retrocede la
  // fase obtenía 200, un `stage_changed` espurio en el historial y una fase de producción en
  // curso en un trabajo cerrado.
  it('un trabajo entregado no cambia de fase (repro del bug: retroceder, rol técnico)', async () => {
    const service = servicioConFases(['f1', 'f2'], { status: 'entregado', currentStageId: 'f2' })
    await expect(
      service.changeStage('1', { direccion: 'retroceder', motivo: 'Corrección' }, tecnico),
    ).rejects.toThrow(CaseStateError)
  })

  it('un trabajo cancelado no cambia de fase (repro del bug: avanzar)', async () => {
    const service = servicioConFases(['f1', 'f2'], { status: 'cancelado', currentStageId: 'f1' })
    await expect(
      service.changeStage('1', { direccion: 'avanzar', motivo: null }, admin),
    ).rejects.toThrow(CaseStateError)
  })

  it('solo en_proceso cambia de fase; cada otro estado da un motivo distinto en español', async () => {
    const motivoPorEstado: [CaseStatus, RegExp][] = [
      ['nuevo', /todavía no tiene fase/i],
      ['en_espera', /en espera/i],
      ['en_prueba', /prueba en boca/i],
      ['terminado', /ya está terminado/i],
      ['enviado', /ya fue enviado/i],
      ['entregado', /ya fue entregado/i],
      ['cancelado', /está cancelado/i],
    ]
    for (const [status, motivo] of motivoPorEstado) {
      const service = servicioConFases(['f1', 'f2'], { status, currentStageId: 'f1' })
      await expect(
        service.changeStage('1', { direccion: 'avanzar', motivo: null }, admin),
      ).rejects.toThrow(motivo)
    }
  })

  // M-1 (ronda de fixes 1): `nextStage`/`previousStage` devuelven `undefined` tanto si la
  // fase actual es la última/primera como si su posición es desconocida (currentStageId nulo
  // o una fase que se desactivó mientras el trabajo la tenía). `isLastStage` distingue ambos
  // casos: si se confunden, el mensaje le dice a un técnico que "finalice" un trabajo que en
  // realidad está a mitad de una fase desactivada.
  it('si la fase actual no está entre las activas, el mensaje no dice "última fase"', async () => {
    // f3 no aparece en la lista de fases activas: simula una fase desactivada con el trabajo
    // todavía en ella.
    const service = servicioConFases(['f1', 'f2'], { status: 'en_proceso', currentStageId: 'f3' })
    await expect(
      service.changeStage('1', { direccion: 'avanzar', motivo: null }, admin),
    ).rejects.toThrow(/no se pudo determinar/i)
  })

  // M-2 (ronda de fixes 1): mismo patrón que `assignTechnician` (y que `action`/`canPerform`):
  // el guardián de la ruta es una capa, la comprobación del servicio es la que sobrevive a que
  // alguien toque la ruta.
  it('un mensajero no puede cambiar de fase', async () => {
    const service = servicioConFases(['f1', 'f2'], { status: 'en_proceso', currentStageId: 'f1' })
    await expect(
      service.changeStage('1', { direccion: 'avanzar', motivo: null }, mensajero),
    ).rejects.toThrow(CaseForbiddenError)
  })

  it('el técnico asignado puede avanzar la fase', async () => {
    const service = servicioConFases(['f1', 'f2'], { status: 'en_proceso', currentStageId: 'f1' })
    await expect(
      service.changeStage('1', { direccion: 'avanzar', motivo: null }, tecnico),
    ).resolves.toBeDefined()
  })

  it('retrocede a la fase anterior y guarda el motivo en el evento', async () => {
    const service = servicioConFases(['f1', 'f2'], { status: 'en_proceso', currentStageId: 'f2' })
    await service.changeStage('1', { direccion: 'retroceder', motivo: 'Se rompió' }, admin)
    expect((await service.detail('1', admin)).case.currentStageId).toBe('f1')
    expect((await service.events('1', admin)).at(-1)).toMatchObject({
      type: 'stage_changed',
      fromValue: 'f2',
      toValue: 'f1',
      reason: 'Se rompió',
    })
  })

  it('no retrocede desde la primera fase', async () => {
    const service = servicioConFases(['f1', 'f2'], { status: 'en_proceso', currentStageId: 'f1' })
    await expect(
      service.changeStage('1', { direccion: 'retroceder', motivo: 'Se rompió' }, admin),
    ).rejects.toThrow('No se puede retroceder: el trabajo ya está en la primera fase.')
  })

  it('un trabajo inexistente lanza CaseNotFoundError', async () => {
    const service = servicioConFases(['f1', 'f2'], { status: 'en_proceso', currentStageId: 'f1' })
    await expect(
      service.changeStage('nope', { direccion: 'avanzar', motivo: null }, admin),
    ).rejects.toBeInstanceOf(CaseNotFoundError)
  })
})

describe('técnico responsable', () => {
  it('asigna un técnico activo y deja el evento con antes y después', async () => {
    const service = servicioConTecnicos([{ id: 't1' }, { id: 't2' }], {
      assignedTechnicianId: 't1',
    })
    await service.assignTechnician('1', { tecnicoId: 't2' }, admin)
    expect((await service.detail('1', admin)).case.assignedTechnicianId).toBe('t2')
    expect((await service.events('1', admin)).at(-1)).toMatchObject({ type: 'assigned' })
  })

  // #97: dentro de la transacción, las escrituras del trabajo leen con `byIdForUpdate` (fila
  // bloqueada) y nunca con `byId`. El fake no tiene concurrencia, así que se comprueba la
  // lectura: el repo de la unidad de trabajo falla si alguien usa `byId`. El bloqueo real contra
  // Postgres lo prueban los tests de concurrencia de `cases.test.ts`.
  it.each([
    ['assignTechnician', (s: CasesService) => s.assignTechnician('1', { tecnicoId: 't1' }, admin)],
    ['action', (s: CasesService) => s.action('1', { accion: 'pausar', motivo: 'Falta' }, admin)],
    [
      'changeStage',
      (s: CasesService) => s.changeStage('1', { direccion: 'avanzar', motivo: null }, admin),
    ],
  ])('%s lee el trabajo con byIdForUpdate dentro de la transacción', async (_metodo, run) => {
    const { repo } = fakeCasesRepo([
      caseDetailFixture({ id: '1', status: 'en_proceso', currentStageId: 'f1' }),
    ])
    const sinBloqueo = {
      ...repo,
      byId: async () => {
        throw new Error('lectura sin FOR UPDATE dentro de la transacción')
      },
    }
    const service = createCasesService({
      cases: repo,
      attachments: fakeAttachmentsQuery(true),
      stages: fakeStagesQuery([
        { id: 'f1', sort: 1, active: true },
        { id: 'f2', sort: 2, active: true },
      ]),
      users: fakeUsersQuery([{ id: 't1', name: 'Técnico' }]),
      couriers: fakeCouriersLookup(),
      deliveries: fakeDeliveryLog().log,
      uow: fakeUow(sinBloqueo),
      clock: fixedClock(),
    })
    await expect(run(service)).resolves.toMatchObject({ id: '1' })
  })

  it('rechaza un usuario que no es técnico activo', async () => {
    const service = servicioConTecnicos([{ id: 't1' }], {})
    await expect(service.assignTechnician('1', { tecnicoId: 'otro' }, admin)).rejects.toThrow(
      CaseInputError,
    )
  })

  it('acepta desasignar con null', async () => {
    const service = servicioConTecnicos([{ id: 't1' }], { assignedTechnicianId: 't1' })
    await service.assignTechnician('1', { tecnicoId: null }, admin)
    expect((await service.detail('1', admin)).case.assignedTechnicianId).toBeNull()
  })

  it('un técnico no puede asignar', async () => {
    const service = servicioConTecnicos([{ id: 't1' }], {})
    await expect(service.assignTechnician('1', { tecnicoId: 't1' }, tecnico)).rejects.toThrow(
      CaseForbiddenError,
    )
  })

  it('un trabajo inexistente lanza CaseNotFoundError', async () => {
    const service = servicioConTecnicos([{ id: 't1' }], {})
    await expect(
      service.assignTechnician('nope', { tecnicoId: 't1' }, admin),
    ).rejects.toBeInstanceOf(CaseNotFoundError)
  })

  // I-1 (ronda de fixes 1): a diferencia de `changeStage`, aquí solo se bloquean los estados
  // terminales. Corregir quién es el responsable de un trabajo que todavía se mueve por el
  // laboratorio es legítimo (recepción lo va a necesitar); hacerlo sobre uno ya cerrado no.
  it('no se puede reasignar el técnico de un trabajo entregado o cancelado', async () => {
    for (const status of ['entregado', 'cancelado'] as const) {
      const service = servicioConTecnicos([{ id: 't1' }], { status })
      await expect(service.assignTechnician('1', { tecnicoId: 't1' }, admin)).rejects.toThrow(
        CaseStateError,
      )
    }
  })

  it('el 409 de reasignar nombra el estado con su rótulo', async () => {
    const service = servicioConTecnicos([{ id: 't1' }], { status: 'entregado' })
    await expect(service.assignTechnician('1', { tecnicoId: 't1' }, admin)).rejects.toThrow(
      'No se puede reasignar el técnico: el trabajo está en estado "Entregado". Puede que otra persona lo haya cambiado.',
    )
  })

  it('sí se puede reasignar el técnico mientras el trabajo se sigue moviendo por el laboratorio', async () => {
    for (const status of [
      'nuevo',
      'en_proceso',
      'en_espera',
      'en_prueba',
      'terminado',
      'enviado',
    ] as const) {
      const service = servicioConTecnicos([{ id: 't1' }], { status })
      await expect(service.assignTechnician('1', { tecnicoId: 't1' }, admin)).resolves.toBeDefined()
    }
  })
})

describe('lista de técnicos para asignar (Tarea 9)', () => {
  it('admin y recepción reciben id y nombre de los técnicos activos', async () => {
    const service = servicioConTecnicos(
      [
        { id: 't1', name: 'Ana Técnica' },
        { id: 't2', name: 'Beto Técnico' },
      ],
      {},
    )
    await expect(service.technicians(admin)).resolves.toEqual([
      { id: 't1', name: 'Ana Técnica' },
      { id: 't2', name: 'Beto Técnico' },
    ])
    await expect(service.technicians({ userId: 'u4', role: 'recepcion' })).resolves.toEqual([
      { id: 't1', name: 'Ana Técnica' },
      { id: 't2', name: 'Beto Técnico' },
    ])
  })

  it('técnico y mensajero no pueden pedir la lista', async () => {
    const service = servicioConTecnicos([{ id: 't1', name: 'Ana Técnica' }], {})
    await expect(service.technicians(tecnico)).rejects.toThrow(CaseForbiddenError)
    await expect(service.technicians(mensajero)).rejects.toThrow(CaseForbiddenError)
  })
})

describe('repetición', () => {
  const remake: RemakeInput = {
    motivo: 'Fractura en cerámica al probar',
    responsabilidad: 'laboratorio',
    cobroPct: 0,
  }

  it('crea un trabajo hijo con las líneas y el odontograma del original', async () => {
    const service = servicioCon(completo({ id: '1', status: 'terminado' }))
    const hijo = await service.createRemake('1', remake, admin)
    const ficha = await service.detail(hijo.id, admin)
    expect(ficha.case.status).toBe('nuevo')
    expect(ficha.case.parentCaseId).toBe('1')
    expect(ficha.case.items).toHaveLength(1)
    expect(ficha.case.items[0]!.teeth).toEqual([11, 12])
  })

  it('deja el evento «repetición creada» en el original y en el hijo', async () => {
    const service = servicioCon(completo({ id: '1', status: 'terminado' }))
    const hijo = await service.createRemake('1', remake, admin)
    expect((await service.events('1', admin)).some((e) => e.type === 'remake_created')).toBe(true)
    expect((await service.events(hijo.id, admin)).some((e) => e.type === 'remake_created')).toBe(
      true,
    )
  })

  it('guarda el motivo, la responsabilidad y el porcentaje de cobro en el hijo', async () => {
    const service = servicioCon(completo({ id: '1', status: 'terminado' }))
    const hijo = await service.createRemake(
      '1',
      { motivo: 'Color equivocado', responsabilidad: 'compartida', cobroPct: 50 },
      admin,
    )
    const ficha = await service.detail(hijo.id, admin)
    expect(ficha.case.remakeReason).toBe('Color equivocado')
    expect(ficha.case.remakeResponsibility).toBe('compartida')
    expect(ficha.case.remakeChargePct).toBe('50.00')
  })

  it('el hijo nace sin fase ni técnico asignado, aunque el padre los tuviera', async () => {
    const service = servicioCon(
      completo({ id: '1', status: 'terminado', currentStageId: 'f1', assignedTechnicianId: 't1' }),
    )
    const hijo = await service.createRemake('1', remake, admin)
    const ficha = await service.detail(hijo.id, admin)
    expect(ficha.case.currentStageId).toBeNull()
    expect(ficha.case.assignedTechnicianId).toBeNull()
  })

  it('se puede repetir un trabajo que ya es una repetición (encadenado al padre inmediato)', async () => {
    const service = servicioCon(completo({ id: '1', status: 'terminado', parentCaseId: 'abuelo' }))
    const hijo = await service.createRemake('1', remake, admin)
    const ficha = await service.detail(hijo.id, admin)
    expect(ficha.case.parentCaseId).toBe('1')
  })

  it('se puede repetir el mismo trabajo más de una vez', async () => {
    const service = servicioCon(completo({ id: '1', status: 'terminado' }))
    const primero = await service.createRemake('1', remake, admin)
    const segundo = await service.createRemake('1', remake, admin)
    expect(primero.id).not.toBe(segundo.id)
  })

  it('se puede repetir desde enviado y desde entregado, no solo desde terminado', async () => {
    for (const status of ['enviado', 'entregado'] as const) {
      const service = servicioCon(completo({ id: '1', status }))
      await expect(service.createRemake('1', remake, admin)).resolves.toBeDefined()
    }
  })

  it('no se puede repetir un trabajo que aún está en proceso', async () => {
    const service = servicioCon(completo({ id: '1', status: 'en_proceso' }))
    await expect(service.createRemake('1', remake, admin)).rejects.toThrow(CaseStateError)
  })

  it('un trabajo inexistente lanza CaseNotFoundError', async () => {
    const service = servicioCon(completo({ id: '1', status: 'terminado' }))
    await expect(service.createRemake('nope', remake, admin)).rejects.toBeInstanceOf(
      CaseNotFoundError,
    )
  })

  it('un técnico no puede crear repeticiones', async () => {
    const service = servicioCon(completo({ id: '1', status: 'terminado' }))
    await expect(service.createRemake('1', remake, tecnico)).rejects.toThrow(CaseForbiddenError)
  })

  it('un mensajero no puede crear repeticiones', async () => {
    const service = servicioCon(completo({ id: '1', status: 'terminado' }))
    await expect(service.createRemake('1', remake, mensajero)).rejects.toThrow(CaseForbiddenError)
  })

  // I-3 (ronda de fixes 1): el disparador típico de una repetición es que el trabajo salió
  // mal *después* de la fecha comprometida (se entrega el 15, la clínica lo rechaza el 18,
  // recepción repite el 18): copiar `dueDate` tal cual metería al hijo en la vista
  // "atrasados" desde el momento en que se crea. `servicioCon` fija el reloj en 2026-09-18.
  it('no copia la fecha deseada del padre si ya pasó: el hijo no nace atrasado', async () => {
    const service = servicioCon(completo({ id: '1', status: 'terminado', dueDate: '2026-09-16' }))
    const hijo = await service.createRemake('1', remake, admin)
    const ficha = await service.detail(hijo.id, admin)
    expect(ficha.case.dueDate).toBeNull()
  })

  it('copia la fecha deseada del padre si todavía no ha pasado', async () => {
    const service = servicioCon(completo({ id: '1', status: 'terminado', dueDate: '2026-09-20' }))
    const hijo = await service.createRemake('1', remake, admin)
    const ficha = await service.detail(hijo.id, admin)
    expect(ficha.case.dueDate).toBe('2026-09-20')
  })

  it('copia la fecha deseada del padre si es exactamente hoy', async () => {
    const service = servicioCon(completo({ id: '1', status: 'terminado', dueDate: '2026-09-18' }))
    const hijo = await service.createRemake('1', remake, admin)
    const ficha = await service.detail(hijo.id, admin)
    expect(ficha.case.dueDate).toBe('2026-09-18')
  })

  // M-3 (ronda de fixes 1). Ojo con lo que este test cubre y lo que no: quien deshace aquí es
  // el propio `uowQueFalla`, no Postgres, así que NO demuestra que la transacción revierta —
  // eso lo prueba `cases.repo.test.ts` con `drizzleUnitOfWork` contra la BD real. Lo que sí
  // demuestra, y es la mitad que le toca al servicio, es que `createRemake` hace **todas** sus
  // escrituras dentro de `uow.run`: si se le escapara una (un evento suelto antes o después),
  // la instantánea de `rows`/`events` no la cubriría y los dos `expect` finales caerían.
  it('hace todas sus escrituras dentro de uow.run, así que el rollback no deja rastro', async () => {
    const { repo, rows, events } = fakeCasesRepo([completo({ id: '1', status: 'terminado' })])
    const rowsAntes = rows.size
    const eventsAntes = events.length
    const uowQueFalla: UnitOfWork = {
      async run(fn) {
        const rowsSnapshot = new Map(rows)
        const eventsSnapshot = [...events]
        try {
          await fn({ cases: repo, tryins: fakeTryins(), deliveries: fakeDeliveryLog().log })
          throw new Error('fallo simulado después de crear el hijo')
        } catch (e) {
          rows.clear()
          for (const [k, v] of rowsSnapshot) rows.set(k, v)
          events.length = 0
          events.push(...eventsSnapshot)
          throw e
        }
      },
    }
    const service = createCasesService({
      cases: repo,
      attachments: fakeAttachmentsQuery(true),
      stages: fakeStagesQuery(),
      users: fakeUsersQuery(),
      couriers: fakeCouriersLookup(),
      deliveries: fakeDeliveryLog().log,
      uow: uowQueFalla,
      clock: fixedClock('2026-09-18'),
    })
    await expect(service.createRemake('1', remake, admin)).rejects.toThrow(
      'fallo simulado después de crear el hijo',
    )
    expect(rows.size).toBe(rowsAntes)
    expect(events.length).toBe(eventsAntes)
  })
})

// #96, Tarea 9: desde la ficha del padre no había forma de ver sus repeticiones (solo el hijo
// enlazaba al padre con `parentCaseId`). `remakes` solo recorre un nivel: el padre inmediato,
// no el árbol completo (una repetición de una repetición encadena al padre inmediato).
describe('repeticiones de un trabajo', () => {
  const remake: RemakeInput = {
    motivo: 'Fractura en cerámica al probar',
    responsabilidad: 'laboratorio',
    cobroPct: 0,
  }

  it('lista solo los hijos directos, de la más reciente a la más antigua, sin el nieto', async () => {
    const { repo, rows } = fakeCasesRepo([completo({ id: '1', status: 'terminado' })])
    const service = createCasesService({
      cases: repo,
      attachments: fakeAttachmentsQuery(true),
      stages: fakeStagesQuery(),
      users: fakeUsersQuery(),
      couriers: fakeCouriersLookup(),
      deliveries: fakeDeliveryLog().log,
      uow: fakeUow(repo, fakeTryins()),
      clock: fixedClock('2026-09-18'),
    })
    const hijo1 = await service.createRemake('1', remake, admin)
    const hijo2 = await service.createRemake('1', remake, admin)
    // El nieto cuelga de hijo2, no de '1': se fuerza su estado a mano (no es el foco de este
    // test cómo se llega ahí, ver la suite de arriba) para poder repetirlo.
    rows.set(hijo2.id, { ...rows.get(hijo2.id)!, status: 'terminado' })
    const nieto = await service.createRemake(hijo2.id, remake, admin)

    const repeticiones = await service.remakes('1')
    expect(repeticiones.map((r) => r.id)).toEqual([hijo2.id, hijo1.id])
    expect(repeticiones.some((r) => r.id === nieto.id)).toBe(false)
  })

  it('un trabajo sin repeticiones devuelve la lista vacía', async () => {
    const service = servicioCon(completo({ id: '1', status: 'terminado' }))
    expect(await service.remakes('1')).toEqual([])
  })

  it('un trabajo inexistente lanza CaseNotFoundError', async () => {
    const service = servicioCon(completo({ id: '1', status: 'terminado' }))
    await expect(service.remakes('nope')).rejects.toBeInstanceOf(CaseNotFoundError)
  })
})

// T11 (#68): resumen del día por vista. La garantía de que cada contador coincide con el
// `total` de su lista real es el test de integración contra Postgres (`cases.test.ts`); estos
// prueban la orquestación (el servicio delega en `cases.summary(today)`).
describe('resumen del día', () => {
  it('cuenta cada vista con la misma definición que la lista', async () => {
    const service = servicioParaResumen(
      [
        completo({ id: '1', status: 'nuevo', dueDate: null }),
        completo({ id: '2', status: 'en_proceso', promisedDate: '2026-09-18', dueDate: null }),
        completo({ id: '3', status: 'en_proceso', promisedDate: '2026-09-10', dueDate: null }),
        completo({ id: '4', status: 'en_prueba', dueDate: null }),
        completo({ id: '5', status: 'terminado', dueDate: null }),
        completo({ id: '6', status: 'cancelado', dueDate: null }),
      ],
      '2026-09-18',
    )
    const r = await service.summary()
    expect(r).toMatchObject({ nuevos: 1, vencen_hoy: 1, atrasados: 1, en_prueba: 1, listos: 1 })
  })

  it('los cancelados no cuentan en ninguna vista salvo todos', async () => {
    const service = servicioParaResumen(
      [completo({ id: '6', status: 'cancelado', dueDate: null })],
      '2026-09-18',
    )
    const r = await service.summary()
    expect(r.en_curso).toBe(0)
    expect(r.todos).toBe(1)
  })

  // CAL-2 (#80) y UX4-04: «vencen mañana» es `hoy < fecha ≤ siguiente día hábil` (ADR 30).
  // '2026-09-18' es viernes: entran el sábado 19 y el lunes 21, no hoy ni el martes 22.
  it('"vencen mañana" llega hasta el siguiente día hábil, incluido el fin de semana', async () => {
    const service = servicioParaResumen(
      [
        completo({ id: '1', status: 'en_proceso', promisedDate: '2026-09-21', dueDate: null }),
        completo({ id: '2', status: 'en_proceso', promisedDate: '2026-09-19', dueDate: null }),
        completo({ id: '3', status: 'terminado', promisedDate: '2026-09-21', dueDate: null }),
        completo({ id: '4', status: 'en_proceso', promisedDate: '2026-09-18', dueDate: null }),
        completo({ id: '5', status: 'en_proceso', promisedDate: '2026-09-22', dueDate: null }),
      ],
      '2026-09-18',
    )
    const r = await service.summary()
    expect(r.vencen_manana).toBe(2)
  })

  it('"vencen mañana" el domingo solo cuenta el lunes', async () => {
    const service = servicioParaResumen(
      [
        completo({ id: '1', status: 'en_proceso', promisedDate: '2026-09-21', dueDate: null }),
        completo({ id: '2', status: 'en_proceso', promisedDate: '2026-09-19', dueDate: null }),
        completo({ id: '3', status: 'en_proceso', promisedDate: '2026-09-20', dueDate: null }),
      ],
      '2026-09-20',
    )
    const r = await service.summary()
    expect(r.vencen_manana).toBe(1)
  })
})

// Iteración 4, Tarea 3 (ENT-1, ENT-2): programar la recogida al crear el trabajo y recibirlo.
describe('recogida', () => {
  const mario = { id: 'u3', name: 'Mario Mensajero' }
  const luis = { id: 'u4', name: 'Luis Mensajero' }
  const otroMensajero = { userId: 'u4', role: 'mensajero' } as const
  const recepcion = { userId: 'u5', role: 'recepcion' } as const
  const recogida = { mensajeroId: 'u3', fecha: '2026-10-05' }

  /** Reloj fijo en el sábado 2026-10-03; mensajeros activos Mario (u3) y Luis (u4). */
  function servicioConRecogida(seed: CaseDetail[] = [], deliveries = fakeDeliveryLog()) {
    const { repo, rows, events } = fakeCasesRepo(seed)
    const service = createCasesService({
      cases: repo,
      attachments: fakeAttachmentsQuery(true),
      stages: fakeStagesQuery(),
      users: fakeUsersQuery(),
      couriers: fakeCouriersLookup([mario, luis]),
      deliveries: deliveries.log,
      uow: fakeUow(repo, fakeTryins(), deliveries.log),
      clock: fixedClock('2026-10-03'),
    })
    return { service, rows, events, deliveries }
  }

  /** Un trabajo por recoger con su recogida pendiente asignada a Mario. */
  function porRecogerDeMario() {
    return servicioConRecogida(
      [completo({ id: '1', status: 'por_recoger' })],
      fakeDeliveryLog([
        {
          id: 'd1',
          caseId: '1',
          type: 'recogida',
          courierId: 'u3',
          scheduledFor: '2026-10-03',
          status: 'pendiente',
          doneAt: null,
          proofAttachmentId: null,
        },
      ]),
    )
  }

  it('crear con recogida deja el trabajo por recoger, la recogida pendiente y sus dos eventos', async () => {
    const { service, deliveries } = servicioConRecogida()
    const c = await service.create(caseInputFixture({ recogida }), admin)
    expect(c.status).toBe('por_recoger')
    expect([...deliveries.rows.values()]).toEqual([
      {
        id: 'd1',
        caseId: c.id,
        type: 'recogida',
        courierId: 'u3',
        scheduledFor: '2026-10-05',
        status: 'pendiente',
        doneAt: null,
        proofAttachmentId: null,
      },
    ])
    const eventos = await service.events(c.id, admin)
    expect(eventos.map((e) => e.type)).toEqual(['created', 'pickup_scheduled'])
    // El historial muestra nombres: el motivo del evento es el nombre del mensajero.
    expect(eventos[1]).toMatchObject({
      toValue: '2026-10-05',
      reason: 'Mario Mensajero',
      actorId: 'u1',
    })
  })

  it('crear sin recogida deja el trabajo en nuevo y no programa ninguna entrega', async () => {
    const { service, deliveries } = servicioConRecogida()
    const c = await service.create(caseInputFixture(), admin)
    expect(c.status).toBe('nuevo')
    expect(deliveries.rows.size).toBe(0)
  })

  it('una recogida para hoy se acepta', async () => {
    const { service } = servicioConRecogida()
    const c = await service.create(
      caseInputFixture({ recogida: { mensajeroId: 'u3', fecha: '2026-10-03' } }),
      admin,
    )
    expect(c.status).toBe('por_recoger')
  })

  it('una recogida con fecha de ayer lanza CaseInputError y no crea nada', async () => {
    const { service, rows, deliveries } = servicioConRecogida()
    const error = await service
      .create(caseInputFixture({ recogida: { mensajeroId: 'u3', fecha: '2026-10-02' } }), admin)
      .catch((e: unknown) => e)
    expect(error).toBeInstanceOf(CaseInputError)
    expect(error).toMatchObject({
      message: 'La fecha de recogida no puede ser anterior a hoy.',
      path: 'recogida.fecha',
    })
    expect(rows.size).toBe(0)
    expect(deliveries.rows.size).toBe(0)
  })

  it('un mensajero inexistente o que no es mensajero activo lanza CaseInputError', async () => {
    const { service, rows } = servicioConRecogida()
    for (const mensajeroId of ['no-existe', 'u2']) {
      const error = await service
        .create(caseInputFixture({ recogida: { mensajeroId, fecha: '2026-10-05' } }), admin)
        .catch((e: unknown) => e)
      expect(error).toBeInstanceOf(CaseInputError)
      expect(error).toMatchObject({
        message: 'Elige un mensajero activo.',
        path: 'recogida.mensajeroId',
      })
    }
    expect(rows.size).toBe(0)
  })

  // UX4-10 (Nelson, 2026-10-04): «Recibido» lo marca recepción al llegar al laboratorio.
  it('el mensajero no recibe ni su propia recogida: la recogida sigue pendiente', async () => {
    const { service, rows, deliveries } = porRecogerDeMario()
    await expect(
      service.action('1', { accion: 'recibir', motivo: null }, mensajero),
    ).rejects.toBeInstanceOf(CaseForbiddenError)
    expect(rows.get('1')!.status).toBe('por_recoger')
    expect(deliveries.rows.get('d1')!.status).toBe('pendiente')
  })

  it('recepción recibe: el trabajo pasa a nuevo, la recogida queda hecha y hay evento received', async () => {
    const { service, deliveries } = porRecogerDeMario()
    const c = await service.action('1', { accion: 'recibir', motivo: null }, recepcion)
    expect(c.status).toBe('nuevo')
    expect(deliveries.rows.get('d1')).toMatchObject({
      status: 'hecha',
      doneAt: new Date('2026-10-03T12:00:00Z'),
      proofAttachmentId: null,
    })
    const eventos = await service.events('1', admin)
    expect(eventos.at(-1)).toMatchObject({
      type: 'received',
      fromValue: 'por_recoger',
      toValue: 'nuevo',
      actorId: recepcion.userId,
    })
  })

  // #118: el mensajero ya marcó «Recogido» (la recogida está hecha) y el trabajo sigue por
  // recoger; «Recibido» no la vuelve a cerrar ni duplica eventos.
  it('«Recibido» tras «Recogido» pasa a nuevo, no toca la recogida y escribe un solo received', async () => {
    const recogidaEn = new Date('2026-10-03T10:32:00Z')
    const { service, deliveries } = servicioConRecogida(
      [completo({ id: '1', status: 'por_recoger' })],
      fakeDeliveryLog([
        {
          id: 'd1',
          caseId: '1',
          type: 'recogida',
          courierId: 'u3',
          scheduledFor: '2026-10-03',
          status: 'hecha',
          doneAt: recogidaEn,
          proofAttachmentId: null,
        },
      ]),
    )
    const antes = (await service.events('1', admin)).length
    const c = await service.action('1', { accion: 'recibir', motivo: null }, recepcion)
    expect(c.status).toBe('nuevo')
    expect(deliveries.rows.get('d1')).toMatchObject({ status: 'hecha', doneAt: recogidaEn })
    const nuevos = (await service.events('1', admin)).slice(antes)
    expect(nuevos).toHaveLength(1)
    expect(nuevos[0]).toMatchObject({ type: 'received', fromValue: 'por_recoger' })
  })

  it('otro mensajero no puede recibir una recogida que no es suya', async () => {
    const { service, rows, deliveries } = porRecogerDeMario()
    await expect(
      service.action('1', { accion: 'recibir', motivo: null }, otroMensajero),
    ).rejects.toBeInstanceOf(CaseForbiddenError)
    expect(rows.get('1')!.status).toBe('por_recoger')
    expect(deliveries.rows.get('d1')!.status).toBe('pendiente')
  })

  it('recepción recibe la recogida de cualquier mensajero', async () => {
    const { service, deliveries } = porRecogerDeMario()
    const c = await service.action('1', { accion: 'recibir', motivo: null }, recepcion)
    expect(c.status).toBe('nuevo')
    expect(deliveries.rows.get('d1')!.status).toBe('hecha')
  })

  it('un trabajo por recoger sin recogida pendiente (datos viejos) se recibe igual', async () => {
    const { service } = servicioConRecogida([completo({ id: '1', status: 'por_recoger' })])
    const c = await service.action('1', { accion: 'recibir', motivo: null }, recepcion)
    expect(c.status).toBe('nuevo')
  })

  it('un mensajero no recibe un trabajo por recoger que no tiene recogida pendiente', async () => {
    const { service, rows } = servicioConRecogida([completo({ id: '1', status: 'por_recoger' })])
    await expect(
      service.action('1', { accion: 'recibir', motivo: null }, mensajero),
    ).rejects.toBeInstanceOf(CaseForbiddenError)
    expect(rows.get('1')!.status).toBe('por_recoger')
  })

  it('aceptar un trabajo por recoger lanza CaseStateError con los rótulos', async () => {
    const { service } = porRecogerDeMario()
    await expect(service.action('1', { accion: 'aceptar', motivo: null }, admin)).rejects.toThrow(
      new CaseStateError(
        'No se puede "Aceptar": el trabajo está en estado "Por recoger". Puede que otra persona lo haya cambiado.',
      ),
    )
  })
})

// Iteración 4, Tarea 4 (ENT-3, ENT-4): enviar con mensajero y entregar con foto de constancia.
describe('envío y entrega', () => {
  const mario = { id: 'u3', name: 'Mario Mensajero' }
  const luis = { id: 'u4', name: 'Luis Mensajero' }
  const otroMensajero = { userId: 'u4', role: 'mensajero' } as const
  const recepcion = { userId: 'u5', role: 'recepcion' } as const
  const fotoDeEste: FakeAttachment = {
    id: 'a1',
    caseId: '1',
    mime: 'image/jpeg',
    kind: 'constancia',
  }
  const entregaDeMario = {
    id: 'd1',
    caseId: '1',
    type: 'entrega',
    courierId: 'u3',
    scheduledFor: '2026-10-03',
    status: 'pendiente',
    doneAt: null,
    proofAttachmentId: null,
  } as const

  /** Reloj fijo en el sábado 2026-10-03; mensajeros activos Mario (u3) y Luis (u4). */
  function servicioConEntrega(
    seed: CaseDetail,
    { deliveries = fakeDeliveryLog(), attachments = [fotoDeEste] } = {},
  ) {
    const { repo, rows } = fakeCasesRepo([seed])
    const service = createCasesService({
      cases: repo,
      attachments: fakeAttachmentsQuery(true, attachments),
      stages: fakeStagesQuery(),
      users: fakeUsersQuery(),
      couriers: fakeCouriersLookup([mario, luis]),
      deliveries: deliveries.log,
      uow: fakeUow(repo, fakeTryins(), deliveries.log),
      clock: fixedClock('2026-10-03'),
    })
    return { service, rows, deliveries }
  }
  const terminado = () => servicioConEntrega(completo({ id: '1', status: 'terminado' }))
  const enviadoConMario = (attachments?: FakeAttachment[]) =>
    servicioConEntrega(completo({ id: '1', status: 'enviado', total: '90.00' }), {
      deliveries: fakeDeliveryLog([entregaDeMario]),
      ...(attachments ? { attachments } : {}),
    })
  const enviar = (mensajeroId: string, fecha = '2026-10-05') => ({
    accion: 'marcar_enviado' as const,
    motivo: null,
    envio: { mensajeroId, fecha },
  })
  const entregar = (constanciaId: string) => ({
    accion: 'marcar_entregado' as const,
    motivo: null,
    constanciaId,
  })

  it('el mensajero que se asigna a sí mismo envía: queda enviado, con la entrega pendiente y el evento shipped', async () => {
    const { service, deliveries } = terminado()
    const c = await service.action('1', enviar('u3'), mensajero)
    expect(c.status).toBe('enviado')
    expect(c.shippedAt).toEqual(new Date('2026-10-03T12:00:00Z'))
    // Enmascarado: el mensajero nunca recibe dinero en la respuesta de la acción.
    expect(c.total).toBeNull()
    expect([...deliveries.rows.values()]).toEqual([
      {
        id: 'd1',
        caseId: '1',
        type: 'entrega',
        courierId: 'u3',
        scheduledFor: '2026-10-05',
        status: 'pendiente',
        doneAt: null,
        proofAttachmentId: null,
      },
    ])
    const eventos = await service.events('1', admin)
    expect(eventos.at(-1)).toMatchObject({
      type: 'shipped',
      fromValue: 'terminado',
      toValue: '2026-10-05',
      reason: 'Mario Mensajero',
      actorId: 'u3',
    })
  })

  it('un envío para hoy se acepta', async () => {
    const { service } = terminado()
    const c = await service.action('1', enviar('u3', '2026-10-03'), admin)
    expect(c.status).toBe('enviado')
  })

  it('recepción envía con cualquier mensajero activo', async () => {
    const { service, deliveries } = terminado()
    const c = await service.action('1', enviar('u4'), recepcion)
    expect(c.status).toBe('enviado')
    expect(deliveries.rows.get('d1')!.courierId).toBe('u4')
  })

  it('un mensajero no puede asignar el envío a otro mensajero', async () => {
    const { service, rows, deliveries } = terminado()
    await expect(service.action('1', enviar('u4'), mensajero)).rejects.toBeInstanceOf(
      CaseForbiddenError,
    )
    expect(rows.get('1')!.status).toBe('terminado')
    expect(deliveries.rows.size).toBe(0)
  })

  it('un envío con fecha de ayer lanza CaseInputError y no cambia nada', async () => {
    const { service, rows, deliveries } = terminado()
    const error = await service
      .action('1', enviar('u3', '2026-10-02'), admin)
      .catch((e: unknown) => e)
    expect(error).toBeInstanceOf(CaseInputError)
    expect(error).toMatchObject({
      message: 'La fecha de entrega no puede ser anterior a hoy.',
      path: 'envio.fecha',
    })
    expect(rows.get('1')!.status).toBe('terminado')
    expect(deliveries.rows.size).toBe(0)
  })

  it('un envío con alguien que no es mensajero activo lanza CaseInputError', async () => {
    const { service, rows } = terminado()
    const error = await service.action('1', enviar('u2'), admin).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(CaseInputError)
    expect(error).toMatchObject({
      message: 'Elige un mensajero activo.',
      path: 'envio.mensajeroId',
    })
    expect(rows.get('1')!.status).toBe('terminado')
  })

  it('marcar enviado sin envío lanza CaseInputError en envio', async () => {
    const { service } = terminado()
    await expect(
      service.action('1', { accion: 'marcar_enviado', motivo: null }, admin),
    ).rejects.toMatchObject({ message: 'Elige mensajero y fecha', path: 'envio' })
  })

  it('el mensajero asignado entrega con su foto: queda entregado, la entrega hecha y el evento delivered', async () => {
    const { service, deliveries } = enviadoConMario()
    const c = await service.action('1', entregar('a1'), mensajero)
    expect(c.status).toBe('entregado')
    expect(c.deliveredAt).toEqual(new Date('2026-10-03T12:00:00Z'))
    // Con algo que cobrar, no se cobra al entregar.
    expect(c.paidAt).toBeNull()
    expect(c.total).toBeNull()
    expect(deliveries.rows.get('d1')).toMatchObject({
      status: 'hecha',
      doneAt: new Date('2026-10-03T12:00:00Z'),
      proofAttachmentId: 'a1',
    })
    const eventos = await service.events('1', admin)
    expect(eventos.at(-1)).toMatchObject({
      type: 'delivered',
      fromValue: 'enviado',
      toValue: 'a1',
      actorId: 'u3',
    })
  })

  describe('sin nada que cobrar, queda cobrado al entregarlo (decisión 5 de la Iteración 5)', () => {
    const NOW = new Date('2026-10-03T12:00:00Z')
    const enviadoCon = (over: Partial<CaseDetail>) =>
      servicioConEntrega(completo({ id: '1', status: 'enviado', total: '90.00', ...over }), {
        deliveries: fakeDeliveryLog([entregaDeMario]),
      })

    it('una repetición al 0 %: cobrado con delivered_at y paid_at, y los eventos delivered y status_changed en ese orden', async () => {
      const { service, rows, deliveries } = enviadoCon({
        parentCaseId: 'p',
        remakeChargePct: '0.00',
      })
      const c = await service.action('1', entregar('a1'), mensajero)
      expect(c.status).toBe('cobrado')
      expect(rows.get('1')).toMatchObject({ status: 'cobrado', deliveredAt: NOW, paidAt: NOW })
      expect(deliveries.rows.get('d1')).toMatchObject({ status: 'hecha', proofAttachmentId: 'a1' })
      const eventos = await service.events('1', admin)
      expect(eventos.slice(-2)).toEqual([
        expect.objectContaining({
          type: 'delivered',
          fromValue: 'enviado',
          toValue: 'a1',
          actorId: 'u3',
        }),
        expect.objectContaining({
          type: 'status_changed',
          fromValue: 'entregado',
          toValue: 'cobrado',
          reason: null,
          actorId: 'u3',
        }),
      ])
    })

    it('un trabajo que vale 0.00 también queda cobrado', async () => {
      const { service } = enviadoCon({ total: '0.00' })
      const c = await service.action('1', entregar('a1'), admin)
      expect(c).toMatchObject({ status: 'cobrado', paidAt: NOW })
    })

    it('una repetición al 50 % queda entregada, sin paid_at ni status_changed', async () => {
      const { service } = enviadoCon({ parentCaseId: 'p', remakeChargePct: '50.00' })
      const c = await service.action('1', entregar('a1'), admin)
      expect(c).toMatchObject({ status: 'entregado', paidAt: null })
      expect((await service.events('1', admin)).at(-1)).toMatchObject({ type: 'delivered' })
    })
  })

  it('otro mensajero no puede entregar una entrega que no es suya', async () => {
    const { service, rows, deliveries } = enviadoConMario()
    await expect(service.action('1', entregar('a1'), otroMensajero)).rejects.toBeInstanceOf(
      CaseForbiddenError,
    )
    expect(rows.get('1')!.status).toBe('enviado')
    expect(deliveries.rows.get('d1')!.status).toBe('pendiente')
  })

  it('recepción entrega la entrega de cualquier mensajero', async () => {
    const { service, deliveries } = enviadoConMario()
    const c = await service.action('1', entregar('a1'), recepcion)
    expect(c.status).toBe('entregado')
    expect(deliveries.rows.get('d1')).toMatchObject({ status: 'hecha', proofAttachmentId: 'a1' })
  })

  it('un trabajo enviado sin entrega pendiente (datos viejos) se entrega igual y guarda la constancia en el evento', async () => {
    const { service } = servicioConEntrega(completo({ id: '1', status: 'enviado' }))
    const c = await service.action('1', entregar('a1'), recepcion)
    expect(c.status).toBe('entregado')
    const eventos = await service.events('1', admin)
    expect(eventos.at(-1)).toMatchObject({ type: 'delivered', toValue: 'a1' })
  })

  it('un mensajero no entrega un trabajo enviado que no tiene entrega pendiente', async () => {
    const { service, rows } = servicioConEntrega(completo({ id: '1', status: 'enviado' }))
    await expect(service.action('1', entregar('a1'), mensajero)).rejects.toBeInstanceOf(
      CaseForbiddenError,
    )
    expect(rows.get('1')!.status).toBe('enviado')
  })

  it('otro mensajero con una constancia que no es de este trabajo recibe 403, no 422: el permiso va antes que los datos', async () => {
    const { service, rows } = enviadoConMario([{ ...fotoDeEste, id: 'a2', caseId: '2' }])
    await expect(service.action('1', entregar('a2'), otroMensajero)).rejects.toBeInstanceOf(
      CaseForbiddenError,
    )
    expect(rows.get('1')!.status).toBe('enviado')
  })

  it('marcar entregado sin constancia lanza CaseInputError en constanciaId', async () => {
    const { service } = enviadoConMario()
    await expect(
      service.action('1', { accion: 'marcar_entregado', motivo: null }, admin),
    ).rejects.toMatchObject({ message: 'Añade la foto de constancia', path: 'constanciaId' })
  })

  it.each([
    ['inexistente', 'a9', [fotoDeEste]],
    ['de otro trabajo', 'a2', [{ ...fotoDeEste, id: 'a2', caseId: '2' }]],
    [
      'que es un PDF de tipo documento',
      'a3',
      [{ ...fotoDeEste, id: 'a3', mime: 'application/pdf', kind: 'document' }],
    ],
    ['que es una foto normal', 'a4', [{ ...fotoDeEste, id: 'a4', kind: 'photo' }]],
    ['que no es una imagen', 'a5', [{ ...fotoDeEste, id: 'a5', mime: 'application/pdf' }]],
  ] as [string, string, FakeAttachment[]][])(
    'una constancia %s se rechaza con el mensaje literal y no entrega',
    async (_caso, constanciaId, attachments) => {
      const { service, rows, deliveries } = enviadoConMario(attachments)
      const error = await service
        .action('1', entregar(constanciaId), admin)
        .catch((e: unknown) => e)
      expect(error).toBeInstanceOf(CaseInputError)
      expect(error).toMatchObject({
        message: 'La foto de constancia no es de este trabajo.',
        path: 'constanciaId',
      })
      expect(rows.get('1')!.status).toBe('enviado')
      expect(deliveries.rows.get('d1')!.status).toBe('pendiente')
    },
  )

  // M-2: la constancia existía al leerla, pero se borró antes de ligarla a la entrega. El
  // adaptador lo dice con `DeliveryProofMissingError` y el servicio responde como a una
  // constancia inválida (422), no con un error sin traducir (500).
  it('si la constancia desaparece al ligarla, lanza CaseInputError en constanciaId', async () => {
    const deliveries = fakeDeliveryLog([entregaDeMario])
    deliveries.log.markDone = () => Promise.reject(new DeliveryProofMissingError())
    const { service, rows } = servicioConEntrega(
      completo({ id: '1', status: 'enviado', total: '90.00' }),
      { deliveries },
    )
    const error = await service.action('1', entregar('a1'), admin).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(CaseInputError)
    expect(error).toMatchObject({
      message: 'La foto de constancia no es de este trabajo.',
      path: 'constanciaId',
    })
    expect(rows.get('1')!.status).toBe('enviado')
  })
})

// Revisión final del PR 1 de la Iteración 4 (I-1): cancelar un trabajo cierra su recogida o
// su entrega pendiente; si no, quedaría «pendiente» para siempre en la lista del mensajero.
describe('cancelar cierra la entrega pendiente', () => {
  const pendiente = (id: string, caseId: string, type: 'recogida' | 'entrega') =>
    ({
      id,
      caseId,
      type,
      courierId: 'u3',
      scheduledFor: '2026-10-03',
      status: 'pendiente',
      doneAt: null,
      proofAttachmentId: null,
    }) as const

  function servicioConPendientes(status: CaseStatus, seed: ReturnType<typeof pendiente>[]) {
    const { repo, rows } = fakeCasesRepo([completo({ id: '1', status })])
    const deliveries = fakeDeliveryLog(seed)
    const service = createCasesService({
      cases: repo,
      attachments: fakeAttachmentsQuery(true),
      stages: fakeStagesQuery(),
      users: fakeUsersQuery(),
      couriers: fakeCouriersLookup(),
      deliveries: deliveries.log,
      uow: fakeUow(repo, fakeTryins(), deliveries.log),
      clock: fixedClock('2026-10-03'),
    })
    return { service, rows, deliveries }
  }
  const cancelar = { accion: 'cancelar' as const, motivo: 'La clínica lo anuló' }

  it('cancelar un trabajo por recoger cierra su recogida pendiente con el motivo', async () => {
    const { service, deliveries } = servicioConPendientes('por_recoger', [
      pendiente('d1', '1', 'recogida'),
    ])
    const c = await service.action('1', cancelar, admin)
    expect(c.status).toBe('cancelado')
    expect(deliveries.rows.get('d1')).toMatchObject({
      status: 'fallida',
      failedReason: 'Trabajo cancelado: La clínica lo anuló',
      doneAt: new Date('2026-10-03T12:00:00Z'),
    })
  })

  it('cancelar un trabajo enviado cierra su entrega pendiente con el motivo', async () => {
    const { service, deliveries } = servicioConPendientes('enviado', [
      pendiente('d1', '1', 'entrega'),
    ])
    await service.action('1', cancelar, recepcionCtx)
    expect(deliveries.rows.get('d1')).toMatchObject({
      status: 'fallida',
      failedReason: 'Trabajo cancelado: La clínica lo anuló',
    })
  })

  it('cancelar un trabajo en proceso no toca las entregas de otros trabajos', async () => {
    const { service, rows, deliveries } = servicioConPendientes('en_proceso', [
      pendiente('d1', '2', 'recogida'),
      pendiente('d2', '2', 'entrega'),
    ])
    await service.action('1', cancelar, admin)
    expect(rows.get('1')!.status).toBe('cancelado')
    expect([...deliveries.rows.values()].map((d) => d.status)).toEqual(['pendiente', 'pendiente'])
  })
})

// I-1 de la revisión final del PR 2: entre que la acción lee la entrega pendiente y la cierra,
// otra persona la cerró («No se pudo» a la vez). El cierre condicional devuelve `false` y la
// acción responde 409 con el literal de `shared`, sin cambiar el estado del trabajo.
describe('la entrega la cerró otra persona a la vez', () => {
  const MENSAJE = 'La entrega ya no está pendiente. Puede que otra persona la haya cerrado.'
  const foto: FakeAttachment = { id: 'a1', caseId: '1', mime: 'image/jpeg', kind: 'constancia' }

  /** `pendingFor` encuentra la pendiente, pero justo después otra transacción la cierra. */
  function servicioConCarrera(status: CaseStatus, type: 'recogida' | 'entrega') {
    const { repo, rows } = fakeCasesRepo([completo({ id: '1', status })])
    const deliveries = fakeDeliveryLog([
      {
        id: 'd1',
        caseId: '1',
        type,
        courierId: 'u3',
        scheduledFor: '2026-10-03',
        status: 'pendiente',
        doneAt: null,
        proofAttachmentId: null,
      },
    ])
    const log = {
      ...deliveries.log,
      async pendingFor(caseId: string, t: 'recogida' | 'entrega') {
        const found = await deliveries.log.pendingFor(caseId, t)
        if (found) {
          deliveries.rows.set(found.id, {
            ...deliveries.rows.get(found.id)!,
            status: 'fallida',
            failedReason: 'No había nadie',
          })
        }
        return found
      },
    }
    const service = createCasesService({
      cases: repo,
      attachments: fakeAttachmentsQuery(true, [foto]),
      stages: fakeStagesQuery(),
      users: fakeUsersQuery(),
      couriers: fakeCouriersLookup(),
      deliveries: log,
      uow: fakeUow(repo, fakeTryins(), log),
      clock: fixedClock('2026-10-03'),
    })
    return { service, rows, deliveries }
  }

  it('recibir responde 409 y el trabajo sigue por recoger', async () => {
    const { service, rows, deliveries } = servicioConCarrera('por_recoger', 'recogida')
    const error = await service
      .action('1', { accion: 'recibir', motivo: null }, admin)
      .catch((e: unknown) => e)
    expect(error).toBeInstanceOf(CaseStateError)
    expect(error).toMatchObject({ message: MENSAJE })
    expect(rows.get('1')!.status).toBe('por_recoger')
    expect(deliveries.rows.get('d1')!.status).toBe('fallida')
  })

  it('marcar entregado responde 409 y el trabajo sigue enviado', async () => {
    const { service, rows, deliveries } = servicioConCarrera('enviado', 'entrega')
    const error = await service
      .action('1', { accion: 'marcar_entregado', motivo: null, constanciaId: 'a1' }, admin)
      .catch((e: unknown) => e)
    expect(error).toBeInstanceOf(CaseStateError)
    expect(error).toMatchObject({ message: MENSAJE })
    expect(rows.get('1')!.status).toBe('enviado')
    expect(deliveries.rows.get('d1')).toMatchObject({ status: 'fallida', proofAttachmentId: null })
  })

  it('cancelar responde 409 y el trabajo sigue enviado', async () => {
    const { service, rows, deliveries } = servicioConCarrera('enviado', 'entrega')
    const error = await service
      .action('1', { accion: 'cancelar', motivo: 'La clínica lo anuló' }, admin)
      .catch((e: unknown) => e)
    expect(error).toBeInstanceOf(CaseStateError)
    expect(error).toMatchObject({ message: MENSAJE })
    expect(rows.get('1')!.status).toBe('enviado')
    expect(deliveries.rows.get('d1')!.failedReason).toBe('No había nadie')
  })
})

// M-4 (revisión final del PR 1 de la Iteración 4): la ficha dice qué entrega está pendiente y
// de qué mensajero, para que la web no le muestre a un mensajero la acción de una entrega
// ajena (la API la rechazaría con 403). El id del mensajero no es un dato sensible.
describe('entrega pendiente en el detalle', () => {
  const entrega = (
    type: 'recogida' | 'entrega',
    status: 'pendiente' | 'hecha' | 'fallida',
    courierId = 'u3',
    extra: { id?: string; doneAt?: Date | null; proofAttachmentId?: string | null } = {},
  ) => ({
    id: extra.id ?? `d-${type}-${status}`,
    caseId: '1',
    type,
    courierId,
    scheduledFor: '2026-10-03',
    status,
    doneAt: extra.doneAt ?? null,
    proofAttachmentId: extra.proofAttachmentId ?? null,
  })
  const nombres = { u3: 'Mario Mensajero', u9: 'Luis Mensajero' }

  function servicio(status: CaseStatus, seed: ReturnType<typeof entrega>[]) {
    const { repo } = fakeCasesRepo([completo({ id: '1', code: '26-00042', status })])
    const deliveries = fakeDeliveryLog(seed, nombres)
    return createCasesService({
      cases: repo,
      attachments: fakeAttachmentsQuery(true),
      stages: fakeStagesQuery(),
      users: fakeUsersQuery(),
      couriers: fakeCouriersLookup(),
      deliveries: deliveries.log,
      uow: fakeUow(repo, fakeTryins(), deliveries.log),
      clock: fixedClock('2026-10-03'),
    })
  }

  // UX4-07: la ficha corta del mensajero dice para qué día y con quién, no solo el id.
  it('un trabajo por recoger trae su recogida pendiente con mensajero y fecha', async () => {
    const service = servicio('por_recoger', [entrega('recogida', 'pendiente', 'u9')])
    const { case: found } = await service.detail('1', mensajero)
    // #118: con su id, para que la ficha corta marque «Recogido» sobre esa recogida.
    expect(found.pendingDelivery).toEqual({
      id: 'd-recogida-pendiente',
      type: 'recogida',
      courierId: 'u9',
      courierName: 'Luis Mensajero',
      scheduledFor: '2026-10-03',
    })
  })

  it('la ficha corta por código trae la entrega pendiente de un trabajo enviado', async () => {
    const service = servicio('enviado', [
      entrega('entrega', 'fallida'),
      entrega('entrega', 'pendiente', 'u3'),
    ])
    const { case: found } = await service.detailByCode('26-00042', mensajero)
    expect(found.pendingDelivery).toEqual({
      id: 'd-entrega-pendiente',
      type: 'entrega',
      courierId: 'u3',
      courierName: 'Mario Mensajero',
      scheduledFor: '2026-10-03',
    })
  })

  it('sin entrega pendiente trae null aunque haya entregas cerradas', async () => {
    const service = servicio('entregado', [entrega('entrega', 'hecha')])
    const { case: found } = await service.detail('1', admin)
    expect(found.pendingDelivery).toBeNull()
  })

  // UX4-09: «Entregado el 04/10 por … · Ver constancia».
  it('un trabajo entregado trae la última entrega hecha con mensajero y constancia', async () => {
    const service = servicio('entregado', [
      entrega('entrega', 'hecha', 'u9', {
        id: 'vieja',
        doneAt: new Date('2026-10-01T15:00:00Z'),
        proofAttachmentId: 'a1',
      }),
      entrega('entrega', 'hecha', 'u3', {
        id: 'nueva',
        doneAt: new Date('2026-10-03T16:30:00Z'),
        proofAttachmentId: 'a2',
      }),
      entrega('recogida', 'hecha', 'u9', {
        id: 'recogida',
        doneAt: new Date('2026-10-04T10:00:00Z'),
      }),
    ])
    const { case: found } = await service.detail('1', mensajero)
    expect(found.lastDelivered).toEqual({
      doneAt: '2026-10-03T16:30:00.000Z',
      courierName: 'Mario Mensajero',
      proofAttachmentId: 'a2',
    })
  })

  it('sin entrega hecha la última entrega es null (una recogida hecha no cuenta)', async () => {
    const service = servicio('nuevo', [
      entrega('recogida', 'hecha', 'u9', { doneAt: new Date('2026-10-02T10:00:00Z') }),
      entrega('entrega', 'fallida'),
    ])
    const { case: found } = await service.detail('1', admin)
    expect(found.lastDelivered).toBeNull()
  })

  // #118: «En camino al laboratorio · Recogido por … a las …».
  it('un trabajo recogido trae la última recogida hecha con su mensajero (detalle y ficha corta)', async () => {
    const service = servicio('por_recoger', [
      entrega('recogida', 'fallida', 'u3', {
        id: 'fallida',
        doneAt: new Date('2026-10-04T09:00:00Z'),
      }),
      entrega('recogida', 'hecha', 'u3', {
        id: 'vieja',
        doneAt: new Date('2026-10-01T10:00:00Z'),
      }),
      entrega('recogida', 'hecha', 'u9', {
        id: 'nueva',
        doneAt: new Date('2026-10-03T15:32:00Z'),
      }),
      entrega('entrega', 'hecha', 'u3', {
        id: 'entrega',
        doneAt: new Date('2026-10-05T10:00:00Z'),
      }),
    ])
    const esperado = { doneAt: '2026-10-03T15:32:00.000Z', courierName: 'Luis Mensajero' }
    expect((await service.detail('1', recepcionCtx)).case.lastPickedUp).toEqual(esperado)
    expect((await service.detailByCode('26-00042', mensajero)).case.lastPickedUp).toEqual(esperado)
  })

  it('sin recogida hecha la última recogida es null (una entrega hecha no cuenta)', async () => {
    const service = servicio('por_recoger', [
      entrega('recogida', 'pendiente'),
      entrega('entrega', 'hecha', 'u3', { doneAt: new Date('2026-10-02T10:00:00Z') }),
    ])
    expect((await service.detail('1', admin)).case.lastPickedUp).toBeNull()
  })

  // UX4-07: la ficha corta lleva al mensajero a la clínica (mapa y llamada).
  it('la clínica del detalle trae dirección y teléfono', async () => {
    const service = servicio('enviado', [])
    const { case: found } = await service.detail('1', mensajero)
    expect(found.clinic).toEqual({
      id: expect.any(String),
      name: 'Sonrisa',
      address: 'Av. Amazonas N34-12',
      city: 'Quito',
      phone: '02 255 1234',
    })
  })

  it('el mensajero sigue sin ver dinero con la entrega en el detalle', async () => {
    const service = servicio('enviado', [entrega('entrega', 'pendiente', 'u3')])
    const { case: found } = await service.detail('1', mensajero)
    expect(found.total).toBeNull()
    expect(found.remakeChargePct).toBeNull()
    expect(found.items.every((i) => i.unitPrice === null && i.lineTotal === null)).toBe(true)
  })
})
