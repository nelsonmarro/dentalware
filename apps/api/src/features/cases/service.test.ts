import { describe, expect, it } from 'vitest'
import { CaseForbiddenError, CaseInputError, CaseNotFoundError, CaseStateError } from './errors.ts'
import {
  caseDetailFixture,
  caseInputFixture,
  fakeCasesRepo,
  fakeStagesQuery,
  fakeTryins,
  fakeUow,
  fixedClock,
} from './fakes.ts'
import type { CaseDetail } from './ports.ts'
import { createCasesService, stripPrices } from './service.ts'

const admin = { userId: 'u1', role: 'admin' } as const
const tecnico = { userId: 'u2', role: 'tecnico' } as const

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
    uow: fakeUow(repo, tryins),
    clock: fixedClock('2026-09-18'),
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
