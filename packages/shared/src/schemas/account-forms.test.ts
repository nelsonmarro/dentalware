import { describe, expect, it } from 'vitest'
import { adjustmentFormSchema, applyCreditFormSchema, paymentFormSchema } from './account-forms.ts'

const clinicaId = '11111111-1111-4111-8111-111111111111'
const trabajoA = '22222222-2222-4222-8222-222222222222'
const trabajoB = '33333333-3333-4333-8333-333333333333'

/** Mensaje y ruta de cada error, para fijar el texto en español y el campo. */
function issues(result: { success: boolean; error?: { issues: readonly unknown[] } }) {
  return (result.error?.issues ?? []).map((i) => {
    const issue = i as { message: string; path: PropertyKey[] }
    return { message: issue.message, path: issue.path }
  })
}

const pago = {
  clinicaId,
  monto: '100.00',
  metodo: 'transferencia',
  fecha: '2026-10-06',
  referencia: 'TRX-1',
  notas: '',
  asignaciones: [
    { trabajoId: trabajoA, monto: '60' },
    { trabajoId: trabajoB, monto: '' },
  ],
}

describe('paymentFormSchema (formulario «Registrar pago», CTA-2)', () => {
  it('quita del reparto las filas vacías y normaliza lo opcional', () => {
    const r = paymentFormSchema.safeParse(pago)
    expect(r.success).toBe(true)
    expect(r.data).toEqual({
      clinicaId,
      monto: '100.00',
      metodo: 'transferencia',
      fecha: '2026-10-06',
      referencia: 'TRX-1',
      notas: null,
      asignaciones: [{ trabajoId: trabajoA, monto: '60' }],
    })
  })

  it('acepta coma decimal en el monto y en cada fila', () => {
    const r = paymentFormSchema.safeParse({
      ...pago,
      monto: '100,5',
      asignaciones: [{ trabajoId: trabajoA, monto: ' 60,25 ' }],
    })
    expect(r.data?.monto).toBe('100.5')
    expect(r.data?.asignaciones).toEqual([{ trabajoId: trabajoA, monto: '60.25' }])
  })

  it('sin método elegido lo pide', () => {
    expect(issues(paymentFormSchema.safeParse({ ...pago, metodo: undefined }))).toEqual([
      { message: 'Elige un método de pago', path: ['metodo'] },
    ])
  })

  it('una fila con un monto inválido marca esa fila', () => {
    expect(
      issues(
        paymentFormSchema.safeParse({
          ...pago,
          asignaciones: [
            { trabajoId: trabajoA, monto: '' },
            { trabajoId: trabajoB, monto: '1.234' },
          ],
        }),
      ),
    ).toEqual([
      {
        message: 'El monto debe ser un número con hasta 2 decimales',
        path: ['asignaciones', 1, 'monto'],
      },
    ])
  })

  it('una fila en 0 marca esa fila', () => {
    expect(
      issues(
        paymentFormSchema.safeParse({
          ...pago,
          asignaciones: [{ trabajoId: trabajoA, monto: '0' }],
        }),
      ),
    ).toEqual([{ message: 'El monto debe ser mayor que 0', path: ['asignaciones', 0, 'monto'] }])
  })

  it('lo asignado no puede superar el monto del pago', () => {
    expect(
      issues(
        paymentFormSchema.safeParse({
          ...pago,
          asignaciones: [
            { trabajoId: trabajoA, monto: '60' },
            { trabajoId: trabajoB, monto: '40,01' },
          ],
        }),
      ),
    ).toEqual([
      { message: 'Lo asignado no puede superar el monto del pago', path: ['asignaciones'] },
    ])
  })

  // El formulario dice todo lo que falta de una vez: el reparto de más se avisa aunque falte el
  // método (en zod 4 un refine del objeto no corre si otro campo ya falló, salvo con `when`).
  it('avisa del reparto de más aunque falte el método', () => {
    expect(
      issues(
        paymentFormSchema.safeParse({
          ...pago,
          metodo: undefined,
          monto: '10',
          asignaciones: [{ trabajoId: trabajoA, monto: '20' }],
        }),
      ),
    ).toEqual([
      { message: 'Elige un método de pago', path: ['metodo'] },
      { message: 'Lo asignado no puede superar el monto del pago', path: ['asignaciones'] },
    ])
  })

  it('con el monto del pago inválido no compara el reparto', () => {
    expect(
      issues(
        paymentFormSchema.safeParse({
          ...pago,
          monto: 'abc',
          asignaciones: [{ trabajoId: trabajoA, monto: '20' }],
        }),
      ),
    ).toEqual([{ message: 'El monto debe ser un número con hasta 2 decimales', path: ['monto'] }])
  })

  it('un monto vacío o de 0 se rechaza', () => {
    expect(issues(paymentFormSchema.safeParse({ ...pago, monto: '' }))[0]).toEqual({
      message: 'El monto debe ser un número con hasta 2 decimales',
      path: ['monto'],
    })
    expect(issues(paymentFormSchema.safeParse({ ...pago, monto: '0' }))[0]).toEqual({
      message: 'El monto debe ser mayor que 0',
      path: ['monto'],
    })
  })
})

describe('applyCreditFormSchema (formulario «Aplicar saldo a favor», CTA-2)', () => {
  const schema = applyCreditFormSchema(5000)

  it('quita las filas vacías', () => {
    const r = schema.safeParse({
      asignaciones: [
        { trabajoId: trabajoA, monto: '' },
        { trabajoId: trabajoB, monto: '50' },
      ],
    })
    expect(r.data).toEqual({ asignaciones: [{ trabajoId: trabajoB, monto: '50' }] })
  })

  it('exige asignar algo a al menos un trabajo', () => {
    expect(
      issues(schema.safeParse({ asignaciones: [{ trabajoId: trabajoA, monto: '' }] })),
    ).toEqual([{ message: 'Asigna un monto a al menos un trabajo', path: ['asignaciones'] }])
  })

  it('no deja asignar más de lo que queda a favor', () => {
    expect(
      issues(schema.safeParse({ asignaciones: [{ trabajoId: trabajoA, monto: '50.01' }] })),
    ).toEqual([
      {
        message: 'Lo asignado no puede superar lo que queda a favor ($ 50.00)',
        path: ['asignaciones'],
      },
    ])
  })
})

describe('adjustmentFormSchema (formulario «Registrar ajuste», CTA-3)', () => {
  const ajuste = {
    clinicaId,
    signo: 'descuento',
    monto: '10',
    motivo: 'Acuerdo con la clínica',
    fecha: '2026-10-06',
    trabajoId: trabajoA,
  }

  it('un descuento sale con signo negativo, ligado a su trabajo', () => {
    expect(adjustmentFormSchema.safeParse(ajuste).data).toEqual({
      clinicaId,
      trabajoId: trabajoA,
      monto: '-10',
      motivo: 'Acuerdo con la clínica',
      fecha: '2026-10-06',
    })
  })

  it('un recargo sin trabajo sale positivo y con el trabajo en null', () => {
    expect(
      adjustmentFormSchema.safeParse({
        ...ajuste,
        signo: 'recargo',
        monto: '150,5',
        trabajoId: '',
        motivo: 'Saldo inicial',
      }).data,
    ).toEqual({
      clinicaId,
      trabajoId: null,
      monto: '150.5',
      motivo: 'Saldo inicial',
      fecha: '2026-10-06',
    })
  })

  it('pide elegir el signo', () => {
    expect(issues(adjustmentFormSchema.safeParse({ ...ajuste, signo: undefined }))).toEqual([
      { message: 'Elige si es un descuento o un recargo', path: ['signo'] },
    ])
  })

  it('exige el motivo y un monto mayor que 0', () => {
    expect(issues(adjustmentFormSchema.safeParse({ ...ajuste, motivo: '  ', monto: '0' }))).toEqual(
      [
        { message: 'El monto debe ser mayor que 0', path: ['monto'] },
        { message: 'Escribe el motivo', path: ['motivo'] },
      ],
    )
  })
})
