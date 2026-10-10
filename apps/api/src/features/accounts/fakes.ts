import { isBilled, type CaseStatus } from '@dentalware/shared'
import type {
  AccountsRepository,
  AccountsUnitOfWork,
  AdjustmentEntry,
  BilledCase,
  CaseSettlement,
  ClinicHeader,
  ClinicRef,
  PaymentEntry,
} from './ports.ts'

/** Un trabajo tal como está en `cases` (cualquier estado): la fake filtra los facturables. */
export type FakeCase = Omit<BilledCase, 'adjustmentsCents' | 'allocatedCents'> & {
  status: CaseStatus
}
export type FakeAdjustment = Omit<AdjustmentEntry, 'case'> & { caseId: string | null }
export type FakePayment = Omit<PaymentEntry, 'allocatedCents'>
/** Una clínica; los datos del encabezado del estado de cuenta, si faltan, son `null`. */
export type FakeClinic = ClinicRef & Partial<Omit<ClinicHeader, 'id' | 'name'>>
/** Una asignación; sin `id` ni `createdAt`, la fake les da uno (todas con la misma fecha: la
 * que llega después es la más reciente). */
export type FakeAllocation = {
  id?: string
  paymentId: string
  caseId: string
  amountCents: number
  createdAt?: Date
}
type StoredAllocation = FakeAllocation & { id: string; createdAt: Date }

const ALLOCATED_AT = new Date('2026-10-06T17:00:00Z')
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
  clinics?: FakeClinic[]
  cases?: FakeCase[]
  adjustments?: FakeAdjustment[]
  payments?: FakePayment[]
  allocations?: FakeAllocation[]
  /** Nombre de cada usuario por id, para lo que registra el servicio (por omisión, el id). */
  users?: Record<string, string>
  /** Se llama en cada `lockCases`, antes de devolver los trabajos: simula lo que otra
   * transacción confirmó entre la lectura y el bloqueo (`push` añade una asignación). */
  onLockCases?: (push: (a: FakeAllocation) => void) => void
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
  let nextAllocation = 1
  const stored = (a: FakeAllocation): StoredAllocation => ({
    ...a,
    id: a.id ?? `asig-${nextAllocation++}`,
    createdAt: a.createdAt ?? ALLOCATED_AT,
  })
  const allocations: StoredAllocation[] = (seed.allocations ?? []).map(stored)
  const events: FakeCaseEvent[] = []
  const paidAt = new Map<string, Date | null>()
  const locked: string[][] = []
  const lockedPayments: string[] = []
  /** Orden de los bloqueos y de la lectura de asignaciones, para probar que el servicio bloquea
   * el pago antes de leer lo que tiene asignado. */
  const calls: string[] = []
  const nameOf = (id: string) => seed.users?.[id] ?? id
  let nextPayment = 1
  let nextAdjustment = 1

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

  const withCase = ({ caseId, ...a }: FakeAdjustment): AdjustmentEntry => {
    const found = caseId === null ? undefined : cases.find((c) => c.id === caseId)
    return { ...a, case: found ? { id: found.id, code: found.code } : null }
  }

  const repo: AccountsRepository = {
    async clinicById(id) {
      const c = clinics.find((x) => x.id === id)
      return c && { id: c.id, name: c.name, active: c.active }
    },
    async clinics() {
      return clinics.map((c) => ({ id: c.id, name: c.name, active: c.active }))
    },
    async clinicHeader(id) {
      const c = clinics.find((x) => x.id === id)
      return (
        c && {
          id: c.id,
          name: c.name,
          ruc: c.ruc ?? null,
          address: c.address ?? null,
          city: c.city ?? null,
          phone: c.phone ?? null,
        }
      )
    },
    async billedCases(clinicId) {
      return of(cases, clinicId)
        .filter((c) => isBilled(c.status))
        .map((c) => ({
          ...c,
          adjustmentsCents: adjustmentsOf(c.id),
          allocatedCents: allocatedTo(c.id),
        }))
    },
    async adjustments(clinicId) {
      return of(adjustments, clinicId).map(withCase)
    },
    async adjustmentById(id) {
      const a = adjustments.find((x) => x.id === id)
      return a && withCase(a)
    },
    async payments(clinicId) {
      return of(payments, clinicId).map(withAllocated)
    },
    async paymentById(id) {
      const p = payments.find((x) => x.id === id)
      return p && withAllocated(p)
    },
    async allocations(clinicId) {
      const ids = new Set(of(payments, clinicId).map((p) => p.id))
      return allocations
        .filter((a) => ids.has(a.paymentId))
        .map((a) => ({ paymentId: a.paymentId, caseId: a.caseId, amountCents: a.amountCents }))
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
    async createAdjustment(a) {
      const id = `ajuste-${nextAdjustment++}`
      adjustments.push({
        id,
        clinicId: a.clinicId,
        caseId: a.caseId,
        amountCents: a.amountCents,
        reason: a.reason,
        date: a.date,
        createdAt: new Date('2026-10-06T17:00:00Z'),
        createdByName: nameOf(a.createdBy),
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
      for (const a of list) allocations.push(stored({ paymentId, ...a }))
    },
    async voidPayment(id, v) {
      const p = payments.find((x) => x.id === id)
      if (p) p.voided = { at: v.at, byName: nameOf(v.by), reason: v.reason }
    },
    async liveAllocationsOf(caseId) {
      calls.push(`liveAllocationsOf:${caseId}`)
      return allocations
        .filter((a) => a.caseId === caseId && !isVoided(a.paymentId))
        .map((a) => ({
          id: a.id,
          paymentId: a.paymentId,
          amountCents: a.amountCents,
          createdAt: a.createdAt,
        }))
    },
    async shrinkAllocation(id, amountCents) {
      const i = allocations.findIndex((a) => a.id === id)
      if (i === -1) return
      if (amountCents === 0) allocations.splice(i, 1)
      else allocations[i]!.amountCents = amountCents
    },
  }

  const settlement: CaseSettlement = {
    async lockCases(caseIds) {
      locked.push([...caseIds])
      calls.push(`lockCases:${caseIds.join(',')}`)
      seed.onLockCases?.((a) => allocations.push(stored(a)))
      return cases
        .filter((c) => caseIds.includes(c.id))
        .map((c) => ({
          id: c.id,
          code: c.code,
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
