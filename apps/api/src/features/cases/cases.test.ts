import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../../app.ts'
import {
  cleanupTestStorage,
  createUser,
  loginAs,
  setupTestDb,
  truncateAll,
} from '../../test/setup.ts'

describe('/api/trabajos', () => {
  let ctx: Awaited<ReturnType<typeof setupTestDb>>
  let app: ReturnType<typeof createApp>
  let admin: string
  let recepcion: string
  let tecnico: string
  let tecnicoId: string
  let mensajero: string
  let mensajeroId: string
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
    await cleanupTestStorage(ctx)
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
    tecnicoId = await createUser(ctx.auth, ctx.db, {
      email: 'tec@t.local',
      password: 'Tecnico123!',
      name: 'Ana Técnico',
      role: 'tecnico',
    })
    mensajeroId = await createUser(ctx.auth, ctx.db, {
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

  async function ids(qs: string) {
    return (
      (await (await app.request(`/api/trabajos${qs}`, req(recepcion, 'GET'))).json()) as {
        cases: { id: string }[]
      }
    ).cases.map((c) => c.id)
  }

  it('ordena por fecha de entrega y por código en ambas direcciones; orden inválido 422', async () => {
    const tarde = await createOne(recepcion, { patientRef: 'Tarde', dueDate: '2030-01-10' })
    const pronto = await createOne(recepcion, { patientRef: 'Pronto', dueDate: '2030-01-01' })
    expect(await ids('?orden=entrega')).toEqual([pronto, tarde])
    expect(await ids('?orden=entrega-desc')).toEqual([tarde, pronto])
    expect(await ids('?orden=codigo')).toEqual([tarde, pronto]) // el primero creado tiene el código menor
    expect(await ids('?orden=codigo-desc')).toEqual([pronto, tarde])
    expect((await app.request('/api/trabajos?orden=precio', req(recepcion, 'GET'))).status).toBe(
      422,
    )
  })

  it('ordena por clínica (nombre) en ambas direcciones, no por id ni por fecha de creación', async () => {
    const [zafiro] = await ctx.db.insert(ctx.schema.clinics).values({ name: 'Zafiro' }).returning()
    const [zafiroDoctor] = await ctx.db
      .insert(ctx.schema.doctors)
      .values({ clinicId: zafiro!.id, name: 'Dr. Zafiro' })
      .returning()
    const [aurora] = await ctx.db.insert(ctx.schema.clinics).values({ name: 'Aurora' }).returning()
    const [auroraDoctor] = await ctx.db
      .insert(ctx.schema.doctors)
      .values({ clinicId: aurora!.id, name: 'Dr. Aurora' })
      .returning()
    // Zafiro se crea primero (id/creación anteriores) pero "Aurora" ordena antes por nombre.
    const enZafiro = await createOne(recepcion, {
      patientRef: 'En Zafiro',
      clinicId: zafiro!.id,
      doctorId: zafiroDoctor!.id,
    })
    const enAurora = await createOne(recepcion, {
      patientRef: 'En Aurora',
      clinicId: aurora!.id,
      doctorId: auroraDoctor!.id,
    })
    expect(await ids('?orden=clinica')).toEqual([enAurora, enZafiro])
    expect(await ids('?orden=clinica-desc')).toEqual([enZafiro, enAurora])
  })

  it('ordena por estado según el ciclo de vida (CASE_STATUSES), no alfabéticamente', async () => {
    const nuevoId = await createOne(recepcion, { patientRef: 'Nuevo' })
    const enProcesoId = await createOne(recepcion, { patientRef: 'En proceso' })
    await ctx.db
      .update(ctx.schema.cases)
      .set({ status: 'en_proceso' })
      .where(eq(ctx.schema.cases.id, enProcesoId))
    // Alfabéticamente "en_proceso" va antes que "nuevo"; en el ciclo de vida es al revés.
    expect(await ids('?orden=estado')).toEqual([nuevoId, enProcesoId])
    expect(await ids('?orden=estado-desc')).toEqual([enProcesoId, nuevoId])
  })

  it('sin orden, el urgente aparece primero aunque su fecha de entrega lo pondría después', async () => {
    const normal = await createOne(recepcion, { patientRef: 'Normal', dueDate: '2030-01-01' })
    const urgente = await createOne(recepcion, {
      patientRef: 'Urgente',
      dueDate: '2030-01-10',
      priority: 'urgente',
    })
    expect(await ids('')).toEqual([urgente, normal])
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

  describe('POST /api/trabajos/:id/acciones', () => {
    // Una sola fase por test (no una por llamada a `crearTrabajoCompleto`): `stages` no
    // tiene unicidad por `name`, así que dos filas "Diseño" con `sort: 0` en el mismo test
    // dejarían a `firstStage` eligiendo entre ellas sin orden determinista.
    beforeEach(async () => {
      await ctx.db.insert(ctx.schema.stages).values({ name: 'Diseño', sort: 0 })
    })

    async function crearTrabajoCompleto(overrides: Record<string, unknown> = {}) {
      const id = await createOne(recepcion, {
        dueDate: '2026-12-01',
        prescription: 'Corona completa disilicato',
        ...overrides,
      })
      return { id }
    }

    async function crearTrabajoSinPrescripcion() {
      const id = await createOne(recepcion, { dueDate: '2026-12-01' })
      return { id }
    }

    async function crearTrabajoEnProceso() {
      const { id } = await crearTrabajoCompleto()
      await app.request(`/api/trabajos/${id}/acciones`, req(admin, 'POST', { accion: 'aceptar' }))
      return { id }
    }

    it('acepta un trabajo completo y fija fecha comprometida, fase y evento', async () => {
      const { id } = await crearTrabajoCompleto()
      const res = await app.request(
        `/api/trabajos/${id}/acciones`,
        req(admin, 'POST', { accion: 'aceptar' }),
      )
      expect(res.status).toBe(200)
      const ficha = (await (
        await app.request(`/api/trabajos/${id}`, req(admin, 'GET'))
      ).json()) as {
        case: { status: string; promisedDate: string | null; currentStageId: string | null }
      }
      expect(ficha.case.status).toBe('en_proceso')
      expect(ficha.case.promisedDate).not.toBeNull()
      expect(ficha.case.currentStageId).not.toBeNull()
      const eventos = (await (
        await app.request(`/api/trabajos/${id}/eventos`, req(admin, 'GET'))
      ).json()) as { events: { type: string }[] }
      expect(eventos.events.some((e) => e.type === 'status_changed')).toBe(true)
    })

    it('responde 422 con el detalle cuando faltan datos obligatorios', async () => {
      const { id } = await crearTrabajoSinPrescripcion()
      const res = await app.request(
        `/api/trabajos/${id}/acciones`,
        req(admin, 'POST', { accion: 'aceptar' }),
      )
      expect(res.status).toBe(422)
      const body = (await res.json()) as { message: string; issues: unknown }
      expect(body.message).toBe('Datos inválidos')
      expect(JSON.stringify(body.issues)).toContain('Prescripción')
    })

    it('responde 409 ante una transición inválida', async () => {
      const { id } = await crearTrabajoCompleto()
      const res = await app.request(
        `/api/trabajos/${id}/acciones`,
        req(admin, 'POST', { accion: 'finalizar' }),
      )
      expect(res.status).toBe(409)
    })

    it('responde 403 sin sesión y con rol técnico', async () => {
      const { id } = await crearTrabajoCompleto()
      expect(
        (await app.request(`/api/trabajos/${id}/acciones`, req('', 'POST', { accion: 'aceptar' })))
          .status,
      ).toBe(403)
      expect(
        (
          await app.request(
            `/api/trabajos/${id}/acciones`,
            req(tecnico, 'POST', { accion: 'aceptar' }),
          )
        ).status,
      ).toBe(403)
    })

    it('responde 422 al pausar sin motivo', async () => {
      const { id } = await crearTrabajoEnProceso()
      const res = await app.request(
        `/api/trabajos/${id}/acciones`,
        req(admin, 'POST', { accion: 'pausar' }),
      )
      expect(res.status).toBe(422)
    })

    it('responde 404 si el trabajo no existe', async () => {
      const res = await app.request(
        `/api/trabajos/${randomUUID()}/acciones`,
        req(admin, 'POST', { accion: 'aceptar' }),
      )
      expect(res.status).toBe(404)
    })

    // I-1: lo que hace especial a esta ruta (sin `canWrite` fijo) es justo que un técnico
    // pueda finalizar y un mensajero pueda marcar entregas; sin estos tres, los 6 tests de
    // arriba quedarían en verde aunque alguien rompiera ese comportamiento por HTTP.
    it('técnico puede finalizar un trabajo en proceso (200)', async () => {
      const { id } = await crearTrabajoEnProceso()
      const res = await app.request(
        `/api/trabajos/${id}/acciones`,
        req(tecnico, 'POST', { accion: 'finalizar' }),
      )
      expect(res.status).toBe(200)
    })

    it('mensajero puede marcar entregado un trabajo enviado (200)', async () => {
      const { id } = await crearTrabajoEnProceso()
      await app.request(`/api/trabajos/${id}/acciones`, req(admin, 'POST', { accion: 'finalizar' }))
      await app.request(
        `/api/trabajos/${id}/acciones`,
        req(admin, 'POST', { accion: 'marcar_enviado' }),
      )
      const res = await app.request(
        `/api/trabajos/${id}/acciones`,
        req(mensajero, 'POST', { accion: 'marcar_entregado' }),
      )
      expect(res.status).toBe(200)
    })

    it('mensajero no puede aceptar (403)', async () => {
      const { id } = await crearTrabajoCompleto()
      const res = await app.request(
        `/api/trabajos/${id}/acciones`,
        req(mensajero, 'POST', { accion: 'aceptar' }),
      )
      expect(res.status).toBe(403)
    })

    // M-1: `canAct` corre antes del validador de `json`; sin sesión, un cuerpo inválido
    // (falta el motivo obligatorio de "pausar") debe dar 403 uniforme y no 422, igual que
    // en las demás rutas de escritura, en vez de confirmarle a un anónimo que la ruta
    // existe con un mensaje de validación.
    it('sin sesión con cuerpo inválido responde 403 y no 422', async () => {
      const { id } = await crearTrabajoCompleto()
      const res = await app.request(
        `/api/trabajos/${id}/acciones`,
        req('', 'POST', { accion: 'pausar' }),
      )
      expect(res.status).toBe(403)
    })
  })

  describe('PUT /api/trabajos/:id/fase', () => {
    let stage2: string

    // Dos fases con `sort` distintos, sembradas una sola vez (mismo ruling que en
    // `describe('POST /api/trabajos/:id/acciones', ...)`  arriba): con una fase no se puede
    // probar el avance, y `stages` no tiene unicidad por `name`, así que hay que sembrarlas
    // en un único `beforeEach` para que `firstStage`/`nextStage` elijan de forma determinista.
    beforeEach(async () => {
      await ctx.db.insert(ctx.schema.stages).values({ name: 'Diseño', sort: 0 })
      const [s2] = await ctx.db
        .insert(ctx.schema.stages)
        .values({ name: 'Cerámica', sort: 1 })
        .returning()
      stage2 = s2!.id
    })

    async function crearTrabajoEnProceso() {
      const id = await createOne(recepcion, {
        dueDate: '2026-12-01',
        prescription: 'Corona completa disilicato',
      })
      await app.request(`/api/trabajos/${id}/acciones`, req(admin, 'POST', { accion: 'aceptar' }))
      return { id }
    }

    it('avanza la fase (200) y deja el evento stage_changed', async () => {
      const { id } = await crearTrabajoEnProceso()
      const res = await app.request(
        `/api/trabajos/${id}/fase`,
        req(admin, 'PUT', { direccion: 'avanzar' }),
      )
      expect(res.status).toBe(200)
      const body = (await res.json()) as { case: { id: string; currentStageId: string } }
      expect(body.case.currentStageId).toBe(stage2)

      const eventos = (await (
        await app.request(`/api/trabajos/${id}/eventos`, req(admin, 'GET'))
      ).json()) as { events: { type: string }[] }
      expect(eventos.events.some((e) => e.type === 'stage_changed')).toBe(true)
    })

    it('responde 409 al avanzar desde la última fase activa', async () => {
      const { id } = await crearTrabajoEnProceso()
      await app.request(`/api/trabajos/${id}/fase`, req(admin, 'PUT', { direccion: 'avanzar' }))
      const res = await app.request(
        `/api/trabajos/${id}/fase`,
        req(admin, 'PUT', { direccion: 'avanzar' }),
      )
      expect(res.status).toBe(409)
    })

    it('responde 409 en un trabajo en espera', async () => {
      const { id } = await crearTrabajoEnProceso()
      await app.request(
        `/api/trabajos/${id}/acciones`,
        req(admin, 'POST', { accion: 'pausar', motivo: 'Falta antagonista' }),
      )
      const res = await app.request(
        `/api/trabajos/${id}/fase`,
        req(admin, 'PUT', { direccion: 'avanzar' }),
      )
      expect(res.status).toBe(409)
    })

    // M-4 (ronda de fixes 1): faltaba el 409 gemelo con `en_prueba` (solo estaba `en_espera`).
    it('responde 409 en un trabajo en prueba en boca', async () => {
      const { id } = await crearTrabajoEnProceso()
      await app.request(
        `/api/trabajos/${id}/acciones`,
        req(admin, 'POST', { accion: 'enviar_prueba' }),
      )
      const res = await app.request(
        `/api/trabajos/${id}/fase`,
        req(admin, 'PUT', { direccion: 'avanzar' }),
      )
      expect(res.status).toBe(409)
    })

    // M-4 (ronda de fixes 1): faltaba el 422 de `stageChangeSchema` (motivo obligatorio al
    // retroceder) ejercitado por HTTP, no solo a nivel de schema (`cases.test.ts` en `shared`).
    it('responde 422 al retroceder sin motivo', async () => {
      const { id } = await crearTrabajoEnProceso()
      await app.request(`/api/trabajos/${id}/fase`, req(admin, 'PUT', { direccion: 'avanzar' }))
      const res = await app.request(
        `/api/trabajos/${id}/fase`,
        req(admin, 'PUT', { direccion: 'retroceder' }),
      )
      expect(res.status).toBe(422)
    })

    it('el técnico puede cambiar de fase (200)', async () => {
      const { id } = await crearTrabajoEnProceso()
      const res = await app.request(
        `/api/trabajos/${id}/fase`,
        req(tecnico, 'PUT', { direccion: 'avanzar' }),
      )
      expect(res.status).toBe(200)
    })

    it('responde 403 sin sesión y con rol mensajero', async () => {
      const { id } = await crearTrabajoEnProceso()
      expect(
        (await app.request(`/api/trabajos/${id}/fase`, req('', 'PUT', { direccion: 'avanzar' })))
          .status,
      ).toBe(403)
      expect(
        (
          await app.request(
            `/api/trabajos/${id}/fase`,
            req(mensajero, 'PUT', { direccion: 'avanzar' }),
          )
        ).status,
      ).toBe(403)
    })
  })

  describe('GET /api/trabajos/tecnicos', () => {
    // Trampa de orden (ruling de la Tarea 9): `GET /:id` está declarado en `routes.ts` y, si
    // `/tecnicos` se declarara después, ese segmento literal se colaría como si fuera un `id`
    // (404 o 422 de uuid inválido) en vez de devolver la lista. Este test fija que la ruta
    // nueva gana.
    it('devuelve la lista de técnicos, no un error de uuid inválido', async () => {
      const res = await app.request('/api/trabajos/tecnicos', req(admin, 'GET'))
      expect(res.status).toBe(200)
      const body = (await res.json()) as { technicians: { id: string; name: string }[] }
      expect(body.technicians).toContainEqual({ id: tecnicoId, name: 'Ana Técnico' })
    })

    it('no expone correo, rol ni estado de baneo', async () => {
      const res = await app.request('/api/trabajos/tecnicos', req(recepcion, 'GET'))
      const body = (await res.json()) as { technicians: Record<string, unknown>[] }
      for (const t of body.technicians) {
        expect(Object.keys(t).sort()).toEqual(['id', 'name'])
      }
    })

    it('un técnico baneado no aparece en la lista', async () => {
      await ctx.db
        .update(ctx.schema.users)
        .set({ banned: true })
        .where(eq(ctx.schema.users.id, tecnicoId))
      const res = await app.request('/api/trabajos/tecnicos', req(admin, 'GET'))
      const body = (await res.json()) as { technicians: { id: string }[] }
      expect(body.technicians.some((t) => t.id === tecnicoId)).toBe(false)
    })

    it('responde 403 sin sesión y con rol técnico o mensajero', async () => {
      expect((await app.request('/api/trabajos/tecnicos', req('', 'GET'))).status).toBe(403)
      expect((await app.request('/api/trabajos/tecnicos', req(tecnico, 'GET'))).status).toBe(403)
      expect((await app.request('/api/trabajos/tecnicos', req(mensajero, 'GET'))).status).toBe(403)
    })
  })

  describe('PUT /api/trabajos/:id/tecnico', () => {
    it('asigna un técnico activo (200) y deja el evento assigned', async () => {
      const id = await createOne(recepcion)
      const res = await app.request(`/api/trabajos/${id}/tecnico`, req(admin, 'PUT', { tecnicoId }))
      expect(res.status).toBe(200)
      const body = (await res.json()) as {
        case: { id: string; assignedTechnicianId: string | null }
      }
      expect(body.case.assignedTechnicianId).toBe(tecnicoId)

      const eventos = (await (
        await app.request(`/api/trabajos/${id}/eventos`, req(admin, 'GET'))
      ).json()) as { events: { type: string }[] }
      expect(eventos.events.some((e) => e.type === 'assigned')).toBe(true)
    })

    it('responde 422 si el técnico no existe o no está activo', async () => {
      const id = await createOne(recepcion)
      const res = await app.request(
        `/api/trabajos/${id}/tecnico`,
        req(admin, 'PUT', { tecnicoId: randomUUID() }),
      )
      expect(res.status).toBe(422)
    })

    // I-2 (ronda de fixes 1): `fakeUsersQuery` en los tests de servicio es un array literal,
    // así que no ejercita el `where` real de `createUsersQuery`; el único 422 de integración
    // mandaba un `randomUUID()` que tampoco existe en `users`. Estos dos casos sí pasan por
    // Postgres con un usuario que existe de verdad: si el `where` filtrara mal (por rol y no
    // por `banned`, por `banned` y no por rol, o por la columna equivocada), alguno de los dos
    // dejaría pasar el 200. Verificado por mutación (ver Reporte de fixes).
    it('responde 422 al asignar el id de un usuario que no es técnico', async () => {
      const id = await createOne(recepcion)
      const res = await app.request(
        `/api/trabajos/${id}/tecnico`,
        req(admin, 'PUT', { tecnicoId: mensajeroId }),
      )
      expect(res.status).toBe(422)
    })

    it('responde 422 al asignar un técnico baneado', async () => {
      await ctx.db
        .update(ctx.schema.users)
        .set({ banned: true })
        .where(eq(ctx.schema.users.id, tecnicoId))
      const id = await createOne(recepcion)
      const res = await app.request(`/api/trabajos/${id}/tecnico`, req(admin, 'PUT', { tecnicoId }))
      expect(res.status).toBe(422)
    })

    it('acepta desasignar con tecnicoId: null', async () => {
      const id = await createOne(recepcion)
      await app.request(`/api/trabajos/${id}/tecnico`, req(admin, 'PUT', { tecnicoId }))
      const res = await app.request(
        `/api/trabajos/${id}/tecnico`,
        req(admin, 'PUT', { tecnicoId: null }),
      )
      expect(res.status).toBe(200)
      const body = (await res.json()) as { case: { assignedTechnicianId: string | null } }
      expect(body.case.assignedTechnicianId).toBeNull()
    })

    it('responde 403 sin sesión y con rol técnico', async () => {
      const id = await createOne(recepcion)
      expect(
        (await app.request(`/api/trabajos/${id}/tecnico`, req('', 'PUT', { tecnicoId }))).status,
      ).toBe(403)
      expect(
        (await app.request(`/api/trabajos/${id}/tecnico`, req(tecnico, 'PUT', { tecnicoId })))
          .status,
      ).toBe(403)
    })
  })

  describe('POST /api/trabajos/:id/repetir', () => {
    async function avanzarAEntregado(id: string) {
      await app.request(`/api/trabajos/${id}/acciones`, req(admin, 'POST', { accion: 'aceptar' }))
      await app.request(`/api/trabajos/${id}/acciones`, req(admin, 'POST', { accion: 'finalizar' }))
      await app.request(
        `/api/trabajos/${id}/acciones`,
        req(admin, 'POST', { accion: 'marcar_enviado' }),
      )
      await app.request(
        `/api/trabajos/${id}/acciones`,
        req(admin, 'POST', { accion: 'marcar_entregado' }),
      )
    }

    async function crearTrabajoEntregado() {
      const id = await createOne(recepcion, {
        dueDate: '2026-12-01',
        prescription: 'Corona completa disilicato',
        items: [{ productId: zr, quantity: 1, teeth: [11, 12] }],
      })
      await avanzarAEntregado(id)
      return { id }
    }

    function remakeBody(overrides: Record<string, unknown> = {}) {
      return {
        motivo: 'Fractura en cerámica al probar',
        responsabilidad: 'laboratorio',
        cobroPct: 0,
        ...overrides,
      }
    }

    it('repite un trabajo entregado (201): código nuevo, hijo enlazado al padre y líneas copiadas', async () => {
      const { id } = await crearTrabajoEntregado()
      const res = await app.request(`/api/trabajos/${id}/repetir`, req(admin, 'POST', remakeBody()))
      expect(res.status).toBe(201)
      const { case: created } = (await res.json()) as { case: { id: string; code: string } }
      expect(created.code).toMatch(/^\d{2}-\d{5}$/)

      const ficha = (await (
        await app.request(`/api/trabajos/${created.id}`, req(admin, 'GET'))
      ).json()) as {
        case: {
          status: string
          parentCaseId: string | null
          remakeReason: string
          remakeResponsibility: string
          remakeChargePct: string
          items: { teeth: number[] }[]
        }
      }
      expect(ficha.case.status).toBe('nuevo')
      expect(ficha.case.parentCaseId).toBe(id)
      expect(ficha.case.remakeReason).toBe('Fractura en cerámica al probar')
      expect(ficha.case.remakeResponsibility).toBe('laboratorio')
      expect(ficha.case.remakeChargePct).toBe('0.00')
      expect(ficha.case.items).toHaveLength(1)
      expect(ficha.case.items[0]!.teeth).toEqual([11, 12])
    })

    // I-3 (ronda de fixes 1 del PR 1): esta prueba corre contra el `repo.ts` real (Postgres),
    // no contra `fakes.ts` — el hallazgo original era justo que solo la copia del fake estaba
    // protegida. Un padre con `dueDate` ya vencida (2020, muy anterior a "hoy") no debe
    // colar esa fecha al hijo: si `createRemake` copiara `parent.dueDate` tal cual, el hijo
    // nacería ya "atrasado" el mismo día que se crea.
    it('una fecha deseada ya vencida en el padre no se copia al hijo (dueDate queda null)', async () => {
      const id = await createOne(recepcion, {
        dueDate: '2020-01-01',
        prescription: 'Corona completa disilicato',
        items: [{ productId: zr, quantity: 1, teeth: [11, 12] }],
      })
      await avanzarAEntregado(id)
      const res = await app.request(`/api/trabajos/${id}/repetir`, req(admin, 'POST', remakeBody()))
      expect(res.status).toBe(201)
      const { case: created } = (await res.json()) as { case: { id: string } }
      const ficha = (await (
        await app.request(`/api/trabajos/${created.id}`, req(admin, 'GET'))
      ).json()) as { case: { dueDate: string | null } }
      expect(ficha.case.dueDate).toBeNull()
    })

    it('deja el evento remake_created en el original y en el hijo', async () => {
      const { id } = await crearTrabajoEntregado()
      const res = await app.request(`/api/trabajos/${id}/repetir`, req(admin, 'POST', remakeBody()))
      const { case: created } = (await res.json()) as { case: { id: string } }

      const eventosPadre = (await (
        await app.request(`/api/trabajos/${id}/eventos`, req(admin, 'GET'))
      ).json()) as { events: { type: string }[] }
      expect(eventosPadre.events.some((e) => e.type === 'remake_created')).toBe(true)

      const eventosHijo = (await (
        await app.request(`/api/trabajos/${created.id}/eventos`, req(admin, 'GET'))
      ).json()) as { events: { type: string }[] }
      expect(eventosHijo.events.some((e) => e.type === 'remake_created')).toBe(true)
    })

    it('el hijo nace sin técnico asignado aunque el padre lo tuviera', async () => {
      const id = await createOne(recepcion, {
        dueDate: '2026-12-01',
        prescription: 'Corona completa disilicato',
      })
      await app.request(`/api/trabajos/${id}/acciones`, req(admin, 'POST', { accion: 'aceptar' }))
      await app.request(`/api/trabajos/${id}/tecnico`, req(admin, 'PUT', { tecnicoId }))
      await avanzarAEntregado(id)

      const res = await app.request(`/api/trabajos/${id}/repetir`, req(admin, 'POST', remakeBody()))
      const { case: created } = (await res.json()) as { case: { id: string } }
      const ficha = (await (
        await app.request(`/api/trabajos/${created.id}`, req(admin, 'GET'))
      ).json()) as { case: { assignedTechnicianId: string | null } }
      expect(ficha.case.assignedTechnicianId).toBeNull()
    })

    it('se puede repetir más de una vez el mismo trabajo', async () => {
      const { id } = await crearTrabajoEntregado()
      const primero = (await (
        await app.request(`/api/trabajos/${id}/repetir`, req(admin, 'POST', remakeBody()))
      ).json()) as { case: { id: string } }
      const segundo = (await (
        await app.request(`/api/trabajos/${id}/repetir`, req(admin, 'POST', remakeBody()))
      ).json()) as { case: { id: string } }
      expect(primero.case.id).not.toBe(segundo.case.id)
    })

    it('se puede repetir una repetición (encadenado al padre inmediato)', async () => {
      const { id } = await crearTrabajoEntregado()
      const hijoRes = await app.request(
        `/api/trabajos/${id}/repetir`,
        req(admin, 'POST', remakeBody()),
      )
      const { case: hijo } = (await hijoRes.json()) as { case: { id: string } }
      await avanzarAEntregado(hijo.id)

      const nietoRes = await app.request(
        `/api/trabajos/${hijo.id}/repetir`,
        req(admin, 'POST', remakeBody()),
      )
      expect(nietoRes.status).toBe(201)
      const { case: nieto } = (await nietoRes.json()) as { case: { id: string } }
      const ficha = (await (
        await app.request(`/api/trabajos/${nieto.id}`, req(admin, 'GET'))
      ).json()) as { case: { parentCaseId: string | null } }
      expect(ficha.case.parentCaseId).toBe(hijo.id)
    })

    it('responde 409 al repetir un trabajo nuevo', async () => {
      const id = await createOne(recepcion)
      const res = await app.request(`/api/trabajos/${id}/repetir`, req(admin, 'POST', remakeBody()))
      expect(res.status).toBe(409)
    })

    it('responde 404 si el trabajo no existe', async () => {
      const res = await app.request(
        `/api/trabajos/${randomUUID()}/repetir`,
        req(admin, 'POST', remakeBody()),
      )
      expect(res.status).toBe(404)
    })

    it('responde 422 sin motivo', async () => {
      const { id } = await crearTrabajoEntregado()
      const res = await app.request(
        `/api/trabajos/${id}/repetir`,
        req(admin, 'POST', remakeBody({ motivo: '' })),
      )
      expect(res.status).toBe(422)
    })

    it('responde 403 sin sesión y con rol técnico', async () => {
      const { id } = await crearTrabajoEntregado()
      expect(
        (await app.request(`/api/trabajos/${id}/repetir`, req('', 'POST', remakeBody()))).status,
      ).toBe(403)
      expect(
        (await app.request(`/api/trabajos/${id}/repetir`, req(tecnico, 'POST', remakeBody())))
          .status,
      ).toBe(403)
    })

    // I-2 (ronda de fixes 1): el hijo no copia adjuntos (solo el texto de `prescription`, ver
    // el JSDoc de `CasesRepository.createRemake`). Si el padre se aceptó con prescripción solo
    // como documento adjunto (caso cotidiano: receta escaneada), el hijo nace sin prescripción
    // de ningún tipo. Este test deja constancia de qué ve la Tarea 8/9 en `missing` para que la
    // UI pueda avisar, no solo lo documenta en el código.
    it('si la prescripción del padre era solo un documento adjunto, el hijo la reclama en missing', async () => {
      const id = await createOne(recepcion, {
        dueDate: '2026-12-01',
        items: [{ productId: zr, quantity: 1, teeth: [11, 12] }],
        // Sin `prescription` de texto a propósito: el padre se acepta gracias al documento.
      })
      const pdf = Buffer.from('%PDF-1.4\n%¥±ë\n1 0 obj\n<< >>\nendobj\ntrailer\n<< >>\n%%EOF')
      const form = new FormData()
      form.set('file', new File([pdf], 'orden.pdf', { type: 'application/pdf' }))
      form.set('kind', 'document')
      const subida = await app.request(`/api/adjuntos/trabajo/${id}`, {
        method: 'POST',
        headers: { cookie: recepcion, origin: ctx.config.WEB_ORIGIN },
        body: form,
      })
      expect(subida.status).toBe(201)

      // El padre no reclama prescripción: el documento la cubre.
      const fichaPadre = (await (
        await app.request(`/api/trabajos/${id}`, req(admin, 'GET'))
      ).json()) as { missing: string[] }
      expect(fichaPadre.missing).not.toContain('Prescripción (texto o documento)')

      await avanzarAEntregado(id)
      const res = await app.request(`/api/trabajos/${id}/repetir`, req(admin, 'POST', remakeBody()))
      expect(res.status).toBe(201)
      const { case: created } = (await res.json()) as { case: { id: string } }

      const fichaHijo = (await (
        await app.request(`/api/trabajos/${created.id}`, req(admin, 'GET'))
      ).json()) as { case: { prescription: string | null }; missing: string[] }
      expect(fichaHijo.case.prescription).toBeNull()
      expect(fichaHijo.missing).toContain('Prescripción (texto o documento)')
    })
  })
})
