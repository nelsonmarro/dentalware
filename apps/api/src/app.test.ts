import { describe, expect, it } from 'vitest'
import { createApp } from './app.ts'

describe('GET /api/health', () => {
  it('responde ok con timestamp ISO', async () => {
    const app = createApp({})
    const res = await app.request('/api/health')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok: boolean; ts: string }
    expect(body.ok).toBe(true)
    expect(new Date(body.ts).toISOString()).toBe(body.ts)
  })

  it('404 en JSON para rutas desconocidas bajo /api', async () => {
    const app = createApp({})
    const res = await app.request('/api/no-existe')
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ message: 'Recurso no encontrado' })
  })
})
