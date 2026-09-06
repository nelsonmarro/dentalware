import { describe, expect, expectTypeOf, it } from 'vitest'
import type { z } from 'zod'
import { caseInputSchema, caseItemSchema, caseListQuerySchema, commentSchema } from './cases.ts'

const clinicId = '11111111-1111-4111-8111-111111111111'
const doctorId = '22222222-2222-4222-8222-222222222222'
const productId = '33333333-3333-4333-8333-333333333333'
const base = () => ({
  clinicId,
  doctorId,
  patientRef: '  Paciente 12 ',
  receivedAt: '2026-09-06',
  items: [{ productId, quantity: 1, teeth: [12, 11] }],
})

describe('caseInputSchema', () => {
  it('acepta un trabajo mínimo, aplica valores por defecto y normaliza', () => {
    const r = caseInputSchema.parse(base())
    expect(r.patientRef).toBe('Paciente 12')
    expect(r.priority).toBe('normal')
    expect(r.checklist).toEqual({ antagonista: false, mordida: false, color: false, fotos: false })
    expect(r.items[0]).toMatchObject({
      quantity: 1,
      discountPct: 0,
      teeth: [11, 12],
      unitPrice: null,
    })
    expect(r.dueDate).toBeNull()
    expect(r.shade).toBeNull()
  })
  it('rechaza sin líneas, piezas inválidas, cantidad 0 y descuento > 100', () => {
    expect(caseInputSchema.safeParse({ ...base(), items: [] }).success).toBe(false)
    expect(
      caseInputSchema.safeParse({ ...base(), items: [{ productId, quantity: 1, teeth: [19] }] })
        .success,
    ).toBe(false)
    expect(
      caseInputSchema.safeParse({ ...base(), items: [{ productId, quantity: 0 }] }).success,
    ).toBe(false)
    expect(
      caseInputSchema.safeParse({
        ...base(),
        items: [{ productId, quantity: 1, discountPct: 101 }],
      }).success,
    ).toBe(false)
  })
  it('mensajes en español', () => {
    const r = caseInputSchema.safeParse({ ...base(), patientRef: '', items: [] })
    const msgs = r.success ? [] : r.error.issues.map((i) => i.message)
    expect(msgs).toContain('La referencia del paciente es obligatoria')
    expect(msgs).toContain('Agrega al menos una línea de trabajo')
  })
  it('acepta unitPrice explícito y fechas ISO', () => {
    const r = caseInputSchema.parse({
      ...base(),
      dueDate: '2026-09-15',
      items: [{ productId, quantity: 2, unitPrice: '40.00' }],
    })
    expect(r.items[0]!.unitPrice).toBe('40.00')
    expect(r.dueDate).toBe('2026-09-15')
    expect(caseInputSchema.safeParse({ ...base(), dueDate: '15/09/2026' }).success).toBe(false)
  })
})

describe('caseItemSchema', () => {
  it('teeth conserva number[] | undefined en z.input (formularios)', () => {
    expectTypeOf<z.input<typeof caseItemSchema>['teeth']>().toEqualTypeOf<number[] | undefined>()
  })
  it('sin teeth, aplica el arreglo vacío por defecto', () => {
    expect(caseItemSchema.parse({ productId, quantity: 1 })).toMatchObject({ teeth: [] })
  })
})

describe('caseListQuerySchema', () => {
  it('valores por defecto y coerción de página', () => {
    expect(caseListQuerySchema.parse({})).toEqual({ vista: 'todos', pagina: 1 })
    expect(caseListQuerySchema.parse({ pagina: '3', vista: 'atrasados' })).toMatchObject({
      pagina: 3,
      vista: 'atrasados',
    })
    expect(caseListQuerySchema.safeParse({ vista: 'x' }).success).toBe(false)
  })
})

describe('commentSchema', () => {
  it('exige texto', () => {
    expect(commentSchema.safeParse({ text: '   ' }).success).toBe(false)
    expect(commentSchema.parse({ text: ' hola ' })).toEqual({ text: 'hola' })
  })
})
