import { describe, expect, it } from 'vitest'
import { tryinInputSchema } from './tryins.ts'

describe('tryinInputSchema', () => {
  it('acepta una fecha de envío a prueba con nota opcional', () => {
    const r = tryinInputSchema.parse({ sentAt: '2026-09-19', note: 'Prueba de metal' })
    expect(r).toEqual({ sentAt: '2026-09-19', note: 'Prueba de metal' })
  })

  it('normaliza la nota vacía a null', () => {
    expect(tryinInputSchema.parse({ sentAt: '2026-09-19', note: '' }).note).toBeNull()
  })

  it('rechaza una fecha que no existe en el calendario', () => {
    const r = tryinInputSchema.safeParse({ sentAt: '2026-02-31' })
    expect(r.success).toBe(false)
  })
})
