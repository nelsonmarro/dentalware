import {
  caseChargeCents,
  caseOutstandingCents,
  fromCents,
  fromSignedCents,
  isBilled,
  isSettled,
  PAYMENT_METHODS,
  suggestAllocation,
  type AllocationInput,
} from '@dentalware/shared'
import { describe, expect, it } from 'vitest'
import { AccountBusyError, AccountInputError, PaymentVoidedError } from './errors.ts'
import { fakeAccounts, type FakeCase } from './fakes.ts'
import type { ClinicRef } from './ports.ts'
import { createAccountsService } from './service.ts'

// Test de propiedad de cuentas (hallazgo M3 de la revisión final del PR 1): secuencias
// aleatorias de operaciones reales del servicio (entregar, pagar, aplicar saldo a favor, anular
// y ajustar), con fakes y reloj fijo, comprobando los invariantes después de cada paso. A
// diferencia del test de `service.test.ts`, nada se siembra ya escrito: todo pasa por el
// servicio, también las combinaciones como pagar, liberar con un descuento, aplicar a otro
// trabajo y anular.

const CLOCK = { today: () => '2026-10-06', now: () => new Date('2026-10-06T17:00:00Z') }
const at = (day: string) => new Date(`${day}T17:00:00Z`)
const DAYS = ['2026-05-01', '2026-07-20', '2026-08-25', '2026-09-30', '2026-10-06']
const TOMORROW = '2026-10-07'

const SUR: ClinicRef = { id: 'cl-sur', name: 'Clínica Sur', active: true }
const NORTE: ClinicRef = { id: 'cl-norte', name: 'Clínica Norte', active: true }
const CLINICS = [SUR, NORTE]

const admin = { userId: 'u-admin', role: 'admin' } as const
const recepcion = { userId: 'u-recep', role: 'recepcion' } as const

const SEEDS = Array.from({ length: 200 }, (_, i) => i + 1)
const STEPS = 25

const cents = (s: string) => Math.round(Number(s) * 100)
const sum = (list: readonly number[]) => list.reduce((a, b) => a + b, 0)

/** Generador pseudoaleatorio determinista (mulberry32): mismas secuencias en cada corrida. */
function rng(seed: number) {
  let a = seed
  const next = (max: number) => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * max)
  }
  const pick = <T>(list: readonly T[]): T => list[next(list.length)]!
  return { next, pick }
}

type Stats = {
  ok: Record<OpKind, number>
  rejected422: number
  rejected409: number
  skipped: number
  released: number
  reopenedByAdjustment: number
  reopenedByVoid: number
  settledByAdjustment: number
  settledOnDelivery: number
}

const OPS = ['nuevo', 'entregar', 'pagar', 'aplicar', 'anular', 'ajustar'] as const
type OpKind = (typeof OPS)[number]
/** Peso de cada operación en el sorteo. */
const WEIGHTS: Record<OpKind, number> = {
  nuevo: 1,
  entregar: 3,
  pagar: 4,
  aplicar: 2,
  anular: 1,
  ajustar: 4,
}
const BAG = OPS.flatMap((op) => Array.from({ length: WEIGHTS[op] }, () => op))

/** Ejecuta una secuencia y comprueba los invariantes tras cada paso; devuelve qué cubrió. */
async function run(seed: number): Promise<Stats> {
  const r = rng(seed)
  const fake = fakeAccounts({ clinics: CLINICS })
  const service = createAccountsService({ accounts: fake.repo, uow: fake.uow, clock: CLOCK })
  const stats: Stats = {
    ok: { nuevo: 0, entregar: 0, pagar: 0, aplicar: 0, anular: 0, ajustar: 0 },
    rejected422: 0,
    rejected409: 0,
    skipped: 0,
    released: 0,
    reopenedByAdjustment: 0,
    reopenedByVoid: 0,
    settledByAdjustment: 0,
    settledOnDelivery: 0,
  }
  const log: string[] = []
  let nextCase = 0

  const caseNet = async (c: FakeCase) =>
    caseChargeCents(c) +
    sum(
      (await fake.repo.adjustments()).filter((a) => a.case?.id === c.id).map((a) => a.amountCents),
    )
  const openOf = async (clinicId: string) =>
    (await service.clinicAccount(clinicId)).openCases.map((c) => ({
      caseId: c.id,
      code: c.code,
      deliveredAt: c.deliveredAt.toISOString(),
      outstandingCents: cents(c.outstanding),
    }))
  const toInput = (list: readonly { caseId: string; amountCents: number }[]): AllocationInput[] =>
    list.map((a) => ({ trabajoId: a.caseId, monto: fromCents(a.amountCents) }))
  const otherClinic = (id: string) => (id === SUR.id ? NORTE.id : SUR.id)
  const statuses = () => new Map(fake.cases.map((c) => [c.id, c.status]))
  /** Todo lo que escribe el servicio: un rechazo (422/409) no puede cambiar nada. */
  const snapshot = async () =>
    JSON.stringify({
      cases: fake.cases.map((c) => [c.id, c.status]),
      payments: fake.payments.map((p) => [p.id, p.voided !== null]),
      allocations: fake.allocations.map((a) => [a.id, a.amountCents]),
      adjustments: (await fake.repo.adjustments()).map((a) => a.id),
      events: fake.events.length,
    })

  /** Un trabajo nuevo: `en_proceso` (aún no carga a la cuenta) o ya entregado. */
  function newCase(delivered: boolean): FakeCase {
    const n = nextCase++
    const c: FakeCase = {
      id: `k${n}`,
      code: `26-${String(n).padStart(5, '0')}`,
      clinicId: r.next(5) === 0 ? NORTE.id : SUR.id,
      patientRef: 'Paciente',
      status: 'en_proceso',
      deliveredAt: at(r.pick(DAYS)),
      totalCents: r.next(6) === 0 ? 0 : 100 + r.next(20_000),
      remakeChargePct: r.next(3) === 0 ? r.pick([0, 30, 50, 100]) : null,
    }
    fake.cases.push(c)
    if (delivered) deliver(c)
    return c
  }

  /** «Marcar entregado» (`cases`): sin nada que cobrar, el trabajo queda `cobrado` (misma regla
   * de shared que `settledOnDelivery`); si no, `entregado`. */
  function deliver(c: FakeCase) {
    c.deliveredAt = at(r.pick(DAYS))
    const settled = isSettled(caseOutstandingCents(caseChargeCents(c), 0, 0))
    c.status = settled ? 'cobrado' : 'entregado'
    if (settled) stats.settledOnDelivery += 1
  }

  /** Un paso: devuelve `false` si no había nada sobre qué hacerlo. */
  async function step(op: OpKind): Promise<boolean> {
    switch (op) {
      case 'nuevo': {
        const c = newCase(false)
        log.push(`nuevo ${c.id}`)
        return true
      }
      case 'entregar': {
        const pending = fake.cases.filter((c) => c.status === 'en_proceso')
        if (pending.length > 0 && r.next(2) === 0) {
          const c = r.pick(pending)
          deliver(c)
          log.push(`entregar ${c.id} → ${c.status}`)
        } else {
          const c = newCase(true)
          log.push(`entregar nuevo ${c.id} (${caseChargeCents(c)}) → ${c.status}`)
        }
        return true
      }
      case 'pagar': {
        const clinicId = r.next(6) === 0 ? NORTE.id : SUR.id
        const open = await openOf(clinicId)
        let amount = 1 + r.next(30_000)
        let list: { caseId: string; amountCents: number }[]
        switch (r.next(5)) {
          case 0: // Reparto sugerido completo.
            list = suggestAllocation(amount, open)
            break
          case 1: // Reparto parcial: parte del sugerido, lo demás a favor.
            list = suggestAllocation(amount, open).slice(0, r.next(3))
            break
          case 2: {
            // Trabajos al azar con montos al azar dentro de su pendiente.
            list = open
              .filter(() => r.next(2) === 0)
              .map((c) => ({ caseId: c.caseId, amountCents: 1 + r.next(c.outstandingCents) }))
            amount = Math.max(amount, sum(list.map((a) => a.amountCents)))
            break
          }
          case 3: // Anticipo sin reparto.
            list = []
            break
          default: {
            // Cualquier trabajo (otra clínica, sin entregar, cobrado) y cualquier monto: el
            // servicio puede rechazarlo.
            if (fake.cases.length === 0) return false
            list = [{ caseId: r.pick(fake.cases).id, amountCents: 1 + r.next(amount) }]
          }
        }
        const fecha = r.next(15) === 0 ? TOMORROW : r.pick(DAYS)
        log.push(`pagar ${clinicId} ${amount} ${JSON.stringify(list)} ${fecha}`)
        await service.registerPayment(
          {
            clinicaId: clinicId,
            monto: fromCents(amount),
            metodo: r.pick(PAYMENT_METHODS),
            fecha,
            referencia: null,
            notas: null,
            asignaciones: toInput(list),
          },
          r.next(2) === 0 ? admin : recepcion,
        )
        return true
      }
      case 'aplicar': {
        if (fake.payments.length === 0) return false
        // Casi siempre un pago con saldo a favor; a veces cualquiera (anulado: 409).
        const withCredit = fake.payments.filter(
          (p) =>
            !p.voided &&
            sum(fake.allocations.filter((a) => a.paymentId === p.id).map((a) => a.amountCents)) <
              p.amountCents,
        )
        const payment = r.pick(
          withCredit.length > 0 && r.next(4) !== 0 ? withCredit : fake.payments,
        )
        const view = (await service.clinicAccount(payment.clinicId)).movements.find(
          (m) => m.id === payment.id,
        )!
        const left = cents(view.remaining!)
        const open = await openOf(payment.clinicId)
        if (open.length === 0) return false
        // A veces más de lo que le queda al pago (422): si no, el reparto sugerido.
        const list =
          left === 0 || r.next(5) === 0
            ? [{ caseId: r.pick(open).caseId, amountCents: left + 1 }]
            : suggestAllocation(left, open)
        log.push(`aplicar ${payment.id} (${left}) ${JSON.stringify(list)}`)
        await service.applyCredit(
          payment.id,
          { asignaciones: toInput(list) },
          r.next(2) === 0 ? admin : recepcion,
        )
        return true
      }
      case 'anular': {
        if (fake.payments.length === 0) return false
        const payment = r.pick(fake.payments)
        const before = statuses()
        log.push(`anular ${payment.id}`)
        await service.voidPayment(payment.id, { motivo: 'Error al registrar' }, admin)
        for (const c of fake.cases) {
          if (before.get(c.id) === 'cobrado' && c.status === 'entregado') {
            stats.reopenedByVoid += 1
          }
        }
        return true
      }
      case 'ajustar': {
        const withCase = fake.cases.length > 0 && r.next(3) !== 0
        const c = withCase ? r.pick(fake.cases) : null
        let clinicId = c ? c.clinicId : r.next(6) === 0 ? NORTE.id : SUR.id
        if (c && r.next(10) === 0) clinicId = otherClinic(clinicId)
        let amount: number
        if (!c) amount = (r.next(3) === 0 ? -1 : 1) * (1 + r.next(15_000))
        else if (r.next(3) === 0)
          amount = 1 + r.next(5_000) // Recargo.
        // Descuento: la mayoría cabe en el neto del trabajo (y libera lo asignado de más); los
        // que lo superan se rechazan con 422.
        else amount = -(1 + r.next((await caseNet(c)) + 1_000))
        const fecha = r.next(15) === 0 ? TOMORROW : r.pick(DAYS)
        const before = c?.status
        log.push(`ajustar ${clinicId} ${c?.id ?? '-'} ${amount} ${fecha}`)
        const view = await service.registerAdjustment(
          {
            clinicaId: clinicId,
            trabajoId: c?.id ?? null,
            monto: fromSignedCents(amount),
            motivo: 'Ajuste',
            fecha,
          },
          admin,
        )
        if (cents(view.released) > 0) stats.released += 1
        if (c && before === 'cobrado' && c.status === 'entregado') stats.reopenedByAdjustment += 1
        if (c && before === 'entregado' && c.status === 'cobrado') stats.settledByAdjustment += 1
        return true
      }
    }
  }

  /** Los invariantes de la cuenta de cada clínica, recalculados desde el estado de la fake. */
  async function check(where: string) {
    const ctx = `semilla ${seed}, ${where}\n${log.join('\n')}`
    const adjustments = await fake.repo.adjustments()
    const voided = new Set(fake.payments.filter((p) => p.voided).map((p) => p.id))
    const live = fake.allocations.filter((a) => !voided.has(a.paymentId))

    for (const clinic of CLINICS) {
      const account = await service.clinicAccount(clinic.id)
      const billed = fake.cases.filter((c) => c.clinicId === clinic.id && isBilled(c.status))
      const own = adjustments.filter((a) => a.clinicId === clinic.id)
      const vigentes = fake.payments.filter((p) => p.clinicId === clinic.id && !p.voided)

      // Decisión 10: saldo = cargos + ajustes − pagos vigentes, calculado aparte...
      const balance =
        sum(billed.map(caseChargeCents)) +
        sum(own.map((a) => a.amountCents)) -
        sum(vigentes.map((p) => p.amountCents))
      expect(cents(account.balance), `saldo de ${clinic.id}; ${ctx}`).toBe(balance)
      // ... y el cuadre: Σ pendientes + Σ ajustes sin trabajo − saldo a favor.
      const pending = sum(account.openCases.map((c) => cents(c.outstanding)))
      const free = sum(own.filter((a) => a.case === null).map((a) => a.amountCents))
      expect(cents(account.balance), `cuadre de ${clinic.id}; ${ctx}`).toBe(
        pending + free - cents(account.credit),
      )
      // UX5-02: el desglose de la API dice esos mismos números, y su saldo es el saldo.
      const freeDates = own.filter((a) => a.case === null).map((a) => a.date)
      expect(account.breakdown, `desglose de ${clinic.id}; ${ctx}`).toEqual({
        openCases: fromSignedCents(pending),
        unlinkedAdjustments: fromSignedCents(free),
        unlinkedSince: free === 0 ? null : freeDates.sort()[0],
        credit: account.credit,
        balance: account.balance,
      })

      // La antigüedad nunca es negativa y reparte el saldo positivo.
      const aging = Object.values(account.aging).map(cents)
      expect(
        aging.every((v) => v >= 0),
        `antigüedad negativa en ${clinic.id}; ${ctx}`,
      ).toBe(true)
      expect(sum(aging), `antigüedad de ${clinic.id}; ${ctx}`).toBe(
        Math.max(0, cents(account.balance)),
      )

      // Lo que le queda a cada pago nunca es negativo: lo no asignado si está vigente, 0 si
      // está anulado. Y el saldo a favor es exactamente eso (ningún pendiente negativo).
      const payments = account.movements.filter((m) => m.kind === 'pago')
      for (const m of payments) {
        const p = fake.payments.find((x) => x.id === m.id)!
        const allocated = sum(
          fake.allocations.filter((a) => a.paymentId === p.id).map((a) => a.amountCents),
        )
        expect(cents(m.remaining!), `remaining de ${p.id}; ${ctx}`).toBeGreaterThanOrEqual(0)
        expect(cents(m.remaining!), `remaining de ${p.id}; ${ctx}`).toBe(
          p.voided ? 0 : p.amountCents - allocated,
        )
      }
      expect(cents(account.credit), `saldo a favor de ${clinic.id}; ${ctx}`).toBe(
        sum(payments.map((m) => cents(m.remaining!))),
      )
    }

    for (const p of fake.payments) {
      // Σ asignaciones de cada pago ≤ su monto (las de uno anulado tampoco lo pasan).
      const mine = fake.allocations.filter((a) => a.paymentId === p.id)
      expect(
        sum(mine.map((a) => a.amountCents)),
        `asignado de ${p.id}; ${ctx}`,
      ).toBeLessThanOrEqual(p.amountCents)
      for (const a of mine) {
        expect(a.amountCents, `asignación vacía de ${p.id}; ${ctx}`).toBeGreaterThan(0)
        const c = fake.cases.find((x) => x.id === a.caseId)!
        expect(c.clinicId, `asignación de ${p.id} a otra clínica; ${ctx}`).toBe(p.clinicId)
      }
    }

    for (const c of fake.cases) {
      const net =
        caseChargeCents(c) +
        sum(adjustments.filter((a) => a.case?.id === c.id).map((a) => a.amountCents))
      const allocated = sum(live.filter((a) => a.caseId === c.id).map((a) => a.amountCents))
      const outstanding = net - allocated
      if (!isBilled(c.status)) {
        // Un trabajo que no se entregó no tiene ajustes ni asignaciones.
        expect(net, `ajuste a ${c.id} sin entregar; ${ctx}`).toBe(caseChargeCents(c))
        expect(allocated, `asignación a ${c.id} sin entregar; ${ctx}`).toBe(0)
        continue
      }
      expect(net, `neto de ${c.id}; ${ctx}`).toBeGreaterThanOrEqual(0)
      expect(outstanding, `pendiente de ${c.id}; ${ctx}`).toBeGreaterThanOrEqual(0)
      if (c.status === 'cobrado') {
        expect(outstanding, `${c.id} cobrado con pendiente; ${ctx}`).toBeLessThanOrEqual(0)
      } else {
        expect(outstanding, `${c.id} entregado sin pendiente; ${ctx}`).toBeGreaterThan(0)
      }
    }
  }

  for (let i = 0; i < STEPS; i++) {
    const op: OpKind = fake.cases.length === 0 ? 'entregar' : r.pick(BAG)
    const before = await snapshot()
    try {
      if (await step(op)) stats.ok[op] += 1
      else stats.skipped += 1
    } catch (e) {
      if (e instanceof AccountInputError) stats.rejected422 += 1
      else if (e instanceof PaymentVoidedError || e instanceof AccountBusyError) {
        stats.rejected409 += 1
      } else throw e
      log.push(`  rechazado: ${(e as Error).message}`)
      expect(await snapshot(), `un rechazo cambió algo; semilla ${seed}\n${log.join('\n')}`).toBe(
        before,
      )
    }
    await check(`paso ${i + 1} (${op})`)
  }
  return stats
}

describe('features/accounts/service: propiedad con operaciones reales', () => {
  it.each(SEEDS)(
    'secuencia %i: tras cada operación cuadra el saldo y ningún trabajo queda mal cobrado',
    async (seed) => {
      await run(seed)
    },
  )

  it('las secuencias cubren cada operación, sus rechazos, la liberación y las reaperturas', async () => {
    const all = await Promise.all(SEEDS.map(run))
    const total = (f: (s: Stats) => number) => sum(all.map(f))
    for (const op of OPS)
      expect(
        total((s) => s.ok[op]),
        op,
      ).toBeGreaterThanOrEqual(100)
    expect(total((s) => s.rejected422)).toBeGreaterThanOrEqual(100)
    expect(total((s) => s.rejected409)).toBeGreaterThanOrEqual(20)
    expect(total((s) => s.released)).toBeGreaterThanOrEqual(20)
    expect(total((s) => s.reopenedByAdjustment)).toBeGreaterThanOrEqual(10)
    expect(total((s) => s.reopenedByVoid)).toBeGreaterThanOrEqual(10)
    expect(total((s) => s.settledByAdjustment)).toBeGreaterThanOrEqual(10)
    expect(total((s) => s.settledOnDelivery)).toBeGreaterThanOrEqual(10)
  })
})
