import type { CaseStatus } from '@dentalware/shared'
import type {
  AccountsRepository,
  AccountsUnitOfWork,
  AdjustmentEntry,
  BilledCase,
  CaseSettlement,
  ClinicRef,
  PaymentEntry,
} from './ports.ts'

/** Un trabajo tal como está en `cases` (cualquier estado): la fake filtra los facturables. */
export type FakeCase = Omit<BilledCase, 'adjustmentsCents' | 'allocatedCents'> & {
  status: CaseStatus
}
export type FakeAdjustment = Omit<AdjustmentEntry, 'case'> & { caseId: string | null }
export type FakePayment = Omit<PaymentEntry, 'allocatedCents'>
export type FakeAllocation = { paymentId: string; caseId: string; amountCents: number }
/** Lo que escribe `CaseSettlement`: los eventos de cobro y los `status_changed` de `setPaid`. */
export type FakeCaseEvent = {
  caseId: string
  type: string
  fromValue: string | null
  toValue: string | null
  reason: string | null
  actorId: string
}

type Seed = {
  clinics?: ClinicRef[]
  cases?: FakeCase[]
  adjustments?: FakeAdjustment[]
  payments?: FakePayment[]
  allocations?: FakeAllocation[]
  /** Nombre de cada usuario por id, para lo que registra el servicio (por omisión, el id). */
  users?: Record<string, string>
}

const sum = (list: readonly number[]) => list.reduce((a, b) => a + b, 0)

/**
 * Cuentas en memoria, para probar `service.ts` sin Postgres: el repo con el mismo comportamiento
 * que `repo.ts` (filtra los trabajos `entregado`/`cobrado` y suma ajustes y asignaciones; las de
 * un pago anulado no cuentan para el trabajo, sí para el pago), el `CaseSettlement` que cambia el
 * estado de esos mismos trabajos y guarda sus eventos, y un `uow` sin transacción real (como el
 * de `deliveries/fakes.ts`). Todo comparte el mismo estado, visible para el test.
 */
export function fakeAccounts(seed: Seed = {}) {
  const clinics = seed.clinics ?? []
  const cases = (seed.cases ?? []).map((c) => ({ ...c }))
  const adjustments = [...(seed.adjustments ?? [])]
  const payments = (seed.payments ?? []).map((p) => ({ ...p }))
  const allocations = [...(seed.allocations ?? [])]
  const events: FakeCaseEvent[] = []
  const paidAt = new Map<string, Date | null>()
  const locked: string[][] = []
  const lockedPayments: string[] = []
  /** Orden de los bloqueos y de la lectura de asignaciones, para probar que el servicio bloquea
   * el pago antes de leer lo que tiene asignado. */
  const calls: string[] = []
  const nameOf = (id: string) => seed.users?.[id] ?? id
  let nextPayment = 1

  const of = <T extends { clinicId: string }>(rows: readonly T[], clinicId?: string) =>
    clinicId === undefined ? [...rows] : rows.filter((r) => r.clinicId === clinicId)
  const isVoided = (paymentId: string) => payments.find((p) => p.id === paymentId)?.voided != null
  const adjustmentsOf = (caseId: string) =>
    sum(adjustments.filter((a) => a.caseId === caseId).map((a) => a.amountCents))
  const allocatedTo = (caseId: string) =>
    sum(
      allocations
        .filter((a) => a.caseId === caseId && !isVoided(a.paymentId))
        .map((a) => a.amountCents),
    )
  const withAllocated = (p: FakePayment): PaymentEntry => ({
    ...p,
    allocatedCents: sum(allocations.filter((a) => a.paymentId === p.id).map((a) => a.amountCents)),
  })

  const repo: AccountsRepository = {
    async clinicById(id) {
      return clinics.find((c) => c.id === id)
    },
    async clinics() {
      return [...clinics]
    },
    async billedCases(clinicId) {
      return of(cases, clinicId)
        .filter((c) => c.status === 'entregado' || c.status === 'cobrado')
        .map((c) => ({
          ...c,
          adjustmentsCents: adjustmentsOf(c.id),
          allocatedCents: allocatedTo(c.id),
        }))
    },
    async adjustments(clinicId) {
      return of(adjustments, clinicId).map(({ caseId, ...a }) => {
        const found = caseId === null ? undefined : cases.find((c) => c.id === caseId)
        return { ...a, case: found ? { id: found.id, code: found.code } : null }
      })
    },
    async payments(clinicId) {
      return of(payments, clinicId).map(withAllocated)
    },
    async paymentById(id) {
      const p = payments.find((x) => x.id === id)
      return p && withAllocated(p)
    },
    async caseTotals(caseIds) {
      return caseIds.map((caseId) => ({
        caseId,
        adjustmentsCents: adjustmentsOf(caseId),
        allocatedCents: allocatedTo(caseId),
      }))
    },
    async createPayment(p) {
      const id = `pago-${nextPayment++}`
      payments.push({
        id,
        clinicId: p.clinicId,
        amountCents: p.amountCents,
        method: p.method,
        paidOn: p.paidOn,
        reference: p.reference,
        notes: p.notes,
        createdAt: new Date('2026-10-06T17:00:00Z'),
        createdByName: nameOf(p.createdBy),
        voided: null,
      })
      return { id }
    },
    async lockPayment(id) {
      lockedPayments.push(id)
      calls.push(`lockPayment:${id}`)
      const p = payments.find((x) => x.id === id)
      return (
        p && {
          id: p.id,
          clinicId: p.clinicId,
          amountCents: p.amountCents,
          method: p.method,
          reference: p.reference,
          voided: p.voided !== null,
        }
      )
    },
    async allocationsOf(paymentId) {
      calls.push(`allocationsOf:${paymentId}`)
      return allocations
        .filter((a) => a.paymentId === paymentId)
        .map((a) => ({ caseId: a.caseId, amountCents: a.amountCents }))
    },
    async addAllocations(paymentId, list) {
      for (const a of list) allocations.push({ paymentId, ...a })
    },
    async voidPayment(id, v) {
      const p = payments.find((x) => x.id === id)
      if (p) p.voided = { at: v.at, byName: nameOf(v.by), reason: v.reason }
    },
  }

  const settlement: CaseSettlement = {
    async lockCases(caseIds) {
      locked.push([...caseIds])
      calls.push(`lockCases:${caseIds.join(',')}`)
      return cases
        .filter((c) => caseIds.includes(c.id))
        .map((c) => ({
          id: c.id,
          clinicId: c.clinicId,
          status: c.status,
          totalCents: c.totalCents,
          remakeChargePct: c.remakeChargePct,
          deliveredAt: c.deliveredAt,
        }))
    },
    async setPaid(caseId, at, actorId) {
      const c = cases.find((x) => x.id === caseId)
      const [from, to] = at
        ? (['entregado', 'cobrado'] as const)
        : (['cobrado', 'entregado'] as const)
      if (!c || c.status !== from) return
      c.status = to
      paidAt.set(caseId, at)
      events.push({
        caseId,
        type: 'status_changed',
        fromValue: from,
        toValue: to,
        reason: null,
        actorId,
      })
    },
    async addEvent(e) {
      events.push({ ...e, fromValue: null })
    },
  }

  const uow: AccountsUnitOfWork = { run: (fn) => fn({ accounts: repo, cases: settlement }) }

  return {
    repo,
    settlement,
    uow,
    events,
    paidAt,
    locked,
    lockedPayments,
    calls,
    cases,
    payments,
    allocations,
  }
}

/** Solo el repo de `fakeAccounts`, para las pruebas de lectura (CTA-1). */
export function fakeAccountsRepo(seed: Seed = {}): AccountsRepository {
  return fakeAccounts(seed).repo
}
