import { describe, expect, it } from 'vitest'
import {
  accountListQuerySchema,
  accountStatementQuerySchema,
  adjustmentInputSchema,
  applyCreditInputSchema,
  paymentInputSchema,
  voidPaymentInputSchema,
} from './accounts.ts'

const clinicaId = '11111111-1111-4111-8111-111111111111'
const trabajoA = '22222222-2222-4222-8222-222222222222'
const trabajoB = '33333333-3333-4333-8333-333333333333'

const pago = {
  clinicaId,
  monto: '100.00',
  metodo: 'transferencia',
  fecha: '2026-10-06',
  referencia: 'TRX-123',
  notas: null,
  asignaciones: [
    { trabajoId: trabajoA, monto: '60.00' },
    { trabajoId: trabajoB, monto: '40' },
  ],
}

/** Mensaje y ruta del primer error, para fijar el texto en español y el campo. */
function firstIssue(result: { success: boolean; error?: { issues: readonly unknown[] } }) {
  const issue = result.error?.issues[0] as { message: string; path: PropertyKey[] } | undefined
  return issue && { message: issue.message, path: issue.path }
}

describe('paymentInputSchema', () => {
  it('acepta un pago con sus asignaciones y normaliza lo opcional vacío a null', () => {
    const r = paymentInputSchema.safeParse({ ...pago, referencia: '  ', notas: undefined })
    expect(r.success).toBe(true)
    expect(r.data).toEqual({ ...pago, referencia: null, notas: null })
  })

  it('acepta un anticipo sin asignaciones', () => {
    expect(paymentInputSchema.safeParse({ ...pago, asignaciones: [] }).success).toBe(true)
  })

  it('rechaza un monto de 0', () => {
    expect(firstIssue(paymentInputSchema.safeParse({ ...pago, monto: '0.00' }))).toEqual({
      message: 'El monto debe ser mayor que 0',
      path: ['monto'],
    })
  })

  it('rechaza un monto negativo', () => {
    expect(firstIssue(paymentInputSchema.safeParse({ ...pago, monto: '-10.00' }))).toEqual({
      message: 'El monto debe ser un número con hasta 2 decimales',
      path: ['monto'],
    })
  })

  it('rechaza un monto con 3 decimales', () => {
    expect(firstIssue(paymentInputSchema.safeParse({ ...pago, monto: '10.005' }))).toEqual({
      message: 'El monto debe ser un número con hasta 2 decimales',
      path: ['monto'],
    })
  })

  it('rechaza una fecha que no es AAAA-MM-DD', () => {
    expect(paymentInputSchema.safeParse({ ...pago, fecha: '06/10/2026' }).success).toBe(false)
  })

  it('rechaza un método desconocido', () => {
    expect(firstIssue(paymentInputSchema.safeParse({ ...pago, metodo: 'bitcoin' }))).toEqual({
      message: 'Elige un método de pago',
      path: ['metodo'],
    })
  })

  it('rechaza una asignación de 0', () => {
    const r = paymentInputSchema.safeParse({
      ...pago,
      asignaciones: [{ trabajoId: trabajoA, monto: '0' }],
    })
    expect(firstIssue(r)).toEqual({
      message: 'El monto debe ser mayor que 0',
      path: ['asignaciones', 0, 'monto'],
    })
  })

  it('rechaza asignar más que el monto del pago', () => {
    const r = paymentInputSchema.safeParse({
      ...pago,
      asignaciones: [
        { trabajoId: trabajoA, monto: '60.00' },
        { trabajoId: trabajoB, monto: '40.01' },
      ],
    })
    expect(firstIssue(r)).toEqual({
      message: 'Lo aplicado no puede superar el monto del pago',
      path: ['asignaciones'],
    })
  })

  it('rechaza el mismo trabajo dos veces', () => {
    const r = paymentInputSchema.safeParse({
      ...pago,
      asignaciones: [
        { trabajoId: trabajoA, monto: '10.00' },
        { trabajoId: trabajoA, monto: '10.00' },
      ],
    })
    expect(firstIssue(r)).toEqual({
      message: 'Este trabajo ya está en el reparto',
      path: ['asignaciones', 1, 'trabajoId'],
    })
  })
})

describe('applyCreditInputSchema', () => {
  it('acepta asignaciones del saldo a favor', () => {
    expect(
      applyCreditInputSchema.safeParse({ asignaciones: [{ trabajoId: trabajoA, monto: '5.50' }] })
        .success,
    ).toBe(true)
  })

  it('exige al menos una asignación', () => {
    expect(firstIssue(applyCreditInputSchema.safeParse({ asignaciones: [] }))).toEqual({
      message: 'Elige al menos un trabajo',
      path: ['asignaciones'],
    })
  })

  it('rechaza el mismo trabajo dos veces', () => {
    const r = applyCreditInputSchema.safeParse({
      asignaciones: [
        { trabajoId: trabajoA, monto: '1.00' },
        { trabajoId: trabajoA, monto: '2.00' },
      ],
    })
    expect(firstIssue(r)?.path).toEqual(['asignaciones', 1, 'trabajoId'])
  })
})

describe('voidPaymentInputSchema', () => {
  it('exige el motivo', () => {
    expect(voidPaymentInputSchema.safeParse({ motivo: 'Pago duplicado' }).success).toBe(true)
    expect(firstIssue(voidPaymentInputSchema.safeParse({ motivo: '   ' }))).toEqual({
      message: 'Escribe el motivo',
      path: ['motivo'],
    })
    expect(voidPaymentInputSchema.safeParse({}).success).toBe(false)
  })
})

describe('adjustmentInputSchema', () => {
  const ajuste = {
    clinicaId,
    trabajoId: trabajoA,
    monto: '-15.50',
    motivo: 'Descuento acordado',
    fecha: '2026-10-06',
  }

  it('acepta un descuento (negativo) ligado a un trabajo', () => {
    expect(adjustmentInputSchema.safeParse(ajuste).data).toEqual(ajuste)
  })

  it('acepta un recargo (positivo) sin trabajo, como el saldo inicial', () => {
    const r = adjustmentInputSchema.safeParse({
      ...ajuste,
      trabajoId: undefined,
      monto: '350.00',
      motivo: 'Saldo inicial',
    })
    expect(r.data).toEqual({ ...ajuste, trabajoId: null, monto: '350.00', motivo: 'Saldo inicial' })
  })

  it('un trabajo vacío del formulario cuenta como sin trabajo', () => {
    expect(adjustmentInputSchema.safeParse({ ...ajuste, trabajoId: '' }).data?.trabajoId).toBe(null)
  })

  it('rechaza un monto de 0, también con signo', () => {
    for (const monto of ['0', '0.00', '-0.00']) {
      expect(firstIssue(adjustmentInputSchema.safeParse({ ...ajuste, monto }))).toEqual({
        message: 'El monto no puede ser 0',
        path: ['monto'],
      })
    }
  })

  it('rechaza un monto con 3 decimales', () => {
    expect(firstIssue(adjustmentInputSchema.safeParse({ ...ajuste, monto: '-1.005' }))).toEqual({
      message: 'El monto debe ser un número con hasta 2 decimales',
      path: ['monto'],
    })
  })

  it('exige el motivo', () => {
    expect(firstIssue(adjustmentInputSchema.safeParse({ ...ajuste, motivo: ' ' }))).toEqual({
      message: 'Escribe el motivo',
      path: ['motivo'],
    })
  })
})

describe('accountStatementQuerySchema', () => {
  it('acepta un rango y un solo día', () => {
    expect(
      accountStatementQuerySchema.safeParse({ desde: '2026-09-01', hasta: '2026-09-30' }).success,
    ).toBe(true)
    expect(
      accountStatementQuerySchema.safeParse({ desde: '2026-09-01', hasta: '2026-09-01' }).success,
    ).toBe(true)
  })

  it('rechaza desde posterior a hasta', () => {
    expect(
      firstIssue(
        accountStatementQuerySchema.safeParse({ desde: '2026-10-01', hasta: '2026-09-30' }),
      ),
    ).toEqual({
      message: 'La fecha final no puede ser anterior a la inicial',
      path: ['hasta'],
    })
  })

  it('exige ambas fechas', () => {
    expect(accountStatementQuerySchema.safeParse({ desde: '2026-09-01' }).success).toBe(false)
  })
})

describe('accountListQuerySchema', () => {
  it('sin parámetros, solo las clínicas con saldo o movimientos', () => {
    expect(accountListQuerySchema.parse({})).toEqual({ todas: false })
  })

  it('todas=1 pide todas las clínicas activas; todas=0, las de siempre', () => {
    expect(accountListQuerySchema.parse({ todas: '1' })).toEqual({ todas: true })
    expect(accountListQuerySchema.parse({ todas: '0' })).toEqual({ todas: false })
  })

  it('rechaza otro valor', () => {
    expect(accountListQuerySchema.safeParse({ todas: 'si' }).success).toBe(false)
  })
})
