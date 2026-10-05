import { caseInputSchema } from '@dentalware/shared'
import { eq, sql } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { testPassword } from '../../test/passwords.ts'
import { createUser, setupTestDb, truncateAll } from '../../test/setup.ts'
import { createCasesRepo } from '../cases/repo.ts'
import { DELIVERY_PROOF_FK } from '../deliveries/schema.ts'
import { AttachmentInUseError } from './errors.ts'
import { createAttachmentsRepo } from './repo.ts'

describe('features/attachments/repo', () => {
  let ctx: Awaited<ReturnType<typeof setupTestDb>>
  let caseId: string
  let courierId: string

  beforeAll(async () => {
    ctx = await setupTestDb()
  })
  afterAll(async () => {
    await ctx.pool.end()
  })
  beforeEach(async () => {
    await truncateAll(ctx.db)
    const [clinic] = await ctx.db.insert(ctx.schema.clinics).values({ name: 'Sonrisa' }).returning()
    const [doctor] = await ctx.db
      .insert(ctx.schema.doctors)
      .values({ clinicId: clinic!.id, name: 'Dra. Paredes' })
      .returning()
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
    const actor = await createUser(ctx.auth, ctx.db, {
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
    const input = caseInputSchema.parse({
      clinicId: clinic!.id,
      doctorId: doctor!.id,
      patientRef: 'Paciente 1',
      receivedAt: '2026-09-06',
      items: [{ productId: product!.id, quantity: 1 }],
    })
    caseId = (await createCasesRepo(ctx.db).create(input, actor)).id
  })

  async function proof(name: string) {
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

  describe('remove', () => {
    it('borra un adjunto que ninguna entrega referencia', async () => {
      const repo = createAttachmentsRepo(ctx.db)
      const id = await proof('sin-usar.jpg')
      await repo.remove(id)
      expect(await repo.byId(id)).toBeUndefined()
    })

    // Carrera borrar contra «Marcar entregado»: la comprobación previa del servicio dijo «sin
    // usar», pero la entrega la ligó antes del DELETE. La FK lo impide y el repo lo traduce.
    it('no borra la constancia que referencia una entrega: AttachmentInUseError', async () => {
      const repo = createAttachmentsRepo(ctx.db)
      const id = await proof('constancia.jpg')
      const [delivery] = await ctx.db
        .insert(ctx.schema.deliveries)
        .values({
          caseId,
          type: 'entrega',
          status: 'hecha',
          courierId,
          scheduledFor: '2026-09-10',
          proofAttachmentId: id,
        })
        .returning()

      await expect(repo.remove(id)).rejects.toBeInstanceOf(AttachmentInUseError)

      expect(await repo.byId(id)).toBeDefined()
      const [row] = await ctx.db
        .select()
        .from(ctx.schema.deliveries)
        .where(eq(ctx.schema.deliveries.id, delivery!.id))
      expect(row?.proofAttachmentId).toBe(id)
    })

    // M-1: solo la FK de la constancia de una entrega es «constancia en uso». Otra tabla que
    // referencie un adjunto (p. ej. el comprobante de un pago) no puede responder con ese mensaje:
    // la violación sale tal cual.
    it('relanza la violación de otra FK que referencia el adjunto, sin traducirla', async () => {
      const repo = createAttachmentsRepo(ctx.db)
      const id = await proof('comprobante.jpg')
      await ctx.db.execute(
        sql`create table "test_attachment_refs" ("attachment_id" uuid references "attachments"("id") on delete restrict)`,
      )
      try {
        await ctx.db.execute(sql`insert into "test_attachment_refs" values (${id})`)
        const error = await repo.remove(id).then(
          () => undefined,
          (e: unknown) => e,
        )
        expect(error).toBeInstanceOf(Error)
        expect(error).not.toBeInstanceOf(AttachmentInUseError)
        expect((error as Error).cause).toMatchObject({ code: '23503' })
        expect(await repo.byId(id)).toBeDefined()
      } finally {
        await ctx.db.execute(sql`drop table if exists "test_attachment_refs"`)
      }
    })
  })

  it('la FK de la constancia de una entrega se llama como DELIVERY_PROOF_FK', async () => {
    expect(DELIVERY_PROOF_FK).toBe('deliveries_proof_attachment_id_attachments_id_fkey')
    const { rows } = await ctx.db.execute<{ conname: string }>(
      sql`select conname from pg_constraint where contype = 'f' and conrelid = 'deliveries'::regclass and confrelid = 'attachments'::regclass`,
    )
    expect(rows.map((r) => r.conname)).toEqual([
      'deliveries_proof_attachment_id_attachments_id_fkey',
    ])
  })
})
