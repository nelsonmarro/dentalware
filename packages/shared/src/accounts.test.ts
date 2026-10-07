import { describe, expect, it } from 'vitest'
import {
  AGING_BUCKET_LABEL,
  AGING_BUCKETS,
  agingBuckets,
  caseChargeCents,
  caseOutstandingCents,
  daysBetween,
  isSettled,
  PAYMENT_METHOD_LABEL,
  PAYMENT_METHODS,
  suggestAllocation,
} from './accounts.ts'

describe('constantes de cuentas (Iteración 5)', () => {
  it('métodos de pago en orden', () => {
    expect(PAYMENT_METHODS).toEqual(['efectivo', 'transferencia', 'tarjeta', 'cheque', 'otro'])
  })

  it('rótulo de cada método de pago', () => {
    expect(PAYMENT_METHOD_LABEL).toEqual({
      efectivo: 'Efectivo',
      transferencia: 'Transferencia',
      tarjeta: 'Tarjeta',
      cheque: 'Cheque',
      otro: 'Otro',
    })
  })

  it('cubos de antigüedad en orden', () => {
    expect(AGING_BUCKETS).toEqual(['0_30', '31_60', '61_90', '90_mas'])
  })

  it('rótulo de cada cubo de antigüedad', () => {
    expect(AGING_BUCKET_LABEL).toEqual({
      '0_30': '0–30 días',
      '31_60': '31–60 días',
      '61_90': '61–90 días',
      '90_mas': 'Más de 90 días',
    })
  })
})

describe('caseChargeCents (decisión 4)', () => {
  it('un trabajo que no es repetición carga su total', () => {
    expect(caseChargeCents({ totalCents: 12_345, remakeChargePct: null })).toBe(12_345)
  })

  it('una repetición al 50 % de 100.00 carga 50.00', () => {
    expect(caseChargeCents({ totalCents: 10_000, remakeChargePct: 50 })).toBe(5_000)
  })

  it('una repetición al 0 % no carga nada', () => {
    expect(caseChargeCents({ totalCents: 10_000, remakeChargePct: 0 })).toBe(0)
  })

  it('una repetición al 100 % carga su total', () => {
    expect(caseChargeCents({ totalCents: 10_000, remakeChargePct: 100 })).toBe(10_000)
  })

  it('redondea medio centavo hacia arriba, como percentOfCents', () => {
    // 33 % de 0.05 = 1.65 centavos → 2; 50 % de 0.01 = 0.5 centavos → 1.
    expect(caseChargeCents({ totalCents: 5, remakeChargePct: 33 })).toBe(2)
    expect(caseChargeCents({ totalCents: 1, remakeChargePct: 50 })).toBe(1)
    // 33 % de 0.04 = 1.32 centavos → 1.
    expect(caseChargeCents({ totalCents: 4, remakeChargePct: 33 })).toBe(1)
  })
})

describe('caseOutstandingCents e isSettled (decisiones 1 y 5)', () => {
  it('pendiente = cargo + ajustes − asignado', () => {
    expect(caseOutstandingCents(10_000, 0, 0)).toBe(10_000)
    expect(caseOutstandingCents(10_000, 1_500, 4_000)).toBe(7_500)
    expect(caseOutstandingCents(10_000, -1_000, 4_000)).toBe(5_000)
  })

  it('un descuento que lleva el neto a 0 deja el trabajo cubierto sin pagos', () => {
    const outstanding = caseOutstandingCents(10_000, -10_000, 0)
    expect(outstanding).toBe(0)
    expect(isSettled(outstanding)).toBe(true)
  })

  it('un descuento mayor que el cargo deja el pendiente en negativo, cubierto', () => {
    const outstanding = caseOutstandingCents(10_000, -12_000, 0)
    expect(outstanding).toBe(-2_000)
    expect(isSettled(outstanding)).toBe(true)
  })

  it('cubierto cuando el pendiente es 0 o menos; no cubierto con un centavo pendiente', () => {
    expect(isSettled(0)).toBe(true)
    expect(isSettled(-1)).toBe(true)
    expect(isSettled(1)).toBe(false)
  })

  it('un pago exacto cubre el trabajo; uno parcial no', () => {
    expect(isSettled(caseOutstandingCents(10_000, 0, 10_000))).toBe(true)
    expect(isSettled(caseOutstandingCents(10_000, 0, 9_999))).toBe(false)
  })
})

describe('suggestAllocation (decisión 8)', () => {
  const open = [
    { caseId: 'c', code: '26-00003', deliveredAt: '2026-09-20', outstandingCents: 3_000 },
    { caseId: 'b', code: '26-00002', deliveredAt: '2026-09-10', outstandingCents: 2_000 },
    { caseId: 'a', code: '26-00001', deliveredAt: '2026-09-10', outstandingCents: 1_000 },
  ]

  it('reparte de la entrega más antigua a la más nueva y, a igualdad, por código', () => {
    expect(suggestAllocation(6_000, open)).toEqual([
      { caseId: 'a', amountCents: 1_000 },
      { caseId: 'b', amountCents: 2_000 },
      { caseId: 'c', amountCents: 3_000 },
    ])
  })

  it('corta en el monto del pago: el último recibe lo que queda', () => {
    expect(suggestAllocation(2_500, open)).toEqual([
      { caseId: 'a', amountCents: 1_000 },
      { caseId: 'b', amountCents: 1_500 },
    ])
  })

  it('nunca asigna más que el pendiente de un trabajo; el sobrante queda sin asignar', () => {
    expect(suggestAllocation(10_000, open)).toEqual([
      { caseId: 'a', amountCents: 1_000 },
      { caseId: 'b', amountCents: 2_000 },
      { caseId: 'c', amountCents: 3_000 },
    ])
  })

  it('sin trabajos abiertos no asigna nada', () => {
    expect(suggestAllocation(5_000, [])).toEqual([])
  })

  it('salta los trabajos sin pendiente', () => {
    expect(
      suggestAllocation(1_000, [
        { caseId: 'x', code: '26-00009', deliveredAt: '2026-09-01', outstandingCents: 0 },
        { caseId: 'y', code: '26-00010', deliveredAt: '2026-09-02', outstandingCents: 500 },
      ]),
    ).toEqual([{ caseId: 'y', amountCents: 500 }])
  })

  it('no cambia el orden de la lista que recibe', () => {
    const copy = open.map((o) => ({ ...o }))
    suggestAllocation(6_000, open)
    expect(open).toEqual(copy)
  })
})

describe('daysBetween', () => {
  it('cuenta los días de calendario entre dos fechas de negocio', () => {
    expect(daysBetween('2026-10-06', '2026-10-06')).toBe(0)
    expect(daysBetween('2026-09-30', '2026-10-06')).toBe(6)
    expect(daysBetween('2025-12-31', '2026-01-01')).toBe(1)
  })
})

describe('agingBuckets (decisión 9)', () => {
  const today = '2026-10-06'
  const zero = { '0_30': 0, '31_60': 0, '61_90': 0, '90_mas': 0 }

  it.each([
    ['2026-10-06', 0, '0_30'],
    ['2026-09-06', 30, '0_30'],
    ['2026-09-05', 31, '31_60'],
    ['2026-08-07', 60, '31_60'],
    ['2026-08-06', 61, '61_90'],
    ['2026-07-08', 90, '61_90'],
    ['2026-07-07', 91, '90_mas'],
  ] as const)('una partida del %s (%i días) cae en %s', (date, days, bucket) => {
    expect(daysBetween(date, today)).toBe(days)
    expect(agingBuckets({ today, charges: [{ date, cents: 1_000 }], credits: [] })).toEqual({
      ...zero,
      [bucket]: 1_000,
    })
  })

  it('suma las partidas del mismo cubo', () => {
    expect(
      agingBuckets({
        today,
        charges: [
          { date: '2026-10-01', cents: 1_000 },
          { date: '2026-09-20', cents: 500 },
          { date: '2026-06-01', cents: 200 },
        ],
        credits: [],
      }),
    ).toEqual({ ...zero, '0_30': 1_500, '90_mas': 200 })
  })

  it('el crédito consume primero la partida más antigua', () => {
    expect(
      agingBuckets({
        today,
        charges: [
          { date: '2026-10-01', cents: 1_000 },
          { date: '2026-08-20', cents: 2_000 },
          { date: '2026-06-01', cents: 1_500 },
        ],
        credits: [{ cents: 1_000 }, { cents: 1_000 }],
      }),
    ).toEqual({ '0_30': 1_000, '31_60': 1_500, '61_90': 0, '90_mas': 0 })
  })

  it('un crédito mayor que todo deja los cubos en cero', () => {
    expect(
      agingBuckets({
        today,
        charges: [
          { date: '2026-10-01', cents: 1_000 },
          { date: '2026-06-01', cents: 1_500 },
        ],
        credits: [{ cents: 5_000 }],
      }),
    ).toEqual(zero)
  })

  it('sin partidas, todo en cero', () => {
    expect(agingBuckets({ today, charges: [], credits: [{ cents: 300 }] })).toEqual(zero)
  })

  it('ignora partidas sin monto positivo: ningún cubo queda negativo', () => {
    expect(
      agingBuckets({
        today,
        charges: [
          { date: '2026-10-01', cents: -500 },
          { date: '2026-09-01', cents: 0 },
          { date: '2026-08-01', cents: 700 },
        ],
        credits: [],
      }),
    ).toEqual({ ...zero, '61_90': 700 })
  })

  it('una partida con fecha posterior a hoy cuenta como 0–30', () => {
    expect(
      agingBuckets({ today, charges: [{ date: '2026-10-10', cents: 400 }], credits: [] }),
    ).toEqual({ ...zero, '0_30': 400 })
  })
})
