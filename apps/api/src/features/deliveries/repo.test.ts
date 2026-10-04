import { caseInputSchema, type CaseInput } from '@dentalware/shared'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { testPassword } from '../../test/passwords.ts'
import { createUser, setupTestDb, truncateAll } from '../../test/setup.ts'
import { createCasesRepo } from '../cases/repo.ts'
import { createCouriersQuery, createDeliveriesRepo } from './repo.ts'

describe('features/deliveries/repo', () => {
  let ctx: Awaited<ReturnType<typeof setupTestDb>>
  let clinicId: string
  let doctorId: string
  let productId: string
  let actor: string
  let courierId: string

  beforeAll(async () => {
    ctx = await setupTestDb()
  })
  afterAll(async () => {
    await ctx.pool.end()
  })
  beforeEach(async () => {
    await truncateAll(ctx.db)
    const [clinic] = await ctx.db
      .insert(ctx.schema.clinics)
      .values({
        name: 'Sonrisa',
        address: 'Av. Amazonas 123',
        city: 'Quito',
        phone: '099-000-0000',
      })
      .returning()
    clinicId = clinic!.id
    const [doctor] = await ctx.db
      .insert(ctx.schema.doctors)
      .values({ clinicId, name: 'Dra. Paredes' })
      .returning()
    doctorId = doctor!.id
    const [category] = await ctx.db
      .insert(ctx.schema.productCategories)
      .values({ name: 'Prótesis fija' })
      .returning()
    const [product] = await ctx.db
      .insert(ctx.schema.products)
      .values({
        code: 'ZR',
        name: 'Zirconio',
        categoryId: category!.id,
        pricingUnit: 'por_pieza',
        basePrice: '45.00',
      })
      .returning()
    productId = product!.id
    actor = await createUser(ctx.auth, ctx.db, {
      email: 'admin@t.local',
      password: testPassword(),
      name: 'Admin',
      role: 'admin',
    })
    courierId = await createUser(ctx.auth, ctx.db, {
      email: 'mensajero@t.local',
      password: testPassword(),
      name: 'Beto Mensajero',
      role: 'mensajero',
    })
  })

  function caseInput(overrides: Partial<CaseInput> = {}): CaseInput {
    return caseInputSchema.parse({
      clinicId,
      doctorId,
      patientRef: 'Paciente 1',
      receivedAt: '2026-09-06',
      items: [{ productId, quantity: 1 }],
      ...overrides,
    })
  }

  async function createCase(overrides: Partial<CaseInput> = {}) {
    return (await createCasesRepo(ctx.db).create(caseInput(overrides), actor)).id
  }

  describe('create y pendingFor', () => {
    it('create registra la entrega y pendingFor la encuentra', async () => {
      const repo = createDeliveriesRepo(ctx.db)
      const caseId = await createCase()
      const created = await repo.create({
        caseId,
        type: 'entrega',
        courierId,
        scheduledFor: '2026-09-10',
      })
      expect(created.status).toBe('pendiente')
      expect(created.caseId).toBe(caseId)

      const pending = await repo.pendingFor(caseId, 'entrega')
      expect(pending?.id).toBe(created.id)
    })

    it('rechaza una segunda pendiente del mismo tipo para el mismo trabajo (índice único)', async () => {
      const repo = createDeliveriesRepo(ctx.db)
      const caseId = await createCase()
      await repo.create({ caseId, type: 'entrega', courierId, scheduledFor: '2026-09-10' })
      await expect(
        repo.create({ caseId, type: 'entrega', courierId, scheduledFor: '2026-09-11' }),
      ).rejects.toThrow()
    })

    it('permite una pendiente de recogida y otra de entrega para el mismo trabajo', async () => {
      const repo = createDeliveriesRepo(ctx.db)
      const caseId = await createCase()
      await repo.create({ caseId, type: 'recogida', courierId, scheduledFor: '2026-09-10' })
      await repo.create({ caseId, type: 'entrega', courierId, scheduledFor: '2026-09-11' })
      expect(await repo.pendingFor(caseId, 'recogida')).toBeDefined()
      expect(await repo.pendingFor(caseId, 'entrega')).toBeDefined()
    })
  })

  describe('markDone y markFailed', () => {
    it('markDone fija hecha, doneAt y la constancia', async () => {
      const repo = createDeliveriesRepo(ctx.db)
      const caseId = await createCase()
      const [attachment] = await ctx.db
        .insert(ctx.schema.attachments)
        .values({
          caseId,
          kind: 'constancia',
          filename: 'constancia.jpg',
          mime: 'image/jpeg',
          size: 100,
          storagePath: 'x/constancia.jpg',
          uploadedBy: courierId,
        })
        .returning()
      const created = await repo.create({
        caseId,
        type: 'entrega',
        courierId,
        scheduledFor: '2026-09-10',
      })
      const doneAt = new Date('2026-09-10T15:00:00Z')
      await repo.markDone(created.id, doneAt, attachment!.id)

      const row = await repo.byId(created.id)
      expect(row?.status).toBe('hecha')
      expect(row?.doneAt).toEqual(doneAt)
      expect(row?.proofAttachmentId).toBe(attachment!.id)
    })

    it('markFailed fija fallida y el motivo', async () => {
      const repo = createDeliveriesRepo(ctx.db)
      const caseId = await createCase()
      const created = await repo.create({
        caseId,
        type: 'entrega',
        courierId,
        scheduledFor: '2026-09-10',
      })
      const at = new Date('2026-09-10T15:00:00Z')
      await repo.markFailed(created.id, 'Clínica cerrada', at)

      const row = await repo.byId(created.id)
      expect(row?.status).toBe('fallida')
      expect(row?.failedReason).toBe('Clínica cerrada')
    })

    it('markFailed sobre una entrega ya hecha devuelve false y no la cambia', async () => {
      const repo = createDeliveriesRepo(ctx.db)
      const caseId = await createCase()
      const created = await repo.create({
        caseId,
        type: 'entrega',
        courierId,
        scheduledFor: '2026-09-10',
      })
      const doneAt = new Date('2026-09-10T15:00:00Z')
      expect(await repo.markDone(created.id, doneAt, null)).toBe(true)

      expect(await repo.markFailed(created.id, 'Clínica cerrada', new Date())).toBe(false)

      const row = await repo.byId(created.id)
      expect(row).toMatchObject({ status: 'hecha', failedReason: null, doneAt })
    })

    it('markDone sobre una entrega fallida devuelve false y no la cambia', async () => {
      const repo = createDeliveriesRepo(ctx.db)
      const caseId = await createCase()
      const created = await repo.create({
        caseId,
        type: 'entrega',
        courierId,
        scheduledFor: '2026-09-10',
      })
      const at = new Date('2026-09-10T15:00:00Z')
      expect(await repo.markFailed(created.id, 'Clínica cerrada', at)).toBe(true)

      expect(await repo.markDone(created.id, new Date(), null)).toBe(false)

      const row = await repo.byId(created.id)
      expect(row).toMatchObject({ status: 'fallida', failedReason: 'Clínica cerrada', doneAt: at })
    })
  })

  // UX4-06: el puerto `DeliveryProofLookup` de adjuntos.
  describe('linkedProofIds', () => {
    async function proof(caseId: string, name: string) {
      const [a] = await ctx.db
        .insert(ctx.schema.attachments)
        .values({
          caseId,
          kind: 'constancia',
          filename: name,
          mime: 'image/jpeg',
          size: 100,
          storagePath: `x/${name}`,
          uploadedBy: courierId,
        })
        .returning()
      return a!.id
    }

    it('devuelve solo las constancias de entregas hechas del trabajo', async () => {
      const repo = createDeliveriesRepo(ctx.db)
      const caseId = await createCase()
      const otherCase = await createCase()
      const hecha = await proof(caseId, 'hecha.jpg')
      const fallida = await proof(caseId, 'fallida.jpg')
      const ajena = await proof(otherCase, 'ajena.jpg')
      await proof(caseId, 'sin-usar.jpg')
      const base = { courierId, scheduledFor: '2026-09-10' }
      await ctx.db.insert(ctx.schema.deliveries).values([
        { ...base, caseId, type: 'entrega', status: 'hecha', proofAttachmentId: hecha },
        // Una fallida no cierra con foto, pero si la tuviera no sería «de la entrega».
        { ...base, caseId, type: 'recogida', status: 'fallida', proofAttachmentId: fallida },
        { ...base, caseId: otherCase, type: 'entrega', status: 'hecha', proofAttachmentId: ajena },
        { ...base, caseId: otherCase, type: 'recogida', status: 'hecha' },
      ])

      expect(await repo.linkedProofIds(caseId)).toEqual([hecha])
      expect(await repo.linkedProofIds(otherCase)).toEqual([ajena])
    })
  })

  describe('listForDay', () => {
    it('filtra por día y por mensajero', async () => {
      const repo = createDeliveriesRepo(ctx.db)
      const otroMensajero = await createUser(ctx.auth, ctx.db, {
        email: 'otro@t.local',
        password: testPassword(),
        name: 'Otro Mensajero',
        role: 'mensajero',
      })
      const caseHoy = await createCase({ patientRef: 'Paciente hoy' })
      const caseOtroDia = await createCase({ patientRef: 'Paciente otro día' })
      const caseOtroMensajero = await createCase({ patientRef: 'Paciente otro mensajero' })
      await repo.create({
        caseId: caseHoy,
        type: 'entrega',
        courierId,
        scheduledFor: '2026-09-10',
      })
      await repo.create({
        caseId: caseOtroDia,
        type: 'entrega',
        courierId,
        scheduledFor: '2026-09-11',
      })
      await repo.create({
        caseId: caseOtroMensajero,
        type: 'entrega',
        courierId: otroMensajero,
        scheduledFor: '2026-09-10',
      })

      const porDia = await repo.listForDay({ day: '2026-09-10', includeOverdue: false })
      expect(porDia.map((d) => d.case.patientRef).sort()).toEqual([
        'Paciente hoy',
        'Paciente otro mensajero',
      ])

      const porMensajero = await repo.listForDay({
        day: '2026-09-10',
        courierId,
        includeOverdue: false,
      })
      expect(porMensajero.map((d) => d.case.patientRef)).toEqual(['Paciente hoy'])
    })

    it('con includeOverdue trae las pendientes de ayer y no las hechas de ayer', async () => {
      const repo = createDeliveriesRepo(ctx.db)
      const caseAyerPendiente = await createCase({ patientRef: 'Ayer pendiente' })
      const caseAyerHecha = await createCase({ patientRef: 'Ayer hecha' })
      const caseHoy = await createCase({ patientRef: 'Hoy' })
      await repo.create({
        caseId: caseAyerPendiente,
        type: 'entrega',
        courierId,
        scheduledFor: '2026-09-09',
      })
      const hecha = await repo.create({
        caseId: caseAyerHecha,
        type: 'entrega',
        courierId,
        scheduledFor: '2026-09-09',
      })
      await repo.markDone(hecha.id, new Date('2026-09-09T15:00:00Z'), null)
      await repo.create({
        caseId: caseHoy,
        type: 'entrega',
        courierId,
        scheduledFor: '2026-09-10',
      })

      const sinAtrasadas = await repo.listForDay({ day: '2026-09-10', includeOverdue: false })
      expect(sinAtrasadas.map((d) => d.case.patientRef)).toEqual(['Hoy'])

      const conAtrasadas = await repo.listForDay({ day: '2026-09-10', includeOverdue: true })
      expect(conAtrasadas.map((d) => d.case.patientRef).sort()).toEqual(['Ayer pendiente', 'Hoy'])
    })

    it('devuelve el código, el alias del paciente, la dirección y el teléfono de la clínica, y el nombre del mensajero', async () => {
      const repo = createDeliveriesRepo(ctx.db)
      const caseId = await createCase({ patientRef: 'Paciente 7' })
      const created = await repo.create({
        caseId,
        type: 'entrega',
        courierId,
        scheduledFor: '2026-09-10',
      })
      const [item] = await repo.listForDay({ day: '2026-09-10', includeOverdue: false })
      expect(item).toMatchObject({
        id: created.id,
        type: 'entrega',
        status: 'pendiente',
        scheduledFor: '2026-09-10',
        case: {
          code: '26-00001',
          patientRef: 'Paciente 7',
          status: 'nuevo',
          priority: 'normal',
        },
        clinic: {
          name: 'Sonrisa',
          address: 'Av. Amazonas 123',
          city: 'Quito',
          phone: '099-000-0000',
        },
        rescheduledFor: null,
        courier: { name: 'Beto Mensajero' },
      })
    })

    // UX4-18: la fallida dice para cuándo se reprogramó: la fecha de la siguiente entrega del
    // mismo trabajo y tipo (la que creó «No se pudo»), no la de otra posterior.
    it('una fallida trae la fecha a la que se reprogramó; la cerrada por cancelación, ninguna', async () => {
      const repo = createDeliveriesRepo(ctx.db)
      const caseId = await createCase()
      const primera = await repo.create({
        caseId,
        type: 'entrega',
        courierId,
        scheduledFor: '2026-09-10',
      })
      await repo.markFailed(primera.id, 'Clínica cerrada', new Date('2026-09-10T15:00:00Z'))
      // Otro tipo del mismo trabajo, creado antes de la reprogramación, no cuenta como tal.
      await repo.create({ caseId, type: 'recogida', courierId, scheduledFor: '2026-09-11' })
      const segunda = await repo.create({
        caseId,
        type: 'entrega',
        courierId,
        scheduledFor: '2026-09-14',
      })
      await repo.markFailed(segunda.id, 'Nadie para recibir', new Date('2026-09-14T15:00:00Z'))
      await repo.create({ caseId, type: 'entrega', courierId, scheduledFor: '2026-09-16' })
      const otro = await createCase()
      const cancelada = await repo.create({
        caseId: otro,
        type: 'entrega',
        courierId,
        scheduledFor: '2026-09-10',
      })
      await repo.markFailed(cancelada.id, 'Trabajo cancelado: x', new Date('2026-09-10T16:00:00Z'))

      const dia10 = await repo.listForDay({ day: '2026-09-10', includeOverdue: false })
      expect(dia10.find((d) => d.id === primera.id)?.rescheduledFor).toBe('2026-09-14')
      expect(dia10.find((d) => d.id === cancelada.id)?.rescheduledFor).toBeNull()
      const dia14 = await repo.listForDay({ day: '2026-09-14', includeOverdue: false })
      expect(dia14.find((d) => d.id === segunda.id)?.rescheduledFor).toBe('2026-09-16')
    })

    it('no devuelve ningún campo de dinero', async () => {
      const repo = createDeliveriesRepo(ctx.db)
      const caseId = await createCase()
      await repo.create({ caseId, type: 'entrega', courierId, scheduledFor: '2026-09-10' })
      const [item] = await repo.listForDay({ day: '2026-09-10', includeOverdue: false })
      expect(Object.keys(item!).sort()).toEqual(
        [
          'id',
          'type',
          'status',
          'scheduledFor',
          'doneAt',
          'failedReason',
          'rescheduledFor',
          'case',
          'clinic',
          'courier',
        ].sort(),
      )
      expect(Object.keys(item!.case).sort()).toEqual(
        ['id', 'code', 'patientRef', 'status', 'priority'].sort(),
      )
    })

    it('ordena por clínica y por código', async () => {
      const repo = createDeliveriesRepo(ctx.db)
      const [clinicB] = await ctx.db
        .insert(ctx.schema.clinics)
        .values({ name: 'Zeta Dental' })
        .returning()
      const caseEnA = await createCase({ patientRef: 'En A' })
      const caseEnB = (
        await createCasesRepo(ctx.db).create(
          caseInput({ clinicId: clinicB!.id, patientRef: 'En B' }),
          actor,
        )
      ).id
      await repo.create({ caseId: caseEnB, type: 'entrega', courierId, scheduledFor: '2026-09-10' })
      await repo.create({ caseId: caseEnA, type: 'entrega', courierId, scheduledFor: '2026-09-10' })
      const items = await repo.listForDay({ day: '2026-09-10', includeOverdue: false })
      expect(items.map((i) => i.clinic.name)).toEqual(['Sonrisa', 'Zeta Dental'])
    })
  })

  describe('createCouriersQuery', () => {
    it('devuelve solo mensajeros activos, ordenados por nombre', async () => {
      await createUser(ctx.auth, ctx.db, {
        email: 'zoe@t.local',
        password: testPassword(),
        name: 'Zoe Mensajera',
        role: 'mensajero',
      })
      const bloqueadoId = await createUser(ctx.auth, ctx.db, {
        email: 'bloqueado@t.local',
        password: testPassword(),
        name: 'Ana Bloqueada',
        role: 'mensajero',
      })
      await ctx.db
        .update(ctx.schema.users)
        .set({ banned: true })
        .where(eq(ctx.schema.users.id, bloqueadoId))

      const names = await createCouriersQuery(ctx.db).activeCouriers()
      expect(names.map((n) => n.name)).toEqual(['Beto Mensajero', 'Zoe Mensajera'])
    })
  })
})
