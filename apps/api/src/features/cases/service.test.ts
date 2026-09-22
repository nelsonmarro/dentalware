import type { CaseStatus, RemakeInput } from '@dentalware/shared'
import { describe, expect, it } from 'vitest'
import { CaseForbiddenError, CaseInputError, CaseNotFoundError, CaseStateError } from './errors.ts'
import {
  caseDetailFixture,
  caseInputFixture,
  fakeCasesRepo,
  fakeStagesQuery,
  fakeTryins,
  fakeUow,
  fakeUsersQuery,
  fixedClock,
} from './fakes.ts'
import type { CaseDetail } from './ports.ts'
import { createCasesService, stripPrices } from './service.ts'

const admin = { userId: 'u1', role: 'admin' } as const
const tecnico = { userId: 'u2', role: 'tecnico' } as const
const mensajero = { userId: 'u3', role: 'mensajero' } as const

/** Alias descriptivo: una ficha completa (todos los campos que `aceptar` exige), lista para
 * las pruebas de acciones de estado. */
const completo = caseDetailFixture

function build(seed = [caseDetailFixture()], hasDocument = false) {
  const { repo, events, lastListQuery } = fakeCasesRepo(seed)
  // `tryins` no es dependencia del servicio (ver M-1): solo lo necesita `uow.run` para
  // recrear los repos de la transacción, igual que hace `drizzleUnitOfWork` con `tx`.
  const service = createCasesService({
    cases: repo,
    attachments: { hasDocument: async () => hasDocument },
    stages: fakeStagesQuery(),
    users: fakeUsersQuery(),
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
  } = {},
) {
  const { repo } = fakeCasesRepo([seed])
  const tryins = overrides.tryins ?? fakeTryins()
  return createCasesService({
    cases: repo,
    attachments: { hasDocument: async () => overrides.hasDocument ?? true },
    stages: fakeStagesQuery(),
    users: fakeUsersQuery(),
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
    attachments: { hasDocument: async () => true },
    stages: fakeStagesQuery(stages),
    users: fakeUsersQuery(),
    uow: fakeUow(repo, fakeTryins()),
    clock: fixedClock(),
  })
}

/** Servicio listo para probar `assignTechnician(...)`: técnicos activos `technicians` y un
 * trabajo `1` con los overrides dados. */
function servicioConTecnicos(technicians: { id: string }[], overrides: Partial<CaseDetail>) {
  const { repo } = fakeCasesRepo([caseDetailFixture({ id: '1', ...overrides })])
  return createCasesService({
    cases: repo,
    attachments: { hasDocument: async () => true },
    stages: fakeStagesQuery(),
    users: fakeUsersQuery(technicians),
    uow: fakeUow(repo, fakeTryins()),
    clock: fixedClock(),
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

  it('comentar registra un evento comment y devuelve ese evento', async () => {
    const { service } = build()
    const e = await service.comment('c1', 'Hola', admin)
    expect(e).toMatchObject({ type: 'comment', toValue: 'Hola' })
  })

  it('comentar en un trabajo inexistente lanza CaseNotFoundError', async () => {
    const { service } = build([])
    await expect(service.comment('nope', 'Hola', admin)).rejects.toBeInstanceOf(CaseNotFoundError)
  })

  it('stripPrices anula precios y totales', () => {
    const s = stripPrices({
      total: '10.00',
      internalNotes: 'nota',
      items: [{ unitPrice: '1.00', lineTotal: '1.00', discountPct: '0.00', quantity: 1 }],
    })
    expect(s.total).toBeNull()
    expect(s.internalNotes).toBeNull()
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
      attachments: { hasDocument: async () => true },
      stages: fakeStagesQuery([{ id: 'f1', sort: 1, active: true }]),
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

  it('marcar_enviado fija shippedAt y marcar_entregado fija deliveredAt', async () => {
    const service = servicioCon(completo({ id: '1', status: 'terminado' }))
    await service.action('1', { accion: 'marcar_enviado', motivo: null }, admin)
    const enviado = (await service.detail('1', admin)).case
    expect(enviado.status).toBe('enviado')
    expect(enviado.shippedAt).not.toBeNull()

    await service.action('1', { accion: 'marcar_entregado', motivo: null }, admin)
    const entregado = (await service.detail('1', admin)).case
    expect(entregado.status).toBe('entregado')
    expect(entregado.deliveredAt).not.toBeNull()
  })

  it('cada acción escribe el tipo de evento y el estado antes/después que le corresponden', async () => {
    const tryins = fakeTryins()
    const service = servicioCon(completo({ id: '1', status: 'nuevo' }), { tryins })

    await service.action('1', { accion: 'aceptar', motivo: null }, admin)
    await service.action('1', { accion: 'enviar_prueba', motivo: null }, admin)
    await service.action('1', { accion: 'recibir_prueba', motivo: null }, admin)
    await service.action('1', { accion: 'finalizar', motivo: null }, admin)
    await service.action('1', { accion: 'marcar_enviado', motivo: null }, admin)
    await service.action('1', { accion: 'marcar_entregado', motivo: null }, admin)

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
    expect(eventos[4]).toMatchObject({ fromValue: 'terminado', toValue: 'enviado' })
    expect(eventos[5]).toMatchObject({ fromValue: 'enviado', toValue: 'entregado' })
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
    ).rejects.toThrow(CaseStateError)
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
    ).rejects.toThrow(CaseStateError)
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
})
