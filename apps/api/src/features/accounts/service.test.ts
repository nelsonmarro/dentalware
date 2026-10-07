import { isSettled } from '@dentalware/shared'
import { describe, expect, it } from 'vitest'
import { ClinicAccountNotFoundError } from './errors.ts'
import {
  fakeAccountsRepo,
  type FakeAdjustment,
  type FakeAllocation,
  type FakeCase,
  type FakePayment,
} from './fakes.ts'
import type { ClinicRef } from './ports.ts'
import { createAccountsService } from './service.ts'

// Reloj fijo: "hoy" es 2026-10-06. Las entregas van a las 12:00 de Ecuador (17:00 UTC) para
// que su fecha de negocio no dependa de la zona del equipo que corre los tests.
const CLOCK = { today: () => '2026-10-06', now: () => new Date('2026-10-06T17:00:00Z') }
const at = (day: string) => new Date(`${day}T17:00:00Z`)
const ZERO = { '0_30': '0.00', '31_60': '0.00', '61_90': '0.00', '90_mas': '0.00' }

const SUR: ClinicRef = { id: 'cl-sur', name: 'Clínica Sur', active: true }
const NORTE: ClinicRef = { id: 'cl-norte', name: 'Clínica Norte', active: true }

function makeCase(over: Partial<FakeCase> & Pick<FakeCase, 'id'>): FakeCase {
  return {
    clinicId: SUR.id,
    code: `26-${over.id}`,
    patientRef: 'Paciente',
    status: 'entregado',
    deliveredAt: at('2026-09-01'),
    totalCents: 10_000,
    remakeChargePct: null,
    ...over,
  }
}

function makeAdjustment(
  over: Partial<FakeAdjustment> & Pick<FakeAdjustment, 'id' | 'amountCents'>,
): FakeAdjustment {
  return {
    clinicId: SUR.id,
    caseId: null,
    reason: 'Ajuste',
    date: '2026-10-01',
    createdAt: at('2026-10-01'),
    createdByName: 'Admin',
    ...over,
  }
}

function makePayment(
  over: Partial<FakePayment> & Pick<FakePayment, 'id' | 'amountCents'>,
): FakePayment {
  return {
    clinicId: SUR.id,
    method: 'transferencia',
    paidOn: '2026-10-02',
    reference: null,
    notes: null,
    createdAt: at('2026-10-02'),
    createdByName: 'Recepción',
    voided: null,
    ...over,
  }
}

function makeService(seed: Parameters<typeof fakeAccountsRepo>[0]) {
  return createAccountsService({
    accounts: fakeAccountsRepo({ clinics: [SUR, NORTE], ...seed }),
    clock: CLOCK,
  })
}

describe('features/accounts/service', () => {
  describe('cuenta de una clínica', () => {
    it('saldo = cargos de entregados y cobrados + ajustes − pagos vigentes', async () => {
      const service = makeService({
        cases: [
          makeCase({ id: 'a', totalCents: 10_000 }),
          makeCase({ id: 'b', totalCents: 5_000, status: 'cobrado' }),
          // No entregados: no cargan.
          makeCase({ id: 'c', totalCents: 7_000, status: 'en_proceso' }),
          makeCase({ id: 'd', totalCents: 7_000, status: 'enviado' }),
        ],
        adjustments: [
          makeAdjustment({ id: 'aj1', amountCents: 2_000 }),
          makeAdjustment({ id: 'aj2', amountCents: -1_000, caseId: 'a' }),
        ],
        payments: [makePayment({ id: 'p1', amountCents: 5_000 })],
        allocations: [{ paymentId: 'p1', caseId: 'b', amountCents: 5_000 }],
      })
      const account = await service.clinicAccount(SUR.id)
      // 100 + 50 + 20 − 10 − 50
      expect(account.balance).toBe('110.00')
      expect(account.credit).toBe('0.00')
      expect(account.clinic).toEqual({ id: SUR.id, name: 'Clínica Sur' })
    })

    it('una repetición carga su porcentaje, no su total', async () => {
      const service = makeService({
        cases: [makeCase({ id: 'r', totalCents: 10_000, remakeChargePct: 50 })],
      })
      const account = await service.clinicAccount(SUR.id)
      expect(account.balance).toBe('50.00')
      expect(account.openCases[0]?.charge).toBe('50.00')
    })

    it('un pago anulado no cuenta, ni sus asignaciones', async () => {
      const service = makeService({
        cases: [makeCase({ id: 'a', totalCents: 10_000 })],
        payments: [
          makePayment({ id: 'p1', amountCents: 3_000 }),
          makePayment({
            id: 'p2',
            amountCents: 4_000,
            voided: { at: at('2026-10-03'), byName: 'Admin', reason: 'Duplicado' },
          }),
        ],
        allocations: [
          { paymentId: 'p1', caseId: 'a', amountCents: 3_000 },
          { paymentId: 'p2', caseId: 'a', amountCents: 4_000 },
        ],
      })
      const account = await service.clinicAccount(SUR.id)
      expect(account.balance).toBe('70.00')
      expect(account.openCases).toEqual([
        expect.objectContaining({ id: 'a', allocated: '30.00', outstanding: '70.00' }),
      ])
    })

    it('lo no asignado de un pago vigente es saldo a favor y puede dejar el saldo en negativo', async () => {
      const service = makeService({
        cases: [makeCase({ id: 'a', totalCents: 2_000 })],
        payments: [makePayment({ id: 'p1', amountCents: 5_000 })],
        allocations: [{ paymentId: 'p1', caseId: 'a', amountCents: 2_000 }],
      })
      const account = await service.clinicAccount(SUR.id)
      expect(account.credit).toBe('30.00')
      expect(account.balance).toBe('-30.00')
      expect(account.aging).toEqual(ZERO)
      expect(account.oldestDays).toBeNull()
    })

    it('la antigüedad sale de agingBuckets: pendientes por entrega, ajustes sueltos y crédito al más antiguo', async () => {
      const service = makeService({
        cases: [
          // 35 días: 31–60
          makeCase({ id: 'a', totalCents: 10_000, deliveredAt: at('2026-09-01') }),
          // 100 días: más de 90
          makeCase({ id: 'b', totalCents: 4_000, deliveredAt: at('2026-06-28') }),
        ],
        adjustments: [
          // Saldo inicial de hace 70 días: 61–90.
          makeAdjustment({ id: 'aj1', amountCents: 1_500, date: '2026-07-28' }),
          makeAdjustment({ id: 'aj2', amountCents: -1_000 }),
        ],
        payments: [makePayment({ id: 'p1', amountCents: 2_000 })],
      })
      const account = await service.clinicAccount(SUR.id)
      // Lo que resta (10 del ajuste + 20 a favor) se come los 40 de «b» → 10 de «b» siguen.
      expect(account.aging).toEqual({
        '0_30': '0.00',
        '31_60': '100.00',
        '61_90': '15.00',
        '90_mas': '10.00',
      })
      expect(account.oldestDays).toBe(100)
      expect(account.balance).toBe('125.00')
    })

    it('«Por cobrar»: solo entregados con pendiente, de la entrega más antigua a la más nueva', async () => {
      const service = makeService({
        cases: [
          makeCase({ id: 'nuevo', code: '26-00009', deliveredAt: at('2026-10-05') }),
          makeCase({
            id: 'viejo',
            code: '26-00002',
            patientRef: 'Juan',
            deliveredAt: at('2026-09-06'),
            totalCents: 8_000,
          }),
          makeCase({ id: 'pagado', status: 'cobrado', totalCents: 1_000 }),
          makeCase({ id: 'gratis', totalCents: 1_000, remakeChargePct: 0 }),
        ],
        adjustments: [makeAdjustment({ id: 'aj', amountCents: 500, caseId: 'viejo' })],
        payments: [makePayment({ id: 'p1', amountCents: 3_000 })],
        allocations: [
          { paymentId: 'p1', caseId: 'viejo', amountCents: 2_000 },
          { paymentId: 'p1', caseId: 'pagado', amountCents: 1_000 },
        ],
      })
      const account = await service.clinicAccount(SUR.id)
      expect(account.openCases.map((c) => c.id)).toEqual(['viejo', 'nuevo'])
      expect(account.openCases[0]).toEqual({
        id: 'viejo',
        code: '26-00002',
        patientRef: 'Juan',
        deliveredAt: at('2026-09-06'),
        charge: '80.00',
        adjustments: '5.00',
        allocated: '20.00',
        outstanding: '65.00',
        days: 30,
      })
    })

    it('movimientos: cargos, ajustes y pagos con signo, quién y motivo; el anulado lleva voided', async () => {
      const service = makeService({
        cases: [
          makeCase({
            id: 'a',
            code: '26-00001',
            totalCents: 10_000,
            deliveredAt: at('2026-09-01'),
          }),
        ],
        adjustments: [
          makeAdjustment({
            id: 'aj1',
            amountCents: -1_000,
            caseId: 'a',
            reason: 'Descuento por demora',
            date: '2026-09-15',
            createdAt: at('2026-09-15'),
          }),
        ],
        payments: [
          makePayment({
            id: 'p1',
            amountCents: 3_000,
            method: 'cheque',
            reference: 'CH-77',
            notes: 'Pago parcial',
            paidOn: '2026-10-02',
          }),
          makePayment({
            id: 'p2',
            amountCents: 4_000,
            paidOn: '2026-09-20',
            createdAt: at('2026-09-20'),
            voided: { at: at('2026-09-21'), byName: 'Admin', reason: 'Duplicado' },
          }),
        ],
      })
      const { movements } = await service.clinicAccount(SUR.id)
      expect(movements).toEqual([
        {
          id: 'p1',
          kind: 'pago',
          date: '2026-10-02',
          amount: '-30.00',
          case: null,
          by: 'Recepción',
          reason: 'Pago parcial',
          reference: 'CH-77',
          method: 'cheque',
          voided: null,
        },
        {
          id: 'p2',
          kind: 'pago',
          date: '2026-09-20',
          amount: '-40.00',
          case: null,
          by: 'Recepción',
          reason: null,
          reference: null,
          method: 'transferencia',
          voided: { at: at('2026-09-21'), by: 'Admin', reason: 'Duplicado' },
        },
        {
          id: 'aj1',
          kind: 'ajuste',
          date: '2026-09-15',
          amount: '-10.00',
          case: { id: 'a', code: '26-00001' },
          by: 'Admin',
          reason: 'Descuento por demora',
          reference: null,
          method: null,
          voided: null,
        },
        {
          id: 'a',
          kind: 'cargo',
          date: '2026-09-01',
          amount: '100.00',
          case: { id: 'a', code: '26-00001' },
          by: null,
          reason: null,
          reference: null,
          method: null,
          voided: null,
        },
      ])
    })

    it('el mismo día, el movimiento registrado después va primero', async () => {
      const service = makeService({
        adjustments: [
          makeAdjustment({
            id: 'antes',
            amountCents: 100,
            createdAt: new Date('2026-10-01T14:00:00Z'),
          }),
          makeAdjustment({
            id: 'despues',
            amountCents: 200,
            createdAt: new Date('2026-10-01T15:00:00Z'),
          }),
        ],
      })
      const { movements } = await service.clinicAccount(SUR.id)
      expect(movements.map((m) => m.id)).toEqual(['despues', 'antes'])
    })

    it('solo cuenta lo de esa clínica', async () => {
      const service = makeService({
        cases: [
          makeCase({ id: 'a', totalCents: 10_000 }),
          makeCase({ id: 'n', clinicId: NORTE.id, totalCents: 9_900 }),
        ],
        payments: [makePayment({ id: 'p', clinicId: NORTE.id, amountCents: 1_000 })],
      })
      const account = await service.clinicAccount(SUR.id)
      expect(account.balance).toBe('100.00')
      expect(account.movements.map((m) => m.id)).toEqual(['a'])
    })

    it('una clínica que no existe lanza ClinicAccountNotFoundError', async () => {
      await expect(makeService({}).clinicAccount('no-existe')).rejects.toBeInstanceOf(
        ClinicAccountNotFoundError,
      )
    })
  })

  describe('cuadre del saldo (decisión 10)', () => {
    /** Generador pseudoaleatorio determinista (mulberry32): mismos escenarios en cada corrida. */
    function rng(seed: number) {
      let a = seed
      return (max: number) => {
        a = (a + 0x6d2b79f5) | 0
        let t = Math.imul(a ^ (a >>> 15), 1 | a)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * max)
      }
    }

    /** Escenario mixto válido: repeticiones, ajustes con y sin trabajo (de los dos signos),
     * pagos vigentes y anulados, asignaciones que nunca pasan del pendiente ni del pago, y el
     * estado de cada trabajo coherente con `isSettled`. */
    function scenario(seed: number) {
      const r = rng(seed)
      const days = ['2026-05-01', '2026-07-20', '2026-08-25', '2026-09-30', '2026-10-06']
      const cases: FakeCase[] = []
      const adjustments: FakeAdjustment[] = []
      const payments: FakePayment[] = []
      const allocations: FakeAllocation[] = []
      const outstanding = new Map<string, number>()
      for (let i = 0; i < 1 + r(6); i++) {
        const c = makeCase({
          id: `c${i}`,
          totalCents: 100 + r(20_000),
          remakeChargePct: r(3) === 0 ? [0, 30, 50, 100][r(4)]! : null,
          deliveredAt: at(days[r(days.length)]!),
        })
        cases.push(c)
        const charge =
          c.remakeChargePct === null
            ? c.totalCents
            : Math.round((c.totalCents * c.remakeChargePct) / 100)
        let pending = charge
        if (r(3) === 0 && pending > 0) {
          const cents = r(2) === 0 ? 1 + r(pending) : -(1 + r(pending))
          if (pending + cents >= 0) {
            adjustments.push(makeAdjustment({ id: `ac${i}`, amountCents: cents, caseId: c.id }))
            pending += cents
          }
        }
        outstanding.set(c.id, pending)
      }
      for (let i = 0; i < r(4); i++) {
        const cents = (r(2) === 0 ? 1 : -1) * (1 + r(5_000))
        adjustments.push(
          makeAdjustment({ id: `al${i}`, amountCents: cents, date: days[r(days.length)]! }),
        )
      }
      for (let i = 0; i < r(5); i++) {
        const amount = 1 + r(15_000)
        const isVoided = r(4) === 0
        payments.push(
          makePayment({
            id: `p${i}`,
            amountCents: amount,
            voided: isVoided ? { at: at('2026-10-05'), byName: 'Admin', reason: 'Error' } : null,
          }),
        )
        let left = amount
        for (const c of cases) {
          const pending = outstanding.get(c.id)!
          const take = Math.min(left, pending, r(2) === 0 ? pending : r(pending + 1))
          if (take <= 0) continue
          allocations.push({ paymentId: `p${i}`, caseId: c.id, amountCents: take })
          left -= take
          if (!isVoided) outstanding.set(c.id, pending - take)
        }
      }
      for (const c of cases) c.status = isSettled(outstanding.get(c.id)!) ? 'cobrado' : 'entregado'
      return { cases, adjustments, payments, allocations }
    }

    const cents = (s: string) => Math.round(Number(s) * 100)

    it.each(Array.from({ length: 60 }, (_, i) => i + 1))(
      'escenario %i: saldo = Σ pendientes + Σ ajustes sin trabajo − saldo a favor, y la antigüedad lo reparte',
      async (seed) => {
        const data = scenario(seed)
        const account = await makeService(data).clinicAccount(SUR.id)
        const freeAdjustments = data.adjustments
          .filter((a) => a.caseId === null)
          .reduce((s, a) => s + a.amountCents, 0)
        const pending = account.openCases.reduce((s, c) => s + cents(c.outstanding), 0)
        expect(cents(account.balance)).toBe(pending + freeAdjustments - cents(account.credit))
        // Por saldo = cargos + ajustes − pagos vigentes, calculado aparte.
        const charges = data.cases.reduce(
          (s, c) =>
            s +
            (c.remakeChargePct === null
              ? c.totalCents
              : Math.round((c.totalCents * c.remakeChargePct) / 100)),
          0,
        )
        const adjustments = data.adjustments.reduce((s, a) => s + a.amountCents, 0)
        const paid = data.payments.filter((p) => !p.voided).reduce((s, p) => s + p.amountCents, 0)
        expect(cents(account.balance)).toBe(charges + adjustments - paid)
        // La antigüedad reparte el saldo positivo; con saldo negativo, todo en cero.
        const aging = Object.values(account.aging).reduce((s, v) => s + cents(v), 0)
        expect(aging).toBe(Math.max(0, cents(account.balance)))
      },
    )
  })

  describe('lista de «Cuentas»', () => {
    const OESTE: ClinicRef = { id: 'cl-oeste', name: 'Clínica Oeste', active: true }
    const CERRADA: ClinicRef = { id: 'cl-cerrada', name: 'Clínica Cerrada', active: false }
    const VIEJA: ClinicRef = { id: 'cl-vieja', name: 'Clínica Vieja', active: false }

    function listService() {
      return createAccountsService({
        accounts: fakeAccountsRepo({
          clinics: [SUR, NORTE, OESTE, CERRADA, VIEJA],
          cases: [
            makeCase({ id: 's', clinicId: SUR.id, totalCents: 5_000 }),
            makeCase({
              id: 'n',
              clinicId: NORTE.id,
              totalCents: 20_000,
              deliveredAt: at('2026-06-01'),
            }),
            makeCase({ id: 'v', clinicId: VIEJA.id, totalCents: 1_000, status: 'cobrado' }),
          ],
          payments: [makePayment({ id: 'pv', clinicId: VIEJA.id, amountCents: 1_000 })],
          allocations: [{ paymentId: 'pv', caseId: 'v', amountCents: 1_000 }],
        }),
        clock: CLOCK,
      })
    }

    it('solo clínicas con saldo o movimientos, de mayor a menor saldo', async () => {
      const clinics = await listService().list({ todas: false })
      expect(clinics).toEqual([
        {
          id: NORTE.id,
          name: 'Clínica Norte',
          balance: '200.00',
          aging: { ...ZERO, '90_mas': '200.00' },
          oldestDays: 127,
        },
        {
          id: SUR.id,
          name: 'Clínica Sur',
          balance: '50.00',
          aging: { ...ZERO, '31_60': '50.00' },
          oldestDays: 35,
        },
        // Inactiva, pero con movimientos y saldo 0: se ve.
        { id: VIEJA.id, name: 'Clínica Vieja', balance: '0.00', aging: ZERO, oldestDays: null },
      ])
    })

    it('con todas, también las activas sin movimientos (nunca una inactiva sin ellos); a igual saldo, por nombre', async () => {
      const clinics = await listService().list({ todas: true })
      expect(clinics.map((c) => c.name)).toEqual([
        'Clínica Norte',
        'Clínica Sur',
        'Clínica Oeste',
        'Clínica Vieja',
      ])
      expect(clinics[2]).toEqual({
        id: OESTE.id,
        name: 'Clínica Oeste',
        balance: '0.00',
        aging: ZERO,
        oldestDays: null,
      })
    })
  })
})
