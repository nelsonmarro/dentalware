import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../../app.ts'
import { createUser, loginAs, setupTestDb, truncateAll } from '../../test/setup.ts'

describe('/api/trabajos', () => {
  let ctx: Awaited<ReturnType<typeof setupTestDb>>
  let app: ReturnType<typeof createApp>
  let admin: string
  let recepcion: string
  let tecnico: string
  let mensajero: string
  let clinicId: string
  let doctorId: string
  let zr: string
  let ac: string

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
  })
  beforeEach(async () => {
    await truncateAll(ctx.db)
    await createUser(ctx.auth, ctx.db, {
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
    await createUser(ctx.auth, ctx.db, {
      email: 'mens@t.local',
      password: 'Mensajero1!',
      name: 'Mensajero',
      role: 'mensajero',
    })
    admin = await loginAs(app, 'admin@t.local', 'Admin12345!')
    recepcion = await loginAs(app, 'recep@t.local', 'Recep12345!')
    tecnico = await loginAs(app, 'tec@t.local', 'Tecnico123!')
    mensajero = await loginAs(app, 'mens@t.local', 'Mensajero1!')

    const [clinic] = await ctx.db.insert(ctx.schema.clinics).values({ name: 'Sonrisa' }).returning()
    clinicId = clinic!.id
    const [doctor] = await ctx.db
      .insert(ctx.schema.doctors)
      .values({ clinicId, name: 'Dr. Pérez' })
      .returning()
    doctorId = doctor!.id
    const [category] = await ctx.db
      .insert(ctx.schema.productCategories)
      .values({ name: 'Prótesis fija' })
      .returning()
    const [zrProduct] = await ctx.db
      .insert(ctx.schema.products)
      .values({
        code: 'ZR',
        name: 'Zirconio',
        categoryId: category!.id,
        pricingUnit: 'por_pieza',
        basePrice: '45.00',
      })
      .returning()
    zr = zrProduct!.id
    const [acProduct] = await ctx.db
      .insert(ctx.schema.products)
      .values({
        code: 'AC',
        name: 'Acrílico',
        categoryId: category!.id,
        pricingUnit: 'por_arcada',
        basePrice: '80.00',
      })
      .returning()
    ac = acProduct!.id
  })

  function req(cookie: string, method: string, body?: unknown) {
    return {
      method,
      headers: { 'content-type': 'application/json', cookie, origin: ctx.config.WEB_ORIGIN },
      body: body === undefined ? undefined : JSON.stringify(body),
    }
  }

  function caseInput(overrides: Record<string, unknown> = {}) {
    return {
      clinicId,
      doctorId,
      patientRef: 'Paciente 1',
      receivedAt: '2026-09-06',
      items: [{ productId: zr, quantity: 1, teeth: [11] }],
      ...overrides,
    }
  }

  async function createOne(cookie: string, overrides: Record<string, unknown> = {}) {
    const r = await app.request('/api/trabajos', req(cookie, 'POST', caseInput(overrides)))
    const { case: created } = (await r.json()) as { case: { id: string } }
    return created.id
  }

  it('crea un trabajo (201) y lo devuelve con código, líneas con precio y total', async () => {
    const r = await app.request('/api/trabajos', req(recepcion, 'POST', caseInput()))
    expect(r.status).toBe(201)
    const { case: created } = (await r.json()) as {
      case: { code: string; total: string; items: { unitPrice: string; teeth: number[] }[] }
    }
    expect(created.code).toMatch(/^\d{2}-\d{5}$/)
    expect(created.total).toBe('45.00')
    expect(created.items[0]).toMatchObject({ unitPrice: '45.00', teeth: [11] })
  })

  it('técnico y mensajero no crean (403); sin sesión 403', async () => {
    expect((await app.request('/api/trabajos', req(tecnico, 'POST', caseInput()))).status).toBe(403)
    expect((await app.request('/api/trabajos', req(mensajero, 'POST', caseInput()))).status).toBe(
      403,
    )
    expect((await app.request('/api/trabajos', req('', 'POST', caseInput()))).status).toBe(403)
  })

  it('422 con issues en español si faltan líneas o el producto no existe', async () => {
    const sinLineas = await app.request(
      '/api/trabajos',
      req(recepcion, 'POST', caseInput({ items: [] })),
    )
    expect(sinLineas.status).toBe(422)
    const sinLineasBody = (await sinLineas.json()) as { issues: { path: string }[] }
    expect(sinLineasBody.issues.some((i) => i.path === 'items')).toBe(true)

    const productoInexistente = await app.request(
      '/api/trabajos',
      req(
        recepcion,
        'POST',
        caseInput({ items: [{ productId: '5f9a7b6e-2c4d-4e8f-9a1b-3c5d7e9f1a2b', quantity: 1 }] }),
      ),
    )
    expect(productoInexistente.status).toBe(422)
    expect(await productoInexistente.json()).toMatchObject({
      issues: [{ path: 'items.0.productId' }],
    })
  })

  it('técnico ve la ficha sin precios (null) pero con piezas y productos', async () => {
    const id = await createOne(recepcion)
    const r = await app.request(`/api/trabajos/${id}`, req(tecnico, 'GET'))
    expect(r.status).toBe(200)
    const { case: found } = (await r.json()) as {
      case: {
        total: string | null
        items: { unitPrice: string | null; teeth: number[]; product: { name: string } }[]
      }
    }
    expect(found.total).toBeNull()
    expect(found.items[0]).toMatchObject({
      unitPrice: null,
      teeth: [11],
      product: { name: 'Zirconio' },
    })
  })

  it('técnico y mensajero no ven las notas internas; admin sí', async () => {
    const id = await createOne(recepcion, { internalNotes: 'Nota interna confidencial' })

    const comoTecnico = await app.request(`/api/trabajos/${id}`, req(tecnico, 'GET'))
    const { case: paraTecnico } = (await comoTecnico.json()) as {
      case: { internalNotes: string | null }
    }
    expect(paraTecnico.internalNotes).toBeNull()

    const comoMensajero = await app.request(`/api/trabajos/${id}`, req(mensajero, 'GET'))
    const { case: paraMensajero } = (await comoMensajero.json()) as {
      case: { internalNotes: string | null }
    }
    expect(paraMensajero.internalNotes).toBeNull()

    const comoAdmin = await app.request(`/api/trabajos/${id}`, req(admin, 'GET'))
    const { case: paraAdmin } = (await comoAdmin.json()) as {
      case: { internalNotes: string | null }
    }
    expect(paraAdmin.internalNotes).toBe('Nota interna confidencial')
  })

  it('la lista de trabajos no expone notas internas', async () => {
    await createOne(recepcion, { internalNotes: 'Nota interna confidencial' })
    const r = await app.request('/api/trabajos', req(tecnico, 'GET'))
    const { cases: rows } = (await r.json()) as { cases: Record<string, unknown>[] }
    expect(rows.length).toBeGreaterThan(0)
    expect(rows[0]).not.toHaveProperty('internalNotes')
  })

  it('PUT reemplaza líneas y devuelve 409 si el trabajo está terminado', async () => {
    const id = await createOne(recepcion)
    const put = await app.request(
      `/api/trabajos/${id}`,
      req(recepcion, 'PUT', caseInput({ items: [{ productId: ac, quantity: 1 }] })),
    )
    expect(put.status).toBe(200)
    const { case: updated } = (await put.json()) as {
      case: { items: { productId: string }[]; total: string }
    }
    expect(updated.items).toHaveLength(1)
    expect(updated.items[0]!.productId).toBe(ac)
    expect(updated.total).toBe('80.00')

    await ctx.db
      .update(ctx.schema.cases)
      .set({ status: 'terminado' })
      .where(eq(ctx.schema.cases.id, id))
    const conflict = await app.request(`/api/trabajos/${id}`, req(recepcion, 'PUT', caseInput()))
    expect(conflict.status).toBe(409)
  })

  it('listado por vista y búsqueda; total de fila null para mensajero', async () => {
    const nuevoId = await createOne(recepcion, { patientRef: 'Ana Paciente' })
    const enProcesoId = await createOne(recepcion, { patientRef: 'Otro Paciente' })
    await ctx.db
      .update(ctx.schema.cases)
      .set({ status: 'en_proceso' })
      .where(eq(ctx.schema.cases.id, enProcesoId))

    const porVista = await app.request('/api/trabajos?vista=nuevos', req(recepcion, 'GET'))
    const porVistaBody = (await porVista.json()) as { cases: { id: string }[] }
    expect(porVistaBody.cases.map((c) => c.id)).toEqual([nuevoId])

    const porBusqueda = await app.request('/api/trabajos?q=Ana', req(recepcion, 'GET'))
    const porBusquedaBody = (await porBusqueda.json()) as { cases: { id: string }[] }
    expect(porBusquedaBody.cases.map((c) => c.id)).toEqual([nuevoId])

    const comoMensajero = await app.request('/api/trabajos', req(mensajero, 'GET'))
    const comoMensajeroBody = (await comoMensajero.json()) as { cases: { total: string | null }[] }
    expect(comoMensajeroBody.cases.length).toBeGreaterThan(0)
    expect(comoMensajeroBody.cases.every((c) => c.total === null)).toBe(true)
  })

  it('comentario: técnico comenta (201) y aparece en eventos con su nombre; texto vacío 422', async () => {
    const id = await createOne(recepcion)
    const r = await app.request(
      `/api/trabajos/${id}/comentarios`,
      req(tecnico, 'POST', { text: 'Falta color' }),
    )
    expect(r.status).toBe(201)
    const { event } = (await r.json()) as { event: { toValue: string; actor: { name: string } } }
    expect(event).toMatchObject({ toValue: 'Falta color', actor: { name: 'Ana Técnico' } })

    const eventos = await app.request(`/api/trabajos/${id}/eventos`, req(tecnico, 'GET'))
    const { events } = (await eventos.json()) as {
      events: { type: string; actor: { name: string } }[]
    }
    expect(events.find((e) => e.type === 'comment')).toMatchObject({
      actor: { name: 'Ana Técnico' },
    })

    const vacio = await app.request(
      `/api/trabajos/${id}/comentarios`,
      req(tecnico, 'POST', { text: '' }),
    )
    expect(vacio.status).toBe(422)
  })

  it('GET /:id devuelve missing con "Fecha deseada" cuando falta', async () => {
    const id = await createOne(recepcion)
    const r = await app.request(`/api/trabajos/${id}`, req(admin, 'GET'))
    expect(r.status).toBe(200)
    const { missing } = (await r.json()) as { missing: string[] }
    expect(missing).toContain('Fecha deseada')
  })

  it('técnico no ve precios en el historial', async () => {
    const id = await createOne(admin)
    await app.request(
      `/api/trabajos/${id}`,
      req(admin, 'PUT', caseInput({ items: [{ productId: zr, quantity: 1, unitPrice: '30.00' }] })),
    )

    const comoTecnico = await app.request(`/api/trabajos/${id}/eventos`, req(tecnico, 'GET'))
    const { events: eventosTecnico } = (await comoTecnico.json()) as {
      events: { type: string; fromValue: string | null; toValue: string | null }[]
    }
    const cambioTecnico = eventosTecnico.find((e) => e.type === 'price_changed')
    expect(cambioTecnico).toBeDefined()
    expect(cambioTecnico).toMatchObject({ fromValue: null, toValue: null })

    const comoAdmin = await app.request(`/api/trabajos/${id}/eventos`, req(admin, 'GET'))
    const { events: eventosAdmin } = (await comoAdmin.json()) as {
      events: { type: string; fromValue: string | null; toValue: string | null }[]
    }
    const cambioAdmin = eventosAdmin.find((e) => e.type === 'price_changed')
    expect(cambioAdmin?.fromValue).not.toBeNull()
    expect(cambioAdmin?.toValue).not.toBeNull()
  })

  it('404 en GET /:id y PUT /:id con id desconocido', async () => {
    const idDesconocido = randomUUID()
    const get = await app.request(`/api/trabajos/${idDesconocido}`, req(admin, 'GET'))
    expect(get.status).toBe(404)
    expect(await get.json()).toMatchObject({ message: 'El trabajo no existe' })

    const put = await app.request(`/api/trabajos/${idDesconocido}`, req(admin, 'PUT', caseInput()))
    expect(put.status).toBe(404)
    expect(await put.json()).toMatchObject({ message: 'El trabajo no existe' })
  })
})
