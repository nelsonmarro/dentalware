import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { validate } from './validate.ts'

describe('validate', () => {
  const app = new Hono().post(
    '/',
    validate('json', z.object({ name: z.string().min(1, { error: 'El nombre es obligatorio' }) })),
    (c) => c.json({ ok: true, name: c.req.valid('json').name }),
  )

  it('responde 422 con issues en español', async () => {
    const res = await app.request('/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '' }),
    })
    expect(res.status).toBe(422)
    expect(await res.json()).toEqual({
      message: 'Datos inválidos',
      issues: [{ path: 'name', message: 'El nombre es obligatorio' }],
    })
  })

  it('deja pasar datos válidos', async () => {
    const res = await app.request('/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Ana' }),
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, name: 'Ana' })
  })
})
