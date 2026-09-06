import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../../app.ts'
import { createUser, loginAs, setupTestDb, truncateAll } from '../../test/setup.ts'
import { resolvePrice } from './repo.ts'

describe('/api/config/productos', () => {
  let ctx: Awaited<ReturnType<typeof setupTestDb>>
  let app: ReturnType<typeof createApp>
  let admin: string
  let tecnico: string
  let categoryId: string

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
      email: 'tec@t.local',
      password: 'Tecnico123!',
      name: 'Tec',
      role: 'tecnico',
    })
    admin = await loginAs(app, 'admin@t.local', 'Admin12345!')
    tecnico = await loginAs(app, 'tec@t.local', 'Tecnico123!')
    const r = await app.request(
      '/api/config/productos/categorias',
      req(admin, 'POST', { name: 'Prótesis fija', sort: 1 }),
    )
    categoryId = ((await r.json()) as { category: { id: string } }).category.id
  })
  afterAll(async () => {
    await ctx.pool.end()
  })
  function req(cookie: string, method: string, body?: unknown) {
    return {
      method,
      headers: { 'content-type': 'application/json', cookie, origin: ctx.config.WEB_ORIGIN },
      body: body === undefined ? undefined : JSON.stringify(body),
    }
  }
  const zirconio = () => ({
    code: 'ZR',
    name: 'Zirconio',
    categoryId,
    pricingUnit: 'por_pieza',
    basePrice: '45.00',
    turnaroundDays: 5,
    requiresTryIn: true,
  })

  it('técnico no ve productos ni precios (403)', async () => {
    expect((await app.request('/api/config/productos', req(tecnico, 'GET'))).status).toBe(403)
    expect(
      (await app.request('/api/config/productos/categorias', req(tecnico, 'GET'))).status,
    ).toBe(403)
  })

  it('crea producto con categoría, rechaza código duplicado y lista con categoría', async () => {
    const r = await app.request('/api/config/productos', req(admin, 'POST', zirconio()))
    expect(r.status).toBe(201)
    const dup = await app.request('/api/config/productos', req(admin, 'POST', zirconio()))
    expect(dup.status).toBe(409)
    expect(await dup.json()).toEqual({ message: 'Ya existe un producto con ese código' })
    const list = (await (await app.request('/api/config/productos', req(admin, 'GET'))).json()) as {
      products: { name: string; basePrice: string; category: { name: string } }[]
    }
    expect(list.products[0]).toMatchObject({
      name: 'Zirconio',
      basePrice: '45.00',
      category: { name: 'Prótesis fija' },
    })
  })

  it('precio por clínica: upsert, resolución y borrado', async () => {
    const { product } = (await (
      await app.request('/api/config/productos', req(admin, 'POST', zirconio()))
    ).json()) as { product: { id: string } }
    const [clinic] = await ctx.db.insert(ctx.schema.clinics).values({ name: 'Sonrisa' }).returning()
    expect(await resolvePrice(ctx.db, clinic!.id, product.id)).toBe('45.00')
    const up = await app.request(
      `/api/config/productos/precios/${clinic!.id}/${product.id}`,
      req(admin, 'PUT', { price: '40.50' }),
    )
    expect(up.status).toBe(200)
    expect(await resolvePrice(ctx.db, clinic!.id, product.id)).toBe('40.50')
    const list = (await (
      await app.request(`/api/config/productos/precios/${clinic!.id}`, req(admin, 'GET'))
    ).json()) as { prices: { productId: string; price: string }[] }
    expect(list.prices).toEqual([{ productId: product.id, price: '40.50' }])
    expect(
      (
        await app.request(
          `/api/config/productos/precios/${clinic!.id}/${product.id}`,
          req(admin, 'DELETE'),
        )
      ).status,
    ).toBe(204)
    expect(await resolvePrice(ctx.db, clinic!.id, product.id)).toBe('45.00')
  })

  it('categoría inexistente → 422; desactivar producto lo oculta', async () => {
    const bad = await app.request(
      '/api/config/productos',
      req(admin, 'POST', { ...zirconio(), categoryId: '5f9a7b6e-2c4d-4e8f-9a1b-3c5d7e9f1a2b' }),
    )
    expect(bad.status).toBe(422)
    expect(await bad.json()).toMatchObject({ message: 'La categoría no existe' })
    const { product } = (await (
      await app.request('/api/config/productos', req(admin, 'POST', zirconio()))
    ).json()) as { product: { id: string } }
    await app.request(
      `/api/config/productos/${product.id}/activo`,
      req(admin, 'PATCH', { active: false }),
    )
    const list = (await (await app.request('/api/config/productos', req(admin, 'GET'))).json()) as {
      products: unknown[]
    }
    expect(list.products).toHaveLength(0)
  })
})
