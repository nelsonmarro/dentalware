import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../../app.ts'
import { createUser, loginAs, setupTestDb, truncateAll } from '../../test/setup.ts'

describe('/api/config/doctores', () => {
  let ctx: Awaited<ReturnType<typeof setupTestDb>>
  let app: ReturnType<typeof createApp>
  let admin: string
  let clinicId: string

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
    admin = await loginAs(app, 'admin@t.local', 'Admin12345!')
    const [c] = await ctx.db.insert(ctx.schema.clinics).values({ name: 'Sonrisa' }).returning()
    clinicId = c!.id
  })
  afterAll(async () => {
    await ctx.pool.end()
  })
  const req = (method: string, body?: unknown) => ({
    method,
    headers: { 'content-type': 'application/json', cookie: admin, origin: ctx.config.WEB_ORIGIN },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  it('crea y filtra por clínica', async () => {
    const r = await app.request(
      '/api/config/doctores',
      req('POST', { clinicId, name: 'Dra. Paredes', email: 'PAREDES@Clinica.com' }),
    )
    expect(r.status).toBe(201)
    expect(((await r.json()) as { doctor: { email: string } }).doctor.email).toBe(
      'paredes@clinica.com',
    )
    const [other] = await ctx.db.insert(ctx.schema.clinics).values({ name: 'Otra' }).returning()
    await app.request(
      '/api/config/doctores',
      req('POST', { clinicId: other!.id, name: 'Dr. Ruiz' }),
    )
    const list = (await (
      await app.request(`/api/config/doctores?clinicId=${clinicId}`, req('GET'))
    ).json()) as { doctors: { name: string }[] }
    expect(list.doctors.map((d) => d.name)).toEqual(['Dra. Paredes'])
  })

  it('rechaza clínica inexistente con 422 y desactiva', async () => {
    const bad = await app.request(
      '/api/config/doctores',
      req('POST', { clinicId: '5f9a7b6e-2c4d-4e8f-9a1b-3c5d7e9f1a2b', name: 'Dr. X' }),
    )
    expect(bad.status).toBe(422)
    expect(await bad.json()).toMatchObject({ message: 'La clínica no existe' })
    const { doctor } = (await (
      await app.request('/api/config/doctores', req('POST', { clinicId, name: 'Dr. Y' }))
    ).json()) as { doctor: { id: string } }
    const off = await app.request(
      `/api/config/doctores/${doctor.id}/activo`,
      req('PATCH', { active: false }),
    )
    expect(((await off.json()) as { doctor: { active: boolean } }).doctor.active).toBe(false)
  })
})
