import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from './app.ts'
import { setupTestDb } from './test/setup.ts'

let ctx: Awaited<ReturnType<typeof setupTestDb>>
let app: ReturnType<typeof createApp>
beforeAll(async () => {
  ctx = await setupTestDb()
  app = createApp({ auth: ctx.auth, webOrigin: ctx.config.WEB_ORIGIN })
})
afterAll(async () => {
  await ctx.pool.end()
})

describe('GET /api/health', () => {
  it('responde ok con timestamp ISO', async () => {
    const res = await app.request('/api/health')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok: boolean; ts: string }
    expect(body.ok).toBe(true)
    expect(new Date(body.ts).toISOString()).toBe(body.ts)
  })

  it('404 en JSON para rutas desconocidas bajo /api', async () => {
    const res = await app.request('/api/no-existe')
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ message: 'Recurso no encontrado' })
  })
})
