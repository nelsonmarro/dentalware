import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../../app.ts'
import { createUser, loginAs, setupTestDb, truncateAll } from '../../test/setup.ts'

describe('/api/config/clinicas', () => {
  let ctx: Awaited<ReturnType<typeof setupTestDb>>
  let app: ReturnType<typeof createApp>
  let admin: string
  let recepcion: string

  beforeAll(async () => {
    ctx = await setupTestDb()
    app = createApp({ auth: ctx.auth, db: ctx.db, webOrigin: ctx.config.WEB_ORIGIN })
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
      email: 'rec@t.local',
      password: 'Recep12345!',
      name: 'Rec',
      role: 'recepcion',
    })
    admin = await loginAs(app, 'admin@t.local', 'Admin12345!')
    recepcion = await loginAs(app, 'rec@t.local', 'Recep12345!')
  })
  afterAll(async () => {
    await ctx.pool.end()
  })
  const req = (cookie: string, method: string, body?: unknown) => ({
    method,
    headers: { 'content-type': 'application/json', cookie, origin: ctx.config.WEB_ORIGIN },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  it('crea, lista ordenado por nombre y oculta inactivas por defecto', async () => {
    const a = await app.request(
      '/api/config/clinicas',
      req(admin, 'POST', { name: 'Zeta Dental', whatsapp: '+593991234567' }),
    )
    expect(a.status).toBe(201)
    const { clinic } = (await a.json()) as { clinic: { id: string; name: string; active: boolean } }
    expect(clinic.active).toBe(true)
    await app.request('/api/config/clinicas', req(admin, 'POST', { name: 'Alfa Dental' }))

    const list = (await (
      await app.request('/api/config/clinicas', req(recepcion, 'GET'))
    ).json()) as { clinics: { name: string }[] }
    expect(list.clinics.map((c) => c.name)).toEqual(['Alfa Dental', 'Zeta Dental'])

    const off = await app.request(
      `/api/config/clinicas/${clinic.id}/activo`,
      req(admin, 'PATCH', { active: false }),
    )
    expect(off.status).toBe(200)
    const list2 = (await (
      await app.request('/api/config/clinicas', req(recepcion, 'GET'))
    ).json()) as { clinics: { name: string }[] }
    expect(list2.clinics.map((c) => c.name)).toEqual(['Alfa Dental'])
    const list3 = (await (
      await app.request('/api/config/clinicas?incluirInactivos=true', req(recepcion, 'GET'))
    ).json()) as { clinics: unknown[] }
    expect(list3.clinics).toHaveLength(2)
  })

  it('recepción no puede escribir; admin edita; 404 si no existe', async () => {
    expect(
      (await app.request('/api/config/clinicas', req(recepcion, 'POST', { name: 'X' }))).status,
    ).toBe(403)
    const { clinic } = (await (
      await app.request('/api/config/clinicas', req(admin, 'POST', { name: 'Sonrisa' }))
    ).json()) as { clinic: { id: string } }
    const upd = await app.request(
      `/api/config/clinicas/${clinic.id}`,
      req(admin, 'PUT', { name: 'Clínica Sonrisa', city: 'Quito', paymentTermsDays: 30 }),
    )
    expect(upd.status).toBe(200)
    expect(
      ((await upd.json()) as { clinic: { name: string; paymentTermsDays: number } }).clinic,
    ).toMatchObject({ name: 'Clínica Sonrisa', paymentTermsDays: 30 })
    expect(
      (
        await app.request(
          '/api/config/clinicas/5f9a7b6e-2c4d-4e8f-9a1b-3c5d7e9f1a2b',
          req(admin, 'GET'),
        )
      ).status,
    ).toBe(404)
    expect((await app.request('/api/config/clinicas/no-uuid', req(admin, 'GET'))).status).toBe(422)
  })

  it('detalle incluye sus doctores', async () => {
    const { clinic } = (await (
      await app.request('/api/config/clinicas', req(admin, 'POST', { name: 'Sonrisa' }))
    ).json()) as { clinic: { id: string } }
    await app.request(
      '/api/config/doctores',
      req(admin, 'POST', { clinicId: clinic.id, name: 'Dra. Paredes' }),
    )
    const det = (await (
      await app.request(`/api/config/clinicas/${clinic.id}`, req(recepcion, 'GET'))
    ).json()) as { clinic: { doctors: { name: string }[] } }
    expect(det.clinic.doctors.map((d) => d.name)).toEqual(['Dra. Paredes'])
  })
})
