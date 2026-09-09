import { describe, expect, it } from 'vitest'
import { CaseNotFoundError, CaseStateError } from './errors.ts'
import { caseDetailFixture, caseInputFixture, fakeCasesRepo, fakeUow, fixedClock } from './fakes.ts'
import { createCasesService, stripPrices } from './service.ts'

const admin = { userId: 'u1', role: 'admin' } as const
const tecnico = { userId: 'u2', role: 'tecnico' } as const

function build(seed = [caseDetailFixture()], hasDocument = false) {
  const { repo, events } = fakeCasesRepo(seed)
  const service = createCasesService({
    cases: repo,
    attachments: { hasDocument: async () => hasDocument },
    uow: fakeUow(repo),
    clock: fixedClock(),
  })
  return { service, repo, events }
}

describe('createCasesService', () => {
  it('la lista oculta el total a técnico y mensajero y lo muestra a admin', async () => {
    const { service } = build()
    expect((await service.list({ pagina: 1 } as never, tecnico)).cases[0]!.total).toBeNull()
    expect((await service.list({ pagina: 1 } as never, admin)).cases[0]!.total).toBe('90.00')
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
