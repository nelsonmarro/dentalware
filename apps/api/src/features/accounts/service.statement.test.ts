import { describe, expect, it } from 'vitest'
import { AccountInputError, ClinicAccountNotFoundError } from './errors.ts'
import {
  fakeAccounts,
  type FakeAdjustment,
  type FakeCase,
  type FakeClinic,
  type FakePayment,
} from './fakes.ts'
import { createAccountsService } from './service.ts'

// Reloj fijo: "hoy" es 2026-10-06. Todo a las 12:00 de Ecuador (17:00 UTC), para que la fecha de
// negocio no dependa de la zona del equipo que corre los tests.
const CLOCK = { today: () => '2026-10-06', now: () => new Date('2026-10-06T17:00:00Z') }
const at = (day: string, hour = '17:00') => new Date(`${day}T${hour}:00Z`)

const SUR: FakeClinic = {
  id: 'cl-sur',
  name: 'Clínica Sur',
  active: true,
  ruc: '1790012345001',
  address: 'Av. Amazonas N34-120',
  city: 'Quito',
  phone: '0991234567',
}

const makeCase = (over: Partial<FakeCase> & Pick<FakeCase, 'id'>): FakeCase => ({
  clinicId: SUR.id,
  code: `26-${over.id}`,
  patientRef: `Paciente ${over.id}`,
  status: 'entregado',
  deliveredAt: at('2026-09-01'),
  totalCents: 10_000,
  remakeChargePct: null,
  ...over,
})

const makeAdjustment = (
  over: Partial<FakeAdjustment> & Pick<FakeAdjustment, 'id' | 'amountCents' | 'date'>,
): FakeAdjustment => ({
  clinicId: SUR.id,
  caseId: null,
  reason: 'Ajuste',
  createdAt: at(over.date),
  createdByName: 'Admin',
  ...over,
})

const makePayment = (
  over: Partial<FakePayment> & Pick<FakePayment, 'id' | 'amountCents' | 'paidOn'>,
): FakePayment => ({
  clinicId: SUR.id,
  method: 'transferencia',
  reference: null,
  notes: null,
  createdAt: at(over.paidOn),
  createdByName: 'Recepción',
  voided: null,
  ...over,
})

/**
 * Cuenta de ejemplo:
 * - «Saldo inicial» +200 el 01/08; «a» (100) entregado el 15/08; «b» (50) el 10/09 y «c» (80) el
 *   02/10, con un descuento de −10 el 04/10.
 * - p1 (60) el 05/09 a «a»; p2 (30) el 20/09, anulado; p3 (100) el 03/10: 40 a «a» y 50 a «b»
 *   (los dos quedan cobrados) y 10 a favor.
 */
function makeService(extra: Parameters<typeof fakeAccounts>[0] = {}) {
  const fake = fakeAccounts({
    clinics: [SUR],
    cases: [
      makeCase({ id: 'a', deliveredAt: at('2026-08-15'), status: 'cobrado' }),
      makeCase({ id: 'b', deliveredAt: at('2026-09-10'), totalCents: 5_000, status: 'cobrado' }),
      makeCase({ id: 'c', deliveredAt: at('2026-10-02'), totalCents: 8_000 }),
    ],
    adjustments: [
      makeAdjustment({
        id: 'aj-ini',
        amountCents: 20_000,
        date: '2026-08-01',
        reason: 'Saldo inicial',
      }),
      makeAdjustment({ id: 'aj-c', amountCents: -1_000, date: '2026-10-04', caseId: 'c' }),
    ],
    payments: [
      makePayment({ id: 'p1', amountCents: 6_000, paidOn: '2026-09-05' }),
      makePayment({
        id: 'p2',
        amountCents: 3_000,
        paidOn: '2026-09-20',
        voided: { at: at('2026-09-21'), byName: 'Admin', reason: 'Duplicado' },
      }),
      makePayment({ id: 'p3', amountCents: 10_000, paidOn: '2026-10-03' }),
    ],
    allocations: [
      { paymentId: 'p1', caseId: 'a', amountCents: 6_000 },
      { paymentId: 'p2', caseId: 'b', amountCents: 3_000 },
      { paymentId: 'p3', caseId: 'a', amountCents: 4_000 },
      { paymentId: 'p3', caseId: 'b', amountCents: 5_000 },
    ],
    ...extra,
  })
  return createAccountsService({ accounts: fake.repo, uow: fake.uow, clock: CLOCK })
}

describe('features/accounts/service — estado de cuenta (CTA-5)', () => {
  it('saldo inicial al cierre del día anterior, movimientos del rango con saldo corrido y saldo final', async () => {
    const s = await makeService().statement(SUR.id, { desde: '2026-09-01', hasta: '2026-09-30' })
    // Hasta el 31/08: «Saldo inicial» 200 + cargo de «a» 100.
    expect(s.openingBalance).toBe('300.00')
    expect(s.openingDate).toBe('2026-08-31')
    expect(
      s.movements.map((m) => [m.kind, m.id, m.date, m.amount, m.balance, m.voided !== null]),
    ).toEqual([
      ['pago', 'p1', '2026-09-05', '-60.00', '240.00', false],
      ['cargo', 'b', '2026-09-10', '50.00', '290.00', false],
      // Anulado: se lista tachado y no suma.
      ['pago', 'p2', '2026-09-20', '-30.00', '290.00', true],
    ])
    expect(s.totals).toEqual({ cargo: '50.00', ajuste: '0.00', pago: '-60.00' })
    expect(s.closingBalance).toBe('290.00')
    expect(s.range).toEqual({ desde: '2026-09-01', hasta: '2026-09-30' })
  })

  it('la cabecera trae los datos de la clínica', async () => {
    const s = await makeService().statement(SUR.id, { desde: '2026-09-01', hasta: '2026-09-30' })
    expect(s.clinic).toEqual({
      id: SUR.id,
      name: 'Clínica Sur',
      ruc: '1790012345001',
      address: 'Av. Amazonas N34-120',
      city: 'Quito',
      phone: '0991234567',
    })
  })

  it('antigüedad y «Por cobrar» a la fecha hasta, con lo asignado hasta entonces', async () => {
    const s = await makeService().statement(SUR.id, { desde: '2026-09-01', hasta: '2026-09-30' })
    // Al 30/09, «a» debía 40 (p3 llegó después) y «b» 50, aunque hoy estén cobrados.
    expect(s.openCases.map((c) => [c.id, c.outstanding, c.days])).toEqual([
      ['a', '40.00', 46],
      ['b', '50.00', 20],
    ])
    // «Saldo inicial» del 01/08 (60 días) y «a» (46 días): 31–60; «b»: 0–30.
    expect(s.aging).toEqual({
      '0_30': '50.00',
      '31_60': '240.00',
      '61_90': '0.00',
      '90_mas': '0.00',
    })
    expect(s.oldestDays).toBe(60)
    expect(s.credit).toBe('0.00')
  })

  it('con hasta = hoy, cuadra con la cuenta de la clínica (CTA-1)', async () => {
    const service = makeService()
    const s = await service.statement(SUR.id, { desde: '2026-10-01', hasta: '2026-10-06' })
    const account = await service.clinicAccount(SUR.id)
    expect(s.openingBalance).toBe('290.00')
    expect(s.movements.map((m) => [m.id, m.amount, m.balance])).toEqual([
      ['c', '80.00', '370.00'],
      ['p3', '-100.00', '270.00'],
      ['aj-c', '-10.00', '260.00'],
    ])
    expect(s.closingBalance).toBe('260.00')
    expect(s.closingBalance).toBe(account.balance)
    expect(s.credit).toBe(account.credit)
    expect(s.aging).toEqual(account.aging)
    expect(s.oldestDays).toBe(account.oldestDays)
    expect(s.openCases).toEqual(account.openCases)
    expect(s.breakdown).toEqual(account.breakdown)
  })

  it('trae el desglose del saldo a la fecha hasta (UX5-02): trabajos + ajustes sin trabajo − a favor', async () => {
    const s = await makeService().statement(SUR.id, { desde: '2026-09-01', hasta: '2026-09-30' })
    // Al 30/09: «a» debe 40 (100 − 60 de p1) y «b» 50 (p2 anulado); p3 aún no existe.
    expect(s.breakdown).toEqual({
      openCases: '90.00',
      unlinkedAdjustments: '200.00',
      unlinkedSince: '2026-08-01',
      credit: '0.00',
      balance: '290.00',
    })
    expect(s.breakdown.balance).toBe(s.closingBalance)
  })

  it('el desglose a hoy cuenta el saldo a favor que dejó un pago', async () => {
    const s = await makeService().statement(SUR.id, { desde: '2026-10-01', hasta: '2026-10-06' })
    // «c» debe 70 (80 − 10); p3 dejó 10 a favor.
    expect(s.breakdown).toEqual({
      openCases: '70.00',
      unlinkedAdjustments: '200.00',
      unlinkedSince: '2026-08-01',
      credit: '10.00',
      balance: '260.00',
    })
  })

  it('el mismo día, los movimientos van en el orden en que se registraron', async () => {
    const service = makeService({
      clinics: [SUR],
      cases: [makeCase({ id: 'x', deliveredAt: at('2026-09-10', '15:00'), totalCents: 5_000 })],
      adjustments: [
        makeAdjustment({
          id: 'aj',
          amountCents: 1_000,
          date: '2026-09-10',
          createdAt: at('2026-09-10', '16:00'),
        }),
      ],
      payments: [
        makePayment({
          id: 'p',
          amountCents: 2_000,
          paidOn: '2026-09-10',
          createdAt: at('2026-09-10', '18:00'),
        }),
      ],
      allocations: [],
    })
    const s = await service.statement(SUR.id, { desde: '2026-09-10', hasta: '2026-09-10' })
    expect(s.movements.map((m) => [m.id, m.balance])).toEqual([
      ['x', '50.00'],
      ['aj', '60.00'],
      ['p', '40.00'],
    ])
  })

  it('un pago con fecha anterior a la entrega del trabajo al que se asignó queda a favor hasta esa entrega', async () => {
    const service = makeService({
      clinics: [SUR],
      cases: [
        makeCase({ id: 'x', deliveredAt: at('2026-10-02'), totalCents: 5_000, status: 'cobrado' }),
      ],
      adjustments: [],
      payments: [makePayment({ id: 'p', amountCents: 5_000, paidOn: '2026-09-25' })],
      allocations: [{ paymentId: 'p', caseId: 'x', amountCents: 5_000 }],
    })
    const s = await service.statement(SUR.id, { desde: '2026-09-01', hasta: '2026-09-30' })
    expect(s.closingBalance).toBe('-50.00')
    expect(s.credit).toBe('50.00')
    expect(s.openCases).toEqual([])
  })

  it('un ajuste ligado a un trabajo cuenta en su pendiente solo desde su fecha', async () => {
    const service = makeService({
      clinics: [SUR],
      cases: [makeCase({ id: 'x', deliveredAt: at('2026-09-01'), totalCents: 5_000 })],
      adjustments: [
        makeAdjustment({ id: 'aj', amountCents: -1_000, date: '2026-10-01', caseId: 'x' }),
      ],
      payments: [],
      allocations: [],
    })
    const before = await service.statement(SUR.id, { desde: '2026-09-01', hasta: '2026-09-30' })
    expect(before.openCases.map((c) => [c.outstanding, c.adjustments])).toEqual([['50.00', '0.00']])
    const after = await service.statement(SUR.id, { desde: '2026-10-01', hasta: '2026-10-06' })
    expect(after.openCases.map((c) => [c.outstanding, c.adjustments])).toEqual([
      ['40.00', '-10.00'],
    ])
  })

  // I-2 de la revisión final del PR 2: con `hasta` futura, la antigüedad y los días de «Por
  // cobrar» saldrían proyectados a esa fecha en un papel que va a la clínica. Como las fechas de
  // pagos y ajustes, `hasta` no puede ser posterior a hoy (reloj del servicio).
  it('una fecha final posterior a hoy: 422 en hasta', async () => {
    const err = await makeService()
      .statement(SUR.id, { desde: '2026-10-01', hasta: '2026-10-07' })
      .catch((e: unknown) => e)
    expect(err).toBeInstanceOf(AccountInputError)
    expect(err).toMatchObject({
      path: 'hasta',
      message: 'La fecha final no puede ser posterior a hoy',
    })
  })

  it('hasta = hoy sí se acepta', async () => {
    const s = await makeService().statement(SUR.id, { desde: '2026-10-01', hasta: '2026-10-06' })
    expect(s.range.hasta).toBe('2026-10-06')
  })

  it('una clínica que no existe: ClinicAccountNotFoundError', async () => {
    await expect(
      makeService().statement('no-existe', { desde: '2026-09-01', hasta: '2026-09-30' }),
    ).rejects.toBeInstanceOf(ClinicAccountNotFoundError)
  })
})
