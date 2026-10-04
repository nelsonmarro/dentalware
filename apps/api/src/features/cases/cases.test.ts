import { randomUUID } from 'node:crypto'
import { CASE_VIEWS, toIsoDate } from '@dentalware/shared'
import { and, eq } from 'drizzle-orm'
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
  // Fecha de negocio de hoy con el reloj del sistema (el de `createApp` sin `clock`): un envío
  // o una recogida no pueden programarse para antes de hoy.
  const hoy = toIsoDate(new Date())
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

  /** Registra un adjunto del trabajo directamente en la BD (ENT-4): `marcar_entregado` solo lee
   * su tipo y su MIME, la subida real (normalización con `sharp`) la prueba `attachments.test.ts`. */
  async function adjuntoDe(
    caseId: string,
    {
      kind = 'constancia',
      mime = 'image/jpeg',
    }: { kind?: 'constancia' | 'document'; mime?: string } = {},
  ) {
    const id = randomUUID()
    await ctx.db.insert(ctx.schema.attachments).values({
      id,
      caseId,
      kind,
      filename: 'constancia.jpg',
      mime,
      size: 10,
      storagePath: `${caseId}/${id}.jpg`,
      uploadedBy: mensajeroId,
    })
    return id
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
    // UX3-03: el mensaje llega tal cual al toast; con el rótulo del estado, no la clave.
    expect(await conflict.json()).toEqual({
      message:
        'No se puede editar: el trabajo está en estado "Terminado". Puede que otra persona lo haya cambiado.',
    })
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

  // M-5 (revisión final del PR 1, CIC-4): `vista=en_curso` filtra por una lista blanca de
  // estados (`en_proceso`/`en_espera`/`en_prueba`); un trabajo cancelado nunca debe aparecer
  // ahí, aunque un cancelado también sea, en cierto sentido, un trabajo "que ya no avanza".
  it('un trabajo cancelado no aparece en la vista en_curso', async () => {
    const enProcesoId = await createOne(recepcion, { patientRef: 'En proceso' })
    await ctx.db
      .update(ctx.schema.cases)
      .set({ status: 'en_proceso' })
      .where(eq(ctx.schema.cases.id, enProcesoId))

    const canceladoId = await createOne(recepcion, { patientRef: 'Cancelado' })
    await ctx.db
      .update(ctx.schema.cases)
      .set({ status: 'cancelado' })
      .where(eq(ctx.schema.cases.id, canceladoId))

    const res = await app.request('/api/trabajos?vista=en_curso', req(recepcion, 'GET'))
    const body = (await res.json()) as { cases: { id: string }[] }
    const idsEnCurso = body.cases.map((c) => c.id)
    expect(idsEnCurso).toContain(enProcesoId)
    expect(idsEnCurso).not.toContain(canceladoId)
  })

  // T10 (#68): vista rápida de trabajos en prueba en boca.
  it('vista=en_prueba lista solo los trabajos en estado en_prueba', async () => {
    const enPruebaId = await createOne(recepcion, { patientRef: 'En prueba' })
    await ctx.db
      .update(ctx.schema.cases)
      .set({ status: 'en_prueba' })
      .where(eq(ctx.schema.cases.id, enPruebaId))

    const enProcesoId = await createOne(recepcion, { patientRef: 'En proceso' })
    await ctx.db
      .update(ctx.schema.cases)
      .set({ status: 'en_proceso' })
      .where(eq(ctx.schema.cases.id, enProcesoId))

    const res = await app.request('/api/trabajos?vista=en_prueba', req(recepcion, 'GET'))
    const body = (await res.json()) as { cases: { id: string }[] }
    const idsEnPrueba = body.cases.map((c) => c.id)
    expect(idsEnPrueba).toContain(enPruebaId)
    expect(idsEnPrueba).not.toContain(enProcesoId)
  })

  // I-2 (ronda de fixes 1, T12, #68/#69): `tecnicoId` (repo.ts) no tenía ningún test propio —
  // "Mis trabajos" del panel de inicio depende de que un técnico vea solo lo suyo (INI-2), no
  // lo de todo el laboratorio. Comentar `if (q.tecnicoId) conds.push(…)` en `repo.ts` deja esta
  // prueba en rojo mientras el resto de la suite sigue en verde (reproducido en la ronda de
  // fixes 1, ver `task-12-report.md`).
  it('tecnicoId filtra solo los trabajos asignados a ese técnico', async () => {
    const otroTecnicoId = await createUser(ctx.auth, ctx.db, {
      email: 'tec2@t.local',
      password: 'Tecnico123!',
      name: 'Beto Técnico',
      role: 'tecnico',
    })

    const deAna = await createOne(recepcion, { patientRef: 'De Ana' })
    const deBeto = await createOne(recepcion, { patientRef: 'De Beto' })
    const sinAsignar = await createOne(recepcion, { patientRef: 'Sin asignar' })

    await ctx.db
      .update(ctx.schema.cases)
      .set({ status: 'en_proceso', assignedTechnicianId: tecnicoId })
      .where(eq(ctx.schema.cases.id, deAna))
    await ctx.db
      .update(ctx.schema.cases)
      .set({ status: 'en_proceso', assignedTechnicianId: otroTecnicoId })
      .where(eq(ctx.schema.cases.id, deBeto))
    await ctx.db
      .update(ctx.schema.cases)
      .set({ status: 'en_proceso' })
      .where(eq(ctx.schema.cases.id, sinAsignar))

    const res = await app.request(
      `/api/trabajos?tecnicoId=${tecnicoId}&vista=en_curso`,
      req(recepcion, 'GET'),
    )
    const body = (await res.json()) as { cases: { id: string }[] }
    expect(body.cases.map((c) => c.id)).toEqual([deAna])
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
      expect(await res.json()).toEqual({
        message:
          'No se puede "Finalizar": el trabajo está en estado "Nuevo". Puede que otra persona lo haya cambiado.',
      })
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
    // M-6 (ronda de fixes 1 del PR 1): estos dos tests solo comprobaban el 200; una fuga de
    // precios o notas internas en esta ruta pasaba inadvertida. El tipo de `body.case` fuerza
    // a que la respuesta real traiga estos campos (si el servicio dejara de enmascarar, el
    // `.toBeNull()` cae, no el tipo).
    it('técnico puede finalizar un trabajo en proceso (200) sin ver precios ni notas internas', async () => {
      const { id } = await crearTrabajoEnProceso()
      const res = await app.request(
        `/api/trabajos/${id}/acciones`,
        req(tecnico, 'POST', { accion: 'finalizar' }),
      )
      expect(res.status).toBe(200)
      const body = (await res.json()) as {
        case: {
          total: string | null
          internalNotes: string | null
          remakeChargePct: string | null
          items: {
            unitPrice: string | null
            lineTotal: string | null
            discountPct: string | null
          }[]
        }
      }
      expect(body.case.total).toBeNull()
      expect(body.case.internalNotes).toBeNull()
      expect(body.case.remakeChargePct).toBeNull()
      for (const item of body.case.items) {
        expect(item.unitPrice).toBeNull()
        expect(item.lineTotal).toBeNull()
        expect(item.discountPct).toBeNull()
      }
    })

    it('mensajero puede marcar entregado un trabajo enviado (200) sin ver precios ni notas internas', async () => {
      const { id } = await crearTrabajoEnProceso()
      await app.request(`/api/trabajos/${id}/acciones`, req(admin, 'POST', { accion: 'finalizar' }))
      await app.request(
        `/api/trabajos/${id}/acciones`,
        req(admin, 'POST', {
          accion: 'marcar_enviado',
          envio: { mensajeroId, fecha: hoy },
        }),
      )
      const res = await app.request(
        `/api/trabajos/${id}/acciones`,
        req(mensajero, 'POST', { accion: 'marcar_entregado', constanciaId: await adjuntoDe(id) }),
      )
      expect(res.status).toBe(200)
      const body = (await res.json()) as {
        case: {
          total: string | null
          internalNotes: string | null
          remakeChargePct: string | null
          items: {
            unitPrice: string | null
            lineTotal: string | null
            discountPct: string | null
          }[]
        }
      }
      expect(body.case.total).toBeNull()
      expect(body.case.internalNotes).toBeNull()
      expect(body.case.remakeChargePct).toBeNull()
      for (const item of body.case.items) {
        expect(item.unitPrice).toBeNull()
        expect(item.lineTotal).toBeNull()
        expect(item.discountPct).toBeNull()
      }
    })

    // M-6: caso donde `remakeChargePct` sí trae un valor antes de enmascarar (una repetición),
    // para que el `.toBeNull()` de arriba no pase "por casualidad" porque el campo ya nacía
    // vacío en un trabajo que nunca fue una repetición.
    it('técnico no ve el porcentaje de cobro de una repetición al finalizarla', async () => {
      const padreId = await createOne(recepcion, {
        dueDate: '2026-12-01',
        prescription: 'Corona completa disilicato',
        items: [{ productId: zr, quantity: 1, teeth: [11, 12] }],
      })
      await app.request(
        `/api/trabajos/${padreId}/acciones`,
        req(admin, 'POST', { accion: 'aceptar' }),
      )
      await app.request(
        `/api/trabajos/${padreId}/acciones`,
        req(admin, 'POST', { accion: 'finalizar' }),
      )
      await app.request(
        `/api/trabajos/${padreId}/acciones`,
        req(admin, 'POST', {
          accion: 'marcar_enviado',
          envio: { mensajeroId, fecha: hoy },
        }),
      )
      await app.request(
        `/api/trabajos/${padreId}/acciones`,
        req(admin, 'POST', {
          accion: 'marcar_entregado',
          constanciaId: await adjuntoDe(padreId),
        }),
      )
      const repetir = await app.request(
        `/api/trabajos/${padreId}/repetir`,
        req(admin, 'POST', {
          motivo: 'Color equivocado',
          responsabilidad: 'laboratorio',
          cobroPct: 50,
        }),
      )
      const { case: hijo } = (await repetir.json()) as { case: { id: string } }
      await app.request(
        `/api/trabajos/${hijo.id}/acciones`,
        req(admin, 'POST', { accion: 'aceptar' }),
      )
      const res = await app.request(
        `/api/trabajos/${hijo.id}/acciones`,
        req(tecnico, 'POST', { accion: 'finalizar' }),
      )
      expect(res.status).toBe(200)
      const body = (await res.json()) as { case: { remakeChargePct: string | null } }
      expect(body.case.remakeChargePct).toBeNull()

      // Confirma que el dato existe de verdad (no es null "por casualidad"): admin sí lo ve.
      const fichaAdmin = (await (
        await app.request(`/api/trabajos/${hijo.id}`, req(admin, 'GET'))
      ).json()) as { case: { remakeChargePct: string | null } }
      expect(fichaAdmin.case.remakeChargePct).toBe('50.00')
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

    // #97: con recepción y mensajero moviendo el mismo trabajo, la carrera deja de ser
    // teórica. `action` lee el trabajo con `byIdForUpdate` (`FOR UPDATE`) dentro de la
    // transacción, así que la segunda petición espera a que la primera confirme y ve el
    // estado nuevo. Se repite para que un adelantamiento casual no deje pasar una regresión.
    it('dos acciones simultáneas sobre el mismo trabajo: una gana (200) y la otra recibe 409', async () => {
      for (let intento = 0; intento < 10; intento++) {
        const { id } = await crearTrabajoEnProceso()
        const [pausar, finalizar] = await Promise.all([
          app.request(
            `/api/trabajos/${id}/acciones`,
            req(admin, 'POST', { accion: 'pausar', motivo: 'Falta antagonista' }),
          ),
          app.request(`/api/trabajos/${id}/acciones`, req(admin, 'POST', { accion: 'finalizar' })),
        ])
        expect([pausar.status, finalizar.status].sort()).toEqual([200, 409])
        const desdeEnProceso = await ctx.db
          .select({ type: ctx.schema.caseEvents.type })
          .from(ctx.schema.caseEvents)
          .where(
            and(
              eq(ctx.schema.caseEvents.caseId, id),
              eq(ctx.schema.caseEvents.fromValue, 'en_proceso'),
            ),
          )
        expect(desdeEnProceso).toHaveLength(1)
      }
    })

    // Iteración 4, Tarea 4 (ENT-3, ENT-4): enviar con mensajero y entregar con constancia.
    describe('envío y entrega', () => {
      const ayer = toIsoDate(new Date(Date.now() - 24 * 60 * 60 * 1000))

      async function crearTerminado() {
        const { id } = await crearTrabajoEnProceso()
        await app.request(
          `/api/trabajos/${id}/acciones`,
          req(admin, 'POST', { accion: 'finalizar' }),
        )
        return id
      }

      async function crearEnviado() {
        const id = await crearTerminado()
        await app.request(
          `/api/trabajos/${id}/acciones`,
          req(admin, 'POST', { accion: 'marcar_enviado', envio: { mensajeroId, fecha: hoy } }),
        )
        return id
      }

      async function otroMensajero() {
        const otroId = await createUser(ctx.auth, ctx.db, {
          email: 'mens2@t.local',
          password: 'Mensajero1!',
          name: 'Otro mensajero',
          role: 'mensajero',
        })
        return { otroId, otro: await loginAs(app, 'mens2@t.local', 'Mensajero1!') }
      }

      const entregasDe = (caseId: string) =>
        ctx.db.select().from(ctx.schema.deliveries).where(eq(ctx.schema.deliveries.caseId, caseId))

      it('marcar enviado sin envío responde 422 en envio', async () => {
        const id = await crearTerminado()
        const res = await app.request(
          `/api/trabajos/${id}/acciones`,
          req(admin, 'POST', { accion: 'marcar_enviado' }),
        )
        expect(res.status).toBe(422)
        expect(await res.json()).toEqual({
          message: 'Datos inválidos',
          issues: [{ path: 'envio', message: 'Elige mensajero y fecha' }],
        })
      })

      it('un envío con fecha de ayer responde 422 con el mensaje literal', async () => {
        const id = await crearTerminado()
        const res = await app.request(
          `/api/trabajos/${id}/acciones`,
          req(admin, 'POST', { accion: 'marcar_enviado', envio: { mensajeroId, fecha: ayer } }),
        )
        expect(res.status).toBe(422)
        expect(await res.json()).toEqual({
          message: 'Datos inválidos',
          issues: [
            { path: 'envio.fecha', message: 'La fecha de entrega no puede ser anterior a hoy.' },
          ],
        })
      })

      it('el mensajero que se asigna a sí mismo envía (200): entrega pendiente y shippedAt, sin precios', async () => {
        const id = await crearTerminado()
        const res = await app.request(
          `/api/trabajos/${id}/acciones`,
          req(mensajero, 'POST', { accion: 'marcar_enviado', envio: { mensajeroId, fecha: hoy } }),
        )
        expect(res.status).toBe(200)
        const { case: enviado } = (await res.json()) as {
          case: { status: string; shippedAt: string | null; total: string | null }
        }
        expect(enviado.status).toBe('enviado')
        expect(enviado.shippedAt).not.toBeNull()
        expect(enviado.total).toBeNull()
        expect(await entregasDe(id)).toEqual([
          expect.objectContaining({
            type: 'entrega',
            status: 'pendiente',
            courierId: mensajeroId,
            scheduledFor: hoy,
          }),
        ])
      })

      it('un mensajero que asigna el envío a otro mensajero recibe 403', async () => {
        const { otroId } = await otroMensajero()
        const id = await crearTerminado()
        const res = await app.request(
          `/api/trabajos/${id}/acciones`,
          req(mensajero, 'POST', {
            accion: 'marcar_enviado',
            envio: { mensajeroId: otroId, fecha: hoy },
          }),
        )
        expect(res.status).toBe(403)
        expect(await entregasDe(id)).toEqual([])
      })

      it('marcar entregado sin constancia responde 422', async () => {
        const id = await crearEnviado()
        const res = await app.request(
          `/api/trabajos/${id}/acciones`,
          req(mensajero, 'POST', { accion: 'marcar_entregado' }),
        )
        expect(res.status).toBe(422)
        expect(await res.json()).toEqual({
          message: 'Datos inválidos',
          issues: [{ path: 'constanciaId', message: 'Añade la foto de constancia' }],
        })
      })

      it('con la constancia de otro trabajo responde 422 con el mensaje literal', async () => {
        const id = await crearEnviado()
        const otroTrabajo = await crearTerminado()
        const res = await app.request(
          `/api/trabajos/${id}/acciones`,
          req(mensajero, 'POST', {
            accion: 'marcar_entregado',
            constanciaId: await adjuntoDe(otroTrabajo),
          }),
        )
        expect(res.status).toBe(422)
        expect(await res.json()).toEqual({
          message: 'Datos inválidos',
          issues: [
            { path: 'constanciaId', message: 'La foto de constancia no es de este trabajo.' },
          ],
        })
      })

      it('con un PDF de tipo documento del mismo trabajo responde 422', async () => {
        const id = await crearEnviado()
        const res = await app.request(
          `/api/trabajos/${id}/acciones`,
          req(mensajero, 'POST', {
            accion: 'marcar_entregado',
            constanciaId: await adjuntoDe(id, { kind: 'document', mime: 'application/pdf' }),
          }),
        )
        expect(res.status).toBe(422)
        const body = (await res.json()) as { issues: { message: string }[] }
        expect(body.issues).toEqual([
          { path: 'constanciaId', message: 'La foto de constancia no es de este trabajo.' },
        ])
      })

      it('el mensajero asignado entrega con la foto de constancia (200): entrega hecha y deliveredAt', async () => {
        const id = await crearEnviado()
        const constanciaId = await adjuntoDe(id)
        const res = await app.request(
          `/api/trabajos/${id}/acciones`,
          req(mensajero, 'POST', { accion: 'marcar_entregado', constanciaId }),
        )
        expect(res.status).toBe(200)
        const { case: entregado } = (await res.json()) as {
          case: { status: string; deliveredAt: string | null; total: string | null }
        }
        expect(entregado.status).toBe('entregado')
        expect(entregado.deliveredAt).not.toBeNull()
        expect(entregado.total).toBeNull()
        const [entrega] = await entregasDe(id)
        expect(entrega).toMatchObject({ status: 'hecha', proofAttachmentId: constanciaId })
        expect(entrega!.doneAt).not.toBeNull()
      })

      it('otro mensajero no entrega una entrega que no es suya (403)', async () => {
        const { otro } = await otroMensajero()
        const id = await crearEnviado()
        const res = await app.request(
          `/api/trabajos/${id}/acciones`,
          req(otro, 'POST', { accion: 'marcar_entregado', constanciaId: await adjuntoDe(id) }),
        )
        expect(res.status).toBe(403)
        const [entrega] = await entregasDe(id)
        expect(entrega!.status).toBe('pendiente')
      })

      it('cancelar un trabajo enviado cierra su entrega: no queda ninguna pendiente', async () => {
        const id = await crearEnviado()
        const res = await app.request(
          `/api/trabajos/${id}/acciones`,
          req(admin, 'POST', { accion: 'cancelar', motivo: 'Paciente desistió' }),
        )
        expect(res.status).toBe(200)
        expect(await entregasDe(id)).toEqual([
          expect.objectContaining({
            status: 'fallida',
            failedReason: 'Trabajo cancelado: Paciente desistió',
          }),
        ])
      })
    })
  })

  // Iteración 4, Tarea 3 (ENT-1, ENT-2): programar la recogida al crear y recibir el trabajo.
  describe('recogida', () => {
    async function crearPorRecoger(courierId = mensajeroId) {
      const res = await app.request(
        '/api/trabajos',
        req(recepcion, 'POST', caseInput({ recogida: { mensajeroId: courierId, fecha: hoy } })),
      )
      const { case: created } = (await res.json()) as { case: { id: string } }
      return created.id
    }

    it('POST /api/trabajos con recogida crea el trabajo por recoger (201) y su recogida pendiente', async () => {
      const res = await app.request(
        '/api/trabajos',
        req(recepcion, 'POST', caseInput({ recogida: { mensajeroId, fecha: hoy } })),
      )
      expect(res.status).toBe(201)
      const { case: created } = (await res.json()) as { case: { id: string; status: string } }
      expect(created.status).toBe('por_recoger')
      const filas = await ctx.db
        .select()
        .from(ctx.schema.deliveries)
        .where(eq(ctx.schema.deliveries.caseId, created.id))
      expect(filas).toEqual([
        expect.objectContaining({
          type: 'recogida',
          status: 'pendiente',
          courierId: mensajeroId,
          scheduledFor: hoy,
        }),
      ])
      const eventos = (await (
        await app.request(`/api/trabajos/${created.id}/eventos`, req(admin, 'GET'))
      ).json()) as { events: { type: string; toValue: string | null; reason: string | null }[] }
      expect(eventos.events.map((e) => e.type)).toEqual(['created', 'pickup_scheduled'])
      expect(eventos.events[1]).toMatchObject({ toValue: hoy, reason: 'Mensajero' })
    })

    it('responde 422 si el mensajero de la recogida no es un mensajero activo', async () => {
      const res = await app.request(
        '/api/trabajos',
        req(recepcion, 'POST', caseInput({ recogida: { mensajeroId: tecnicoId, fecha: hoy } })),
      )
      expect(res.status).toBe(422)
      expect(await res.json()).toEqual({
        message: 'Datos inválidos',
        issues: [{ path: 'recogida.mensajeroId', message: 'Elige un mensajero activo.' }],
      })
    })

    it('el mensajero de la recogida la recibe (200): el trabajo pasa a nuevo', async () => {
      const id = await crearPorRecoger()
      const res = await app.request(
        `/api/trabajos/${id}/acciones`,
        req(mensajero, 'POST', { accion: 'recibir' }),
      )
      expect(res.status).toBe(200)
      const { case: recibido } = (await res.json()) as { case: { status: string } }
      expect(recibido.status).toBe('nuevo')
      const [recogida] = await ctx.db
        .select()
        .from(ctx.schema.deliveries)
        .where(eq(ctx.schema.deliveries.caseId, id))
      expect(recogida).toMatchObject({ status: 'hecha', proofAttachmentId: null })
      expect(recogida!.doneAt).not.toBeNull()
    })

    it('otro mensajero no recibe una recogida que no es suya (403)', async () => {
      await createUser(ctx.auth, ctx.db, {
        email: 'mens2@t.local',
        password: 'Mensajero1!',
        name: 'Otro mensajero',
        role: 'mensajero',
      })
      const otro = await loginAs(app, 'mens2@t.local', 'Mensajero1!')
      const id = await crearPorRecoger()
      const res = await app.request(
        `/api/trabajos/${id}/acciones`,
        req(otro, 'POST', { accion: 'recibir' }),
      )
      expect(res.status).toBe(403)
    })

    it('el técnico no puede recibir (403)', async () => {
      const id = await crearPorRecoger()
      const res = await app.request(
        `/api/trabajos/${id}/acciones`,
        req(tecnico, 'POST', { accion: 'recibir' }),
      )
      expect(res.status).toBe(403)
    })

    it('cancelar un trabajo por recoger cierra su recogida: no queda ninguna pendiente', async () => {
      const id = await crearPorRecoger()
      const res = await app.request(
        `/api/trabajos/${id}/acciones`,
        req(recepcion, 'POST', { accion: 'cancelar', motivo: 'La clínica lo anuló' }),
      )
      expect(res.status).toBe(200)
      const filas = await ctx.db
        .select()
        .from(ctx.schema.deliveries)
        .where(eq(ctx.schema.deliveries.caseId, id))
      expect(filas).toEqual([
        expect.objectContaining({
          status: 'fallida',
          failedReason: 'Trabajo cancelado: La clínica lo anuló',
        }),
      ])
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
      const body = (await res.json()) as {
        case: { id: string; currentStageId: string; stage: { id: string; name: string } | null }
      }
      expect(body.case.currentStageId).toBe(stage2)
      // UX3-11: el toast dice a qué fase pasó («Fase: Cerámica»); la web no tiene que
      // resolver el id contra la lista de fases para nombrarla.
      expect(body.case.stage).toEqual({ id: stage2, name: 'Cerámica' })

      const eventos = (await (
        await app.request(`/api/trabajos/${id}/eventos`, req(admin, 'GET'))
      ).json()) as { events: { type: string }[] }
      expect(eventos.events.some((e) => e.type === 'stage_changed')).toBe(true)
    })

    // #97: mismo bloqueo de fila que las acciones. Con dos fases, dos «avanzar» simultáneos
    // desde la primera: el segundo espera, ve la última fase y recibe 409 en vez de repetir el
    // mismo salto (dos eventos stage_changed idénticos).
    it('dos avances simultáneos de fase: uno avanza (200) y el otro recibe 409', async () => {
      for (let intento = 0; intento < 10; intento++) {
        const { id } = await crearTrabajoEnProceso()
        const respuestas = await Promise.all(
          [0, 1].map(() =>
            app.request(`/api/trabajos/${id}/fase`, req(admin, 'PUT', { direccion: 'avanzar' })),
          ),
        )
        expect(respuestas.map((r) => r.status).sort()).toEqual([200, 409])
        const cambios = await ctx.db
          .select({ toValue: ctx.schema.caseEvents.toValue })
          .from(ctx.schema.caseEvents)
          .where(
            and(
              eq(ctx.schema.caseEvents.caseId, id),
              eq(ctx.schema.caseEvents.type, 'stage_changed'),
            ),
          )
        expect(cambios).toEqual([{ toValue: stage2 }])
      }
    })

    it('responde 409 al avanzar desde la última fase activa', async () => {
      const { id } = await crearTrabajoEnProceso()
      await app.request(`/api/trabajos/${id}/fase`, req(admin, 'PUT', { direccion: 'avanzar' }))
      const res = await app.request(
        `/api/trabajos/${id}/fase`,
        req(admin, 'PUT', { direccion: 'avanzar' }),
      )
      expect(res.status).toBe(409)
      expect(await res.json()).toEqual({
        message:
          'No se puede avanzar: el trabajo ya está en la última fase. Usa "Finalizar" para terminarlo.',
      })
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

    it('devuelve los técnicos ordenados por nombre', async () => {
      // Se insertan en orden inverso al alfabético: sin `orderBy`, Postgres los devuelve
      // en orden de inserción.
      await createUser(ctx.auth, ctx.db, {
        email: 'zoila@t.local',
        password: 'Tecnico123!',
        name: 'Zoila Técnico',
        role: 'tecnico',
      })
      await createUser(ctx.auth, ctx.db, {
        email: 'bruno@t.local',
        password: 'Tecnico123!',
        name: 'Bruno Técnico',
        role: 'tecnico',
      })
      const res = await app.request('/api/trabajos/tecnicos', req(admin, 'GET'))
      const body = (await res.json()) as { technicians: { name: string }[] }
      expect(body.technicians.map((t) => t.name)).toEqual([
        'Ana Técnico',
        'Bruno Técnico',
        'Zoila Técnico',
      ])
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

    // UX3-13: el técnico y el mensajero no consultan la lista de técnicos, así que la web
    // pintaba «Técnico» genérico para uno anterior (activo o no). `/eventos` trae los nombres.
    it('/eventos trae los nombres de origen y destino de cada asignación, también al técnico', async () => {
      const id = await createOne(recepcion)
      const otroId = await createUser(ctx.auth, ctx.db, {
        email: 'beto@t.local',
        password: 'Tecnico123!',
        name: 'Beto Técnico',
        role: 'tecnico',
      })
      await app.request(`/api/trabajos/${id}/tecnico`, req(admin, 'PUT', { tecnicoId }))
      await app.request(`/api/trabajos/${id}/tecnico`, req(admin, 'PUT', { tecnicoId: otroId }))
      // Beto deja el laboratorio: su nombre sigue en el historial.
      await ctx.db
        .update(ctx.schema.users)
        .set({ banned: true })
        .where(eq(ctx.schema.users.id, otroId))
      await app.request(`/api/trabajos/${id}/tecnico`, req(admin, 'PUT', { tecnicoId }))

      const eventos = (await (
        await app.request(`/api/trabajos/${id}/eventos`, req(tecnico, 'GET'))
      ).json()) as { events: { type: string; fromName: string | null; toName: string | null }[] }
      expect(
        eventos.events.filter((e) => e.type === 'assigned').map((e) => [e.fromName, e.toName]),
      ).toEqual([
        [null, 'Ana Técnico'],
        ['Ana Técnico', 'Beto Técnico'],
        ['Beto Técnico', 'Ana Técnico'],
      ])
      // Los demás eventos no llevan nombres.
      const created = eventos.events.find((e) => e.type === 'created')
      expect([created?.fromName, created?.toName]).toEqual([null, null])
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
        req(admin, 'POST', {
          accion: 'marcar_enviado',
          envio: { mensajeroId, fecha: hoy },
        }),
      )
      await app.request(
        `/api/trabajos/${id}/acciones`,
        req(admin, 'POST', { accion: 'marcar_entregado', constanciaId: await adjuntoDe(id) }),
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

    // I-2 (ola de fixes del PR 1, lote B): la ficha necesita enlazar la repetición en ambos
    // sentidos. El hijo ya expone `parentCaseId`; para mostrar "Repetición de {código}" en su
    // ficha falta el código del padre, que se añade como relación de solo lectura en `byId`.
    it('el hijo expone el código del padre en parentCase', async () => {
      const { id } = await crearTrabajoEntregado()
      const padre = (await (
        await app.request(`/api/trabajos/${id}`, req(admin, 'GET'))
      ).json()) as { case: { code: string } }
      const res = await app.request(`/api/trabajos/${id}/repetir`, req(admin, 'POST', remakeBody()))
      const { case: created } = (await res.json()) as { case: { id: string } }

      const ficha = (await (
        await app.request(`/api/trabajos/${created.id}`, req(admin, 'GET'))
      ).json()) as { case: { parentCase: { code: string } | null } }
      expect(ficha.case.parentCase).toEqual({ code: padre.case.code })
    })

    it('un trabajo sin padre expone parentCase nulo', async () => {
      const { id } = await crearTrabajoEntregado()
      const ficha = (await (
        await app.request(`/api/trabajos/${id}`, req(admin, 'GET'))
      ).json()) as { case: { parentCase: { code: string } | null } }
      expect(ficha.case.parentCase).toBeNull()
    })

    // El evento `remake_created` del padre guarda el código del hijo en `toValue`, pero un
    // código no es un enlace: `relatedCaseId` resuelve el id del trabajo hijo (join por código,
    // solo lectura, mismo patrón que un `repo.ts` sobre su propio schema) para que la ficha del
    // padre pueda enlazarlo en su historial.
    it('el evento remake_created del padre expone el id del hijo en relatedCaseId', async () => {
      const { id } = await crearTrabajoEntregado()
      const res = await app.request(`/api/trabajos/${id}/repetir`, req(admin, 'POST', remakeBody()))
      const { case: created } = (await res.json()) as { case: { id: string } }

      const eventosPadre = (await (
        await app.request(`/api/trabajos/${id}/eventos`, req(admin, 'GET'))
      ).json()) as { events: { type: string; relatedCaseId: string | null }[] }
      const evento = eventosPadre.events.find((e) => e.type === 'remake_created')
      expect(evento?.relatedCaseId).toBe(created.id)
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
      expect(await res.json()).toEqual({
        message:
          'No se puede repetir: el trabajo está en estado "Nuevo". Puede que otra persona lo haya cambiado.',
      })
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

  // T11 (#68): resumen del día por vista. `app` (el de todo el archivo) usa el reloj real del
  // sistema, así que "hoy" no es determinista para `vencen_hoy`/`atrasados`: esta app propia
  // con un reloj fijo (mismo patrón que `clock` en `createApp`, ver `app.ts`) es la que deja
  // fijar qué trabajo vence hoy y cuál está atrasado.
  describe('GET /api/trabajos/resumen', () => {
    const HOY = '2026-09-20'
    let resumenApp: ReturnType<typeof createApp>

    beforeAll(() => {
      resumenApp = createApp({
        auth: ctx.auth,
        db: ctx.db,
        webOrigin: ctx.config.WEB_ORIGIN,
        storage: ctx.storage,
        clock: { today: () => HOY, now: () => new Date(`${HOY}T12:00:00Z`) },
      })
    })

    // Ruling C1 (T11): si `/resumen` se declarara después de `/:id`, el segmento literal
    // "resumen" caería en el parámetro `:id` (que valida uuid) y respondería 422, no 200.
    it('responde 200 (no cae en /:id ni da 422 de uuid)', async () => {
      const r = await resumenApp.request('/api/trabajos/resumen', req(admin, 'GET'))
      expect(r.status).toBe(200)
    })

    // `requireAuth` a secas (no `requireRole`, mismo guardián que `/:id` y `/eventos`):
    // "sin sesión" es 401 aquí, no el 403 uniforme de las rutas con `requireRole`.
    it('401 sin sesión', async () => {
      const r = await resumenApp.request('/api/trabajos/resumen', req('', 'GET'))
      expect(r.status).toBe(401)
    })

    it('un técnico también lo ve: el resumen no lleva dinero', async () => {
      const r = await resumenApp.request('/api/trabajos/resumen', req(tecnico, 'GET'))
      expect(r.status).toBe(200)
    })

    // Criterio de aceptación de INI-1: cada contador de `resumen` coincide con el `total` que
    // devuelve `GET /api/trabajos?vista=<v>` para esa misma vista, para las 7 vistas — sin
    // números escritos a mano. Distribución no trivial (deliberada): al menos un trabajo por
    // vista salvo `atrasados`/`vencen_hoy`, que comparten sus dos `en_proceso` con `en_curso`.
    it('cada contador coincide con el total de la lista de su misma vista', async () => {
      await createOne(recepcion, { patientRef: 'Nuevo' })

      const venceHoyId = await createOne(recepcion, { patientRef: 'Vence hoy' })
      await ctx.db
        .update(ctx.schema.cases)
        .set({ status: 'en_proceso', promisedDate: HOY })
        .where(eq(ctx.schema.cases.id, venceHoyId))

      const atrasadoId = await createOne(recepcion, { patientRef: 'Atrasado' })
      await ctx.db
        .update(ctx.schema.cases)
        .set({ status: 'en_proceso', promisedDate: '2026-09-10' })
        .where(eq(ctx.schema.cases.id, atrasadoId))

      const enEsperaId = await createOne(recepcion, { patientRef: 'En espera' })
      await ctx.db
        .update(ctx.schema.cases)
        .set({ status: 'en_espera' })
        .where(eq(ctx.schema.cases.id, enEsperaId))

      const enPruebaId = await createOne(recepcion, { patientRef: 'En prueba' })
      await ctx.db
        .update(ctx.schema.cases)
        .set({ status: 'en_prueba' })
        .where(eq(ctx.schema.cases.id, enPruebaId))

      const terminadoId = await createOne(recepcion, { patientRef: 'Terminado' })
      await ctx.db
        .update(ctx.schema.cases)
        .set({ status: 'terminado' })
        .where(eq(ctx.schema.cases.id, terminadoId))

      const enviadoId = await createOne(recepcion, { patientRef: 'Enviado' })
      await ctx.db
        .update(ctx.schema.cases)
        .set({ status: 'enviado' })
        .where(eq(ctx.schema.cases.id, enviadoId))

      const entregadoId = await createOne(recepcion, { patientRef: 'Entregado' })
      await ctx.db
        .update(ctx.schema.cases)
        .set({ status: 'entregado' })
        .where(eq(ctx.schema.cases.id, entregadoId))

      const canceladoId = await createOne(recepcion, { patientRef: 'Cancelado' })
      await ctx.db
        .update(ctx.schema.cases)
        .set({ status: 'cancelado' })
        .where(eq(ctx.schema.cases.id, canceladoId))

      const resumenRes = await resumenApp.request('/api/trabajos/resumen', req(admin, 'GET'))
      expect(resumenRes.status).toBe(200)
      const { resumen } = (await resumenRes.json()) as { resumen: Record<string, number> }

      for (const vista of CASE_VIEWS) {
        const listaRes = await resumenApp.request(`/api/trabajos?vista=${vista}`, req(admin, 'GET'))
        const { total } = (await listaRes.json()) as { total: number }
        expect(resumen[vista]).toBe(total)
      }
      // Sanity: si todo diera 0 (p. ej. porque `/resumen` cayó en `/:id` y ambas listas
      // fallaran igual de silenciosas), la comparación de arriba pasaría igual. `todos` debe
      // ver los 9 trabajos creados en este test.
      expect(resumen.todos).toBe(9)
    })

    // I-1 (fix wave PR 2, #68): el test de arriba compara el contador con la lista, y ambos
    // salen de la misma `viewCondition` — prueba que coinciden, no que la definición sea
    // correcta. Este test fija la definición con reloj fijo (`HOY`): "atrasados" es un trabajo
    // **activo** cuya fecha efectiva (promised_date si existe, si no due_date) quedó antes de
    // hoy. Un trabajo cerrado (terminado/entregado/cancelado) nunca es atrasado aunque su fecha
    // esté vencida, y cuando hay `promised_date` esta manda sobre `due_date` aunque diverjan.
    it('atrasados: solo trabajos activos, por fecha efectiva (promised_date manda sobre due_date)', async () => {
      // Activo, promised_date pasada y due_date futura: la promesa manda → atrasado.
      const activoAtrasadoId = await createOne(recepcion, { patientRef: 'Activo atrasado' })
      await ctx.db
        .update(ctx.schema.cases)
        .set({ status: 'en_proceso', promisedDate: '2026-09-10', dueDate: '2026-12-01' })
        .where(eq(ctx.schema.cases.id, activoAtrasadoId))

      // Activo, promised_date futura y due_date pasada: la promesa manda → no atrasado.
      const activoNoAtrasadoId = await createOne(recepcion, { patientRef: 'Activo no atrasado' })
      await ctx.db
        .update(ctx.schema.cases)
        .set({ status: 'en_proceso', promisedDate: '2026-12-01', dueDate: '2026-09-01' })
        .where(eq(ctx.schema.cases.id, activoNoAtrasadoId))

      // Los demás estados activos, vencidos: también cuentan. Los estados se escriben a mano a
      // propósito y NO se derivan de `ACTIVE_FOR_DATES_STATUSES`: si el test los tomara de la
      // constante, quitar uno de la lista compartida lo quitaría también del test y nadie lo
      // notaría (hallazgo de la re-revisión de la ola del PR 2: sin estos casos, quitar
      // `en_espera` de la lista dejaba 66/66 en verde). `nuevo` no tiene fecha comprometida
      // (se fija al aceptar), así que cuenta por la deseada: cubre la otra rama del `coalesce`.
      const activosVencidos: { status: 'nuevo' | 'en_espera' | 'en_prueba'; id: string }[] = []
      for (const status of ['nuevo', 'en_espera', 'en_prueba'] as const) {
        const id = await createOne(recepcion, { patientRef: `Vencido ${status}` })
        await ctx.db
          .update(ctx.schema.cases)
          .set(
            status === 'nuevo'
              ? { status, promisedDate: null, dueDate: '2026-09-10' }
              : { status, promisedDate: '2026-09-10', dueDate: '2026-12-01' },
          )
          .where(eq(ctx.schema.cases.id, id))
        activosVencidos.push({ status, id })
      }

      // Cerrados con promised_date vencida: fuera de "atrasados" pase lo que pase con la fecha.
      const terminadoId = await createOne(recepcion, { patientRef: 'Terminado vencido' })
      await ctx.db
        .update(ctx.schema.cases)
        .set({ status: 'terminado', promisedDate: '2026-09-01' })
        .where(eq(ctx.schema.cases.id, terminadoId))

      const entregadoId = await createOne(recepcion, { patientRef: 'Entregado vencido' })
      await ctx.db
        .update(ctx.schema.cases)
        .set({ status: 'entregado', promisedDate: '2026-09-01' })
        .where(eq(ctx.schema.cases.id, entregadoId))

      const canceladoId = await createOne(recepcion, { patientRef: 'Cancelado vencido' })
      await ctx.db
        .update(ctx.schema.cases)
        .set({ status: 'cancelado', promisedDate: '2026-09-01' })
        .where(eq(ctx.schema.cases.id, canceladoId))

      const listaRes = await resumenApp.request('/api/trabajos?vista=atrasados', req(admin, 'GET'))
      expect(listaRes.status).toBe(200)
      const { cases: lista, total } = (await listaRes.json()) as {
        cases: { id: string }[]
        total: number
      }
      const ids = lista.map((c) => c.id)

      expect(ids).toContain(activoAtrasadoId)
      for (const { status, id } of activosVencidos) {
        expect(ids, `un trabajo ${status} vencido debe estar en atrasados`).toContain(id)
      }
      expect(ids).not.toContain(activoNoAtrasadoId)
      expect(ids).not.toContain(terminadoId)
      expect(ids).not.toContain(entregadoId)
      expect(ids).not.toContain(canceladoId)
      expect(total).toBe(4)

      const resumenRes = await resumenApp.request('/api/trabajos/resumen', req(admin, 'GET'))
      const { resumen } = (await resumenRes.json()) as { resumen: Record<string, number> }
      expect(resumen.atrasados).toBe(4)
    })
  })

  // Tarea 15 (FIC-2 #72, FIC-3 #73): ficha corta del QR, entra por código en vez de uuid.
  describe('GET /api/trabajos/codigo/:code', () => {
    it('devuelve el trabajo con la misma forma que GET /api/trabajos/:id', async () => {
      const id = await createOne(recepcion)
      const porId = (await (
        await app.request(`/api/trabajos/${id}`, req(admin, 'GET'))
      ).json()) as {
        case: { code: string }
      }
      const porCodigo = await app.request(
        `/api/trabajos/codigo/${porId.case.code}`,
        req(admin, 'GET'),
      )
      expect(porCodigo.status).toBe(200)
      const body = (await porCodigo.json()) as { case: { id: string; code: string } }
      expect(body.case.id).toBe(id)
      expect(body.case.code).toBe(porId.case.code)
    })

    it('entre varios trabajos devuelve el del código pedido, no otro', async () => {
      // Hallazgo I-2 de la revisión de la Tarea 15: con un solo trabajo en la BD, un `where`
      // ignorado en el repo devolvía "el primero" y el test seguía verde. Escanear un QR no
      // puede abrir el trabajo de otro paciente.
      await createOne(recepcion)
      const segundo = await createOne(recepcion)
      await createOne(recepcion)
      const { case: buscado } = (await (
        await app.request(`/api/trabajos/${segundo}`, req(admin, 'GET'))
      ).json()) as { case: { code: string } }

      const r = await app.request(`/api/trabajos/codigo/${buscado.code}`, req(admin, 'GET'))

      expect(r.status).toBe(200)
      expect(((await r.json()) as { case: { id: string } }).case.id).toBe(segundo)
    })

    it('404 con un código inexistente (formato válido)', async () => {
      const r = await app.request('/api/trabajos/codigo/26-99999', req(admin, 'GET'))
      expect(r.status).toBe(404)
      expect(await r.json()).toMatchObject({ message: 'No encontrado' })
    })

    it('422 con un código de formato inválido', async () => {
      const r = await app.request('/api/trabajos/codigo/no-es-un-codigo', req(admin, 'GET'))
      expect(r.status).toBe(422)
    })

    // Decisión del brief de la Tarea 15 (desviación documentada frente al plan, que decía 403):
    // `requireAuth` a secas, igual que `/:id` y `/resumen` — 401 sin sesión, no el 403 uniforme
    // de las rutas con `requireRole`.
    it('401 sin sesión', async () => {
      const id = await createOne(recepcion)
      const porId = (await (
        await app.request(`/api/trabajos/${id}`, req(admin, 'GET'))
      ).json()) as {
        case: { code: string }
      }
      const r = await app.request(`/api/trabajos/codigo/${porId.case.code}`, req('', 'GET'))
      expect(r.status).toBe(401)
    })

    it('un técnico no ve precios ni notas internas: total, precios de líneas y notas nulos', async () => {
      const id = await createOne(recepcion, { internalNotes: 'Nota interna confidencial' })
      const porId = (await (
        await app.request(`/api/trabajos/${id}`, req(admin, 'GET'))
      ).json()) as {
        case: { code: string }
      }
      const r = await app.request(`/api/trabajos/codigo/${porId.case.code}`, req(tecnico, 'GET'))
      expect(r.status).toBe(200)
      const body = (await r.json()) as {
        case: {
          total: string | null
          internalNotes: string | null
          items: { unitPrice: string | null }[]
        }
      }
      expect(body.case.total).toBeNull()
      expect(body.case.internalNotes).toBeNull()
      expect(body.case.items.every((i) => i.unitPrice === null)).toBe(true)
    })
  })
})
