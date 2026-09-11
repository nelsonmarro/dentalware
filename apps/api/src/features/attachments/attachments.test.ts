import { caseInputSchema } from '@dentalware/shared'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import sharp from 'sharp'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../../app.ts'
import {
  cleanupTestStorage,
  createUser,
  loginAs,
  setupTestDb,
  truncateAll,
} from '../../test/setup.ts'
import { createCasesRepo } from '../cases/repo.ts'

describe('/api/adjuntos', () => {
  let ctx: Awaited<ReturnType<typeof setupTestDb>>
  let app: ReturnType<typeof createApp>
  let admin: string
  let recepcion: string
  let tecnico: string
  let adminId: string
  let caseId: string

  beforeAll(async () => {
    ctx = await setupTestDb()
    app = createApp({
      auth: ctx.auth,
      db: ctx.db,
      webOrigin: ctx.config.WEB_ORIGIN,
      storage: ctx.storage,
    })
  })
  afterAll(async () => {
    await ctx.pool.end()
    await cleanupTestStorage(ctx)
  })
  beforeEach(async () => {
    await truncateAll(ctx.db)
    adminId = await createUser(ctx.auth, ctx.db, {
      email: 'admin@t.local',
      password: 'Admin12345!',
      name: 'Admin',
      role: 'admin',
    })
    await createUser(ctx.auth, ctx.db, {
      email: 'recep@t.local',
      password: 'Recep12345!',
      name: 'Recepción',
      role: 'recepcion',
    })
    await createUser(ctx.auth, ctx.db, {
      email: 'tec@t.local',
      password: 'Tecnico123!',
      name: 'Ana Técnico',
      role: 'tecnico',
    })
    admin = await loginAs(app, 'admin@t.local', 'Admin12345!')
    recepcion = await loginAs(app, 'recep@t.local', 'Recep12345!')
    tecnico = await loginAs(app, 'tec@t.local', 'Tecnico123!')

    const [clinic] = await ctx.db.insert(ctx.schema.clinics).values({ name: 'Sonrisa' }).returning()
    const [doctor] = await ctx.db
      .insert(ctx.schema.doctors)
      .values({ clinicId: clinic!.id, name: 'Dr. Pérez' })
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

    const input = caseInputSchema.parse({
      clinicId: clinic!.id,
      doctorId: doctor!.id,
      patientRef: 'Paciente 1',
      receivedAt: '2026-09-06',
      items: [{ productId: product!.id, quantity: 1, teeth: [11] }],
    })
    caseId = (await createCasesRepo(ctx.db).create(input, adminId)).id
  })

  function upload(cookie: string, file: File, kind?: string) {
    const form = new FormData()
    form.set('file', file)
    if (kind) form.set('kind', kind)
    return app.request(`/api/adjuntos/trabajo/${caseId}`, {
      method: 'POST',
      headers: { cookie, origin: ctx.config.WEB_ORIGIN },
      body: form,
    })
  }

  async function jpegFixture(width: number, height: number) {
    return sharp({ create: { width, height, channels: 3, background: '#0f766e' } })
      .jpeg()
      .toBuffer()
  }

  it('sube una foto, la normaliza y genera miniatura; registra el evento', async () => {
    const buf = await jpegFixture(3000, 2000)
    const file = new File([buf], 'foto.jpg', { type: 'image/jpeg' })

    const res = await upload(tecnico, file)
    expect(res.status).toBe(201)
    const { attachment } = (await res.json()) as {
      attachment: {
        id: string
        kind: string
        width: number
        height: number
        thumbUrl: string | null
        url: string
      }
    }
    expect(attachment.kind).toBe('photo')
    expect(attachment.width).toBeLessThanOrEqual(1600)
    expect(attachment.height).toBeLessThanOrEqual(1600)
    expect(attachment.thumbUrl).not.toBeNull()
    expect(attachment.url).toBe(`/api/adjuntos/${attachment.id}`)

    const events = await ctx.db.query.caseEvents.findMany({ where: { caseId } })
    expect(events.some((e) => e.type === 'attachment_added' && e.toValue === 'foto.jpg')).toBe(true)
  })

  it('lista los adjuntos de un trabajo', async () => {
    const buf = await jpegFixture(400, 300)
    await upload(recepcion, new File([buf], 'a.jpg', { type: 'image/jpeg' }))

    const res = await app.request(`/api/adjuntos/trabajo/${caseId}`, {
      headers: { cookie: recepcion },
    })
    expect(res.status).toBe(200)
    const { attachments } = (await res.json()) as { attachments: unknown[] }
    expect(attachments).toHaveLength(1)
  })

  it('GET /:id sirve la imagen normalizada con su content-type', async () => {
    const buf = await jpegFixture(3000, 2000)
    const up = await upload(tecnico, new File([buf], 'foto.jpg', { type: 'image/jpeg' }))
    const { attachment } = (await up.json()) as { attachment: { id: string } }

    const res = await app.request(`/api/adjuntos/${attachment.id}`, { headers: { cookie: admin } })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/jpeg')
    expect(res.headers.get('content-disposition')).toContain(`filename*=UTF-8''`)
    const bytes = new Uint8Array(await res.arrayBuffer())
    expect(bytes.byteLength).toBeGreaterThan(0)
    const meta = await sharp(bytes).metadata()
    expect(meta.format).toBe('jpeg')
  })

  it('GET /:id/miniatura sirve un WebP', async () => {
    const buf = await jpegFixture(3000, 2000)
    const up = await upload(tecnico, new File([buf], 'foto.jpg', { type: 'image/jpeg' }))
    const { attachment } = (await up.json()) as { attachment: { id: string } }

    const res = await app.request(`/api/adjuntos/${attachment.id}/miniatura`, {
      headers: { cookie: admin },
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/webp')
  })

  it('un PDF pequeño se guarda como documento sin miniatura', async () => {
    const buf = Buffer.from('%PDF-1.4\n%¥±ë\n1 0 obj\n<< >>\nendobj\ntrailer\n<< >>\n%%EOF')
    const file = new File([buf], 'informe.pdf', { type: 'application/pdf' })

    const res = await upload(recepcion, file)
    expect(res.status).toBe(201)
    const { attachment } = (await res.json()) as {
      attachment: { kind: string; thumbUrl: string | null; id: string }
    }
    expect(attachment.kind).toBe('document')
    expect(attachment.thumbUrl).toBeNull()

    const thumbRes = await app.request(`/api/adjuntos/${attachment.id}/miniatura`, {
      headers: { cookie: admin },
    })
    expect(thumbRes.status).toBe(404)
  })

  it('la miniatura de un adjunto inexistente responde 404 El adjunto no existe', async () => {
    const res = await app.request(`/api/adjuntos/00000000-0000-4000-8000-000000000000/miniatura`, {
      headers: { cookie: admin },
    })
    expect(res.status).toBe(404)
    expect((await res.json()) as { message: string }).toEqual({
      message: 'El adjunto no existe',
    })
  })

  it('rechaza bytes que no son una imagen válida aunque el mime declarado sea image/jpeg', async () => {
    const file = new File([Buffer.from('no soy una imagen')], 'falsa.jpg', { type: 'image/jpeg' })

    const res = await upload(recepcion, file)
    expect(res.status).toBe(415)
    expect((await res.json()) as { message: string }).toEqual({
      message: 'El archivo no es una imagen válida',
    })

    const list = await app.request(`/api/adjuntos/trabajo/${caseId}`, {
      headers: { cookie: recepcion },
    })
    const { attachments } = (await list.json()) as { attachments: unknown[] }
    expect(attachments).toHaveLength(0)

    await expect(readdir(join(ctx.storageDir, caseId))).rejects.toThrow()
  })

  it('rechaza un PDF cuyos bytes no empiezan con la firma %PDF-', async () => {
    const file = new File([Buffer.from('esto no es un pdf, son bytes cualquiera')], 'falso.pdf', {
      type: 'application/pdf',
    })

    const res = await upload(recepcion, file)
    expect(res.status).toBe(415)
    expect((await res.json()) as { message: string }).toEqual({
      message: 'El archivo no es un PDF válido',
    })
  })

  it('rechaza un tipo no permitido con 415', async () => {
    const file = new File([Buffer.from('hola')], 'nota.txt', { type: 'text/plain' })
    const res = await upload(recepcion, file)
    expect(res.status).toBe(415)
  })

  it('rechaza un archivo demasiado grande con 413', async () => {
    const big = Buffer.alloc(26 * 1024 * 1024)
    const file = new File([big], 'grande.jpg', { type: 'image/jpeg' })
    const res = await upload(recepcion, file)
    expect(res.status).toBe(413)
  })

  it('un técnico no puede borrar (403); un admin sí (204) y el archivo desaparece', async () => {
    const buf = await jpegFixture(3000, 2000)
    const up = await upload(tecnico, new File([buf], 'foto.jpg', { type: 'image/jpeg' }))
    const { attachment } = (await up.json()) as { attachment: { id: string } }

    const forbidden = await app.request(`/api/adjuntos/${attachment.id}`, {
      method: 'DELETE',
      headers: { cookie: tecnico, origin: ctx.config.WEB_ORIGIN },
    })
    expect(forbidden.status).toBe(403)

    const storagePath = `${caseId}/${attachment.id}.jpg`
    const thumbPath = `${caseId}/${attachment.id}.thumb.webp`
    expect(await ctx.storage.exists(storagePath)).toBe(true)

    const deleted = await app.request(`/api/adjuntos/${attachment.id}`, {
      method: 'DELETE',
      headers: { cookie: admin, origin: ctx.config.WEB_ORIGIN },
    })
    expect(deleted.status).toBe(204)
    expect(await ctx.storage.exists(storagePath)).toBe(false)
    expect(await ctx.storage.exists(thumbPath)).toBe(false)

    const events = await ctx.db.query.caseEvents.findMany({ where: { caseId } })
    expect(events.some((e) => e.type === 'attachment_removed' && e.fromValue === 'foto.jpg')).toBe(
      true,
    )

    const getDeleted = await app.request(`/api/adjuntos/${attachment.id}`, {
      headers: { cookie: admin },
    })
    expect(getDeleted.status).toBe(404)
  })
})
