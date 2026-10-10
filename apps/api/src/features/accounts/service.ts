import {
  ACCOUNT_ADMIN_ROLES,
  ACCOUNTS_ROLES,
  accountStatement,
  ACCOUNT_MOVEMENT_KINDS,
  AGING_BUCKETS,
  agingBuckets,
  caseChargeCents,
  caseOutstandingCents,
  daysBetween,
  fromCents,
  fromSignedCents,
  hasRole,
  isBilled,
  isSettled,
  oldestOpenDays,
  PAYMENT_METHOD_LABEL,
  previousDay,
  releaseExcess,
  STATEMENT_AFTER_TODAY_MESSAGE,
  toCents,
  toIsoDate,
  toSignedCents,
} from '@dentalware/shared'
import type {
  AccountListQuery,
  AccountMovementKind,
  AccountStatementQuery,
  AdjustmentInput,
  AgingBucket,
  AllocationInput,
  ApplyCreditInput,
  PaymentInput,
  PaymentMethod,
  UserRole,
  VoidPaymentInput,
} from '@dentalware/shared'
import type { Clock } from '../../lib/clock.ts'
import type { RequestContext } from '../../lib/request-context.ts'
import {
  AccountBusyError,
  AccountForbiddenError,
  AccountInputError,
  ClinicAccountNotFoundError,
  PaymentNotFoundError,
  PaymentVoidedError,
} from './errors.ts'
import type {
  AccountsRepository,
  AccountsUnitOfWork,
  AdjustmentEntry,
  BilledCase,
  ClinicHeader,
  ClinicRef,
  PaymentAllocation,
  PaymentEntry,
  SettlementCase,
} from './ports.ts'

/** Una clínica en la lista de «Cuentas» (CTA-1). Montos en cadena decimal, con signo. */
export type AccountSummary = {
  id: string
  name: string
  balance: string
  aging: Record<AgingBucket, string>
  /** Días de la partida pendiente más antigua; `null` si no debe nada. */
  oldestDays: number | null
}

/** Un trabajo «Por cobrar»: entregado y con pendiente. */
export type OpenCase = {
  id: string
  code: string
  patientRef: string
  deliveredAt: Date
  charge: string
  adjustments: string
  allocated: string
  outstanding: string
  /** Días desde la entrega (fecha de negocio). */
  days: number
}

/** Un movimiento de la cuenta. `amount` es su efecto en el saldo, con signo: el cargo y el
 * recargo suman, el descuento y el pago restan. Un pago anulado lleva `voided` y no cuenta. */
export type AccountMovement = {
  id: string
  kind: AccountMovementKind
  date: string // YYYY-MM-DD
  amount: string
  case: { id: string; code: string } | null
  /** Quién registró el ajuste o el pago; `null` en un cargo (lo genera la entrega). */
  by: string | null
  /** Motivo del ajuste o notas del pago. */
  reason: string | null
  reference: string | null
  method: PaymentMethod | null
  /** En un pago, lo que le queda sin asignar (su saldo a favor, para «Aplicar saldo a
   * favor»): `"0.00"` si está anulado o asignado entero. `null` en un cargo o un ajuste. */
  remaining: string | null
  /** En un pago vigente, a qué trabajos se aplicó (UX5-03): sus asignaciones sumadas por
   * trabajo, de la entrega más antigua a la más nueva y, a igualdad, por código. `[]` si está
   * anulado (sus asignaciones dejaron de contar) o no repartió nada; `null` en un cargo o un
   * ajuste. */
  allocations: AppliedCase[] | null
  voided: { at: Date; by: string; reason: string } | null
}

/** Lo que un pago vigente tiene asignado a un trabajo (UX5-03). `reopens`: anular el pago lo
 * devolvería de `cobrado` a `entregado` (hoy está cobrado y, sin esto, `isSettled` deja de
 * cumplirse), lo mismo que haría `voidPayment`. */
export type AppliedCase = { caseId: string; code: string; amount: string; reopens: boolean }

export type ClinicAccount = {
  clinic: { id: string; name: string }
  balance: string
  /** Saldo a favor: lo no asignado de los pagos vigentes (decisión 3) más los pendientes
   * negativos de los trabajos (descuento después de pagarlos enteros). */
  credit: string
  aging: Record<AgingBucket, string>
  oldestDays: number | null
  openCases: OpenCase[]
  movements: AccountMovement[]
}

/** Estado de cuenta de una clínica por rango de fechas de negocio (CTA-5, decisión 12). Todo
 * con signo, en cadena decimal: el saldo, los totales por tipo y el saldo corrido. */
export type AccountStatement = {
  clinic: ClinicHeader
  range: { desde: string; hasta: string }
  /** Día cuyo cierre es el saldo inicial: el anterior a `desde`. */
  openingDate: string
  openingBalance: string
  /** Movimientos del rango, de más antiguo a más nuevo, con el saldo tras cada uno. Un pago
   * anulado lleva `voided`, no suma y repite el saldo anterior. */
  movements: (AccountMovement & { balance: string })[]
  totals: Record<AccountMovementKind, string>
  closingBalance: string
  /** Saldo a favor, antigüedad y «Por cobrar» (días desde la entrega) a la fecha `hasta`. */
  credit: string
  aging: Record<AgingBucket, string>
  oldestDays: number | null
  openCases: OpenCase[]
}

/** Un pago (CTA-2) tal como lo devuelven registrar, aplicar saldo a favor y anular. */
export type PaymentView = {
  id: string
  clinicId: string
  amount: string
  /** Σ de sus asignaciones (también las de un pago anulado, que ya no cuentan). */
  allocated: string
  /** Lo que le queda a favor de la clínica: 0 si está anulado (decisión 3). */
  credit: string
  method: PaymentMethod
  paidOn: string // YYYY-MM-DD
  reference: string | null
  notes: string | null
  createdAt: Date
  by: string
  voided: { at: Date; by: string; reason: string } | null
}

/** Un trabajo que una operación pasó de `entregado` a `cobrado` (UX5-04). */
export type SettledCase = { id: string; code: string }

/** Registrar un pago y aplicar saldo a favor devuelven además `settled`: los trabajos que esa
 * misma transacción cerró según `isSettled`, de la entrega más antigua a la más nueva y, a
 * igualdad, por código (el orden del reparto sugerido). El aviso de la web los nombra. */
export type SettlingPaymentView = PaymentView & { settled: SettledCase[] }

/** Un ajuste (CTA-3) tal como lo devuelve registrarlo. `amount` con signo. */
export type AdjustmentView = {
  id: string
  clinicId: string
  case: { id: string; code: string } | null
  amount: string
  reason: string
  date: string // YYYY-MM-DD
  createdAt: Date
  by: string
  /** Lo que el ajuste devolvió a los pagos del trabajo (su saldo a favor): `"0.00"` si nada. */
  released: string
}

/** Un pago asignó al trabajo entre que el ajuste leyó sus asignaciones y lo bloqueó: el
 * ajuste vuelve a empezar (`registerAdjustment`). */
class LockSetChanged extends Error {}

/** 422 en `monto` de un ajuste que dejaría el neto de su trabajo por debajo de 0. */
const DISCOUNT_EXCEEDS_CASE = 'El descuento supera lo que vale el trabajo; regístralo sin trabajo'

/** Intentos de un ajuste antes de rendirse con `AccountBusyError` (409). */
const ADJUSTMENT_ATTEMPTS = 3

type Ledger = { cases: BilledCase[]; adjustments: AdjustmentEntry[]; payments: PaymentEntry[] }

const sum = (list: readonly number[]) => list.reduce((a, b) => a + b, 0)

/** De la entrega más antigua a la más nueva y, a igualdad, por código: el orden del reparto
 * sugerido, de `settled` (UX5-04) y de lo aplicado por un pago (UX5-03). */
const byDelivery = (
  a: { deliveredAt: Date | null; code: string },
  b: { deliveredAt: Date | null; code: string },
) =>
  (a.deliveredAt?.getTime() ?? 0) - (b.deliveredAt?.getTime() ?? 0) || a.code.localeCompare(b.code)

/** Lo que tiene asignado cada pago vigente, por trabajo (`paymentId → caseId → centavos`). Las
 * asignaciones de un pago anulado no cuentan (decisión 2). */
function liveAllocationsByPayment(
  payments: readonly PaymentEntry[],
  allocations: readonly PaymentAllocation[],
): Map<string, Map<string, number>> {
  const live = new Set(payments.filter((p) => p.voided === null).map((p) => p.id))
  const byPayment = new Map<string, Map<string, number>>()
  for (const a of allocations) {
    if (!live.has(a.paymentId)) continue
    const byCase = byPayment.get(a.paymentId) ?? new Map<string, number>()
    byCase.set(a.caseId, (byCase.get(a.caseId) ?? 0) + a.amountCents)
    byPayment.set(a.paymentId, byCase)
  }
  return byPayment
}

/** A qué trabajos se aplicó un pago (UX5-03), con lo que anularlo reabriría. Las asignaciones
 * solo van a trabajos entregados, que ya no salen de `entregado`/`cobrado`: todas están en
 * `cases`. */
function appliedCases(cases: readonly BilledCase[], byCase: Map<string, number> | undefined) {
  if (!byCase) return []
  return cases
    .filter((c) => byCase.has(c.id))
    .sort(byDelivery)
    .map((c): AppliedCase => {
      const cents = byCase.get(c.id) ?? 0
      const outstanding = caseOutstandingCents(
        caseChargeCents(c),
        c.adjustmentsCents,
        c.allocatedCents,
      )
      return {
        caseId: c.id,
        code: c.code,
        amount: fromCents(cents),
        reopens: c.status === 'cobrado' && !isSettled(outstanding + cents),
      }
    })
}

/**
 * La cuenta como estaba al cierre de `date` (CTA-5): los cargos entregados hasta ese día, los
 * ajustes y los pagos con fecha hasta ese día y, de cada trabajo, sus ajustes y lo asignado por
 * los pagos vigentes de esa fecha. Un pago solo cuenta como asignado a los trabajos ya
 * entregados; lo demás queda a favor. El estado de cada trabajo sale de `isSettled` a esa
 * fecha. Con `date` = hoy, es la cuenta de hoy (las fechas de pagos y ajustes nunca son
 * futuras).
 */
function ledgerAt(ledger: Ledger, allocations: readonly PaymentAllocation[], date: string): Ledger {
  const cases = ledger.cases.filter((c) => toIsoDate(c.deliveredAt) <= date)
  const caseIds = new Set(cases.map((c) => c.id))
  const payments = ledger.payments.filter((p) => p.paidOn <= date)
  const live = new Set(payments.filter((p) => p.voided === null).map((p) => p.id))
  const counted = allocations.filter((a) => live.has(a.paymentId) && caseIds.has(a.caseId))
  // Un ajuste con fecha anterior a la entrega de su trabajo (no lo deja la API, pero la fecha la
  // escribe el administrador) mueve el saldo como uno sin trabajo hasta que el trabajo cargue.
  const adjustments = ledger.adjustments
    .filter((a) => a.date <= date)
    .map((a) => (a.case && !caseIds.has(a.case.id) ? { ...a, case: null } : a))
  return {
    cases: cases.map((c) => {
      const adjustmentsCents = sum(
        adjustments.filter((a) => a.case?.id === c.id).map((a) => a.amountCents),
      )
      const allocatedCents = sum(counted.filter((a) => a.caseId === c.id).map((a) => a.amountCents))
      const outstanding = caseOutstandingCents(caseChargeCents(c), adjustmentsCents, allocatedCents)
      return {
        ...c,
        adjustmentsCents,
        allocatedCents,
        status: isSettled(outstanding) ? 'cobrado' : 'entregado',
      }
    }),
    adjustments,
    payments: payments.map((p) => ({
      ...p,
      allocatedCents: sum(counted.filter((a) => a.paymentId === p.id).map((a) => a.amountCents)),
    })),
  }
}

type UowRepos = Parameters<Parameters<AccountsUnitOfWork['run']>[0]>[0]

/** Lo que le queda a favor a un pago (decisión 3): lo no asignado si está vigente; 0 si está
 * anulado. */
const paymentRemainingCents = (p: PaymentEntry) => (p.voided ? 0 : p.amountCents - p.allocatedCents)

function toPaymentView(p: PaymentEntry): PaymentView {
  return {
    id: p.id,
    clinicId: p.clinicId,
    amount: fromCents(p.amountCents),
    allocated: fromCents(p.allocatedCents),
    credit: fromSignedCents(paymentRemainingCents(p)),
    method: p.method,
    paidOn: p.paidOn,
    reference: p.reference,
    notes: p.notes,
    createdAt: p.createdAt,
    by: p.createdByName,
    voided: p.voided && { at: p.voided.at, by: p.voided.byName, reason: p.voided.reason },
  }
}

/** `reason` de `payment_applied` (decisión 11): el método y, si la tiene, la referencia. */
function paymentReason(p: { method: PaymentMethod; reference: string | null }): string {
  const method = PAYMENT_METHOD_LABEL[p.method]
  return p.reference ? `${method} · ${p.reference}` : method
}

function assertRole(roles: readonly UserRole[], ctx: RequestContext) {
  if (!hasRole(roles, ctx.role)) throw new AccountForbiddenError()
}

/**
 * Cuentas por clínica (CTA-1, Iteración 5): saldo, saldo a favor, antigüedad, «Por cobrar» y
 * movimientos. Solo lectura: el repo trae los datos y todas las reglas salen de `shared`
 * (`caseChargeCents`, `caseOutstandingCents`, `agingBuckets`, `oldestOpenDays`). El saldo se
 * calcula, no se guarda (`docs/architecture.md` §5).
 */
export function createAccountsService(deps: {
  accounts: AccountsRepository
  uow: AccountsUnitOfWork
  clock: Clock
}) {
  /** Todo lo de una clínica a partir de sus datos, a la fecha de hoy. */
  function summarize(ledger: Ledger, today = deps.clock.today()) {
    const cases = ledger.cases.map((c) => {
      const chargeCents = caseChargeCents(c)
      return {
        ...c,
        chargeCents,
        outstandingCents: caseOutstandingCents(chargeCents, c.adjustmentsCents, c.allocatedCents),
        deliveredOn: toIsoDate(c.deliveredAt),
      }
    })
    const vigentes = ledger.payments.filter((p) => p.voided === null)
    const free = ledger.adjustments.filter((a) => a.case === null)
    // Saldo a favor (decisión 3): lo no asignado de los pagos vigentes y el pendiente negativo
    // de cada trabajo (un descuento después de pagarlo entero), que la clínica ya pagó de más.
    const creditCents =
      sum(vigentes.map((p) => p.amountCents - p.allocatedCents)) +
      sum(cases.map((c) => Math.max(0, -c.outstandingCents)))
    // Decisión 10: cargos de entregados y cobrados + todos los ajustes − pagos vigentes.
    const balanceCents =
      sum(cases.map((c) => c.chargeCents)) +
      sum(ledger.adjustments.map((a) => a.amountCents)) -
      sum(vigentes.map((p) => p.amountCents))
    const open = cases
      .filter((c) => c.status === 'entregado' && c.outstandingCents > 0)
      .sort((a, b) => a.deliveredOn.localeCompare(b.deliveredOn) || a.code.localeCompare(b.code))
    // Decisión 9: suman los pendientes por su entrega y los ajustes sueltos positivos por su
    // fecha; restan los ajustes sueltos negativos y el saldo a favor.
    const agingInput = {
      today,
      charges: [
        ...open.map((c) => ({ date: c.deliveredOn, cents: c.outstandingCents })),
        ...free
          .filter((a) => a.amountCents > 0)
          .map((a) => ({ date: a.date, cents: a.amountCents })),
      ],
      credits: [
        ...free.filter((a) => a.amountCents < 0).map((a) => ({ cents: -a.amountCents })),
        { cents: creditCents },
      ],
    }
    const buckets = agingBuckets(agingInput)
    return {
      today,
      cases,
      open,
      balanceCents,
      creditCents,
      aging: Object.fromEntries(
        AGING_BUCKETS.map((b) => [b, fromSignedCents(buckets[b])]),
      ) as Record<AgingBucket, string>,
      oldestDays: oldestOpenDays(agingInput),
    }
  }

  function movementsOf(
    ledger: Ledger,
    allocations: readonly PaymentAllocation[],
  ): AccountMovement[] {
    const applied = liveAllocationsByPayment(ledger.payments, allocations)
    const rows: (AccountMovement & { at: Date })[] = [
      ...ledger.cases.map((c) => ({
        id: c.id,
        kind: 'cargo' as const,
        date: toIsoDate(c.deliveredAt),
        amount: fromSignedCents(caseChargeCents(c)),
        case: { id: c.id, code: c.code },
        by: null,
        reason: null,
        reference: null,
        method: null,
        remaining: null,
        allocations: null,
        voided: null,
        at: c.deliveredAt,
      })),
      ...ledger.adjustments.map((a) => ({
        id: a.id,
        kind: 'ajuste' as const,
        date: a.date,
        amount: fromSignedCents(a.amountCents),
        case: a.case,
        by: a.createdByName,
        reason: a.reason,
        reference: null,
        method: null,
        remaining: null,
        allocations: null,
        voided: null,
        at: a.createdAt,
      })),
      ...ledger.payments.map((p) => ({
        id: p.id,
        kind: 'pago' as const,
        date: p.paidOn,
        amount: fromSignedCents(-p.amountCents),
        case: null,
        by: p.createdByName,
        reason: p.notes,
        reference: p.reference,
        method: p.method,
        remaining: fromSignedCents(paymentRemainingCents(p)),
        allocations: appliedCases(ledger.cases, applied.get(p.id)),
        voided: p.voided && { at: p.voided.at, by: p.voided.byName, reason: p.voided.reason },
        at: p.createdAt,
      })),
    ]
    // Lo más nuevo primero: por fecha de negocio y, el mismo día, por cuándo se registró.
    return rows
      .sort((a, b) => b.date.localeCompare(a.date) || b.at.getTime() - a.at.getTime())
      .map(({ at: _at, ...m }) => m)
  }

  /** Pendiente de cada trabajo bloqueado, leído dentro de la transacción (tras el bloqueo: lo
   * que asignó otro pago al mismo trabajo ya está confirmado y cuenta). */
  async function outstandingOf(r: UowRepos, locked: readonly SettlementCase[]) {
    const totals = await r.accounts.caseTotals(locked.map((c) => c.id))
    return new Map(
      locked.map((c) => {
        const t = totals.find((x) => x.caseId === c.id)
        const cents = caseOutstandingCents(
          caseChargeCents(c),
          t?.adjustmentsCents ?? 0,
          t?.allocatedCents ?? 0,
        )
        return [c.id, cents]
      }),
    )
  }

  /**
   * Bloquea los trabajos del reparto, lee su pendiente y valida la decisión 8: solo trabajos
   * `entregado` de esa clínica, cada asignación sin pasar de su pendiente y, en total, sin pasar
   * de `limitCents` (el monto del pago o lo que le queda a favor). Si algo falla, lanza
   * `AccountInputError` con el campo antes de escribir nada.
   */
  async function lockAndValidate(
    r: UowRepos,
    clinicId: string,
    asignaciones: readonly AllocationInput[],
    limit: { cents: number; message: string },
  ) {
    const locked = await r.cases.lockCases(asignaciones.map((a) => a.trabajoId))
    const outstanding = await outstandingOf(r, locked)
    const allocations = asignaciones.map((a, i) => {
      const at = `asignaciones.${i}`
      const c = locked.find((x) => x.id === a.trabajoId)
      if (!c) throw new AccountInputError('El trabajo no existe', `${at}.trabajoId`)
      if (c.clinicId !== clinicId) {
        throw new AccountInputError('El trabajo es de otra clínica', `${at}.trabajoId`)
      }
      if (c.status === 'cobrado') {
        throw new AccountInputError('El trabajo ya está cobrado', `${at}.trabajoId`)
      }
      if (c.status !== 'entregado') {
        throw new AccountInputError('El trabajo aún no está entregado', `${at}.trabajoId`)
      }
      const pending = outstanding.get(c.id) ?? 0
      const cents = toCents(a.monto)
      if (cents > pending) {
        throw new AccountInputError(
          `Supera lo pendiente del trabajo (${fromSignedCents(pending)})`,
          `${at}.monto`,
        )
      }
      return { caseId: c.id, amountCents: cents }
    })
    if (sum(allocations.map((a) => a.amountCents)) > limit.cents) {
      throw new AccountInputError(limit.message, 'asignaciones')
    }
    return { locked, allocations }
  }

  /**
   * Reevalúa `isSettled` (decisión 5) en los trabajos bloqueados tras asignar o anular:
   * `entregado` cubierto pasa a `cobrado` con `paid_at`; `cobrado` que deja de estarlo vuelve a
   * `entregado`. `CaseSettlement.setPaid` escribe el `status_changed`. Devuelve los que pasó a
   * `cobrado`, en el orden de `SettlingPaymentView.settled`.
   */
  async function settle(
    r: UowRepos,
    locked: readonly SettlementCase[],
    actorId: string,
  ): Promise<SettledCase[]> {
    const outstanding = await outstandingOf(r, locked)
    const closed: SettlementCase[] = []
    for (const c of locked) {
      const settled = isSettled(outstanding.get(c.id) ?? 0)
      if (settled && c.status === 'entregado') {
        await r.cases.setPaid(c.id, deps.clock.now(), actorId)
        closed.push(c)
      } else if (!settled && c.status === 'cobrado') {
        await r.cases.setPaid(c.id, null, actorId)
      }
    }
    return closed.sort(byDelivery).map((c) => ({ id: c.id, code: c.code }))
  }

  /** Crea las asignaciones del pago y escribe `payment_applied` en cada trabajo. */
  async function allocate(
    r: UowRepos,
    payment: { id: string; method: PaymentMethod; reference: string | null },
    allocations: readonly { caseId: string; amountCents: number }[],
    actorId: string,
  ) {
    if (allocations.length === 0) return
    await r.accounts.addAllocations(payment.id, allocations, actorId)
    for (const a of allocations) {
      await r.cases.addEvent({
        caseId: a.caseId,
        type: 'payment_applied',
        toValue: fromCents(a.amountCents),
        reason: paymentReason(payment),
        actorId,
      })
    }
  }

  /** La fecha de un pago o de un ajuste no puede ser posterior a hoy (reloj del servicio). */
  function assertNotFuture(fecha: string) {
    if (fecha > deps.clock.today()) {
      throw new AccountInputError('La fecha no puede ser posterior a hoy', 'fecha')
    }
  }

  /** Bloquea el trabajo del ajuste y comprueba que sea de la clínica y ya cargue a su cuenta
   * (`entregado` o `cobrado`); si no, `AccountInputError` en `trabajoId` sin escribir nada. */
  async function lockAdjustedCase(r: UowRepos, clinicId: string, caseId: string) {
    const [c] = await r.cases.lockCases([caseId])
    if (!c) throw new AccountInputError('El trabajo no existe', 'trabajoId')
    if (c.clinicId !== clinicId) {
      throw new AccountInputError('El trabajo es de otra clínica', 'trabajoId')
    }
    if (!isBilled(c.status)) {
      throw new AccountInputError('El trabajo no está entregado', 'trabajoId')
    }
    return c
  }

  /**
   * Bloquea lo que toca un ajuste a un trabajo en el orden de todo `accounts` (pago antes que
   * trabajo, ADR 35): primero los pagos con asignaciones vigentes al trabajo (en orden de id),
   * después el trabajo, y vuelve a leer sus asignaciones. Si apareció la de un pago que no
   * bloqueó (otro pago confirmado entre medio), lanza `LockSetChanged` para empezar de nuevo.
   */
  async function lockForAdjustment(r: UowRepos, clinicId: string, caseId: string) {
    const before = await r.accounts.liveAllocationsOf(caseId)
    const paymentIds = [...new Set(before.map((a) => a.paymentId))].sort((a, b) =>
      a < b ? -1 : a > b ? 1 : 0,
    )
    for (const id of paymentIds) await r.accounts.lockPayment(id)
    const locked = await lockAdjustedCase(r, clinicId, caseId)
    const live = await r.accounts.liveAllocationsOf(caseId)
    if (live.some((a) => !paymentIds.includes(a.paymentId))) throw new LockSetChanged()
    return { locked, live }
  }

  /** El ajuste en una transacción (CTA-3): lo crea y, con trabajo, libera el exceso de lo
   * asignado (`releaseExcess`), escribe `adjustment_added` y reevalúa `isSettled`. */
  async function adjust(
    r: UowRepos,
    input: AdjustmentInput,
    ctx: RequestContext,
  ): Promise<AdjustmentView> {
    if (!(await r.accounts.clinicById(input.clinicaId))) {
      throw new AccountInputError('La clínica no existe', 'clinicaId')
    }
    const target =
      input.trabajoId === null ? null : await lockForAdjustment(r, input.clinicaId, input.trabajoId)
    const amountCents = toSignedCents(input.monto)
    let release: ReturnType<typeof releaseExcess> = []
    if (target) {
      // Un ajuste ligado no deja el neto del trabajo (cargo + Σ ajustes) por debajo de 0: lo
      // que la clínica no debe por ningún trabajo es un ajuste sin trabajo (ruling, Tarea 5).
      const [totals] = await r.accounts.caseTotals([target.locked.id])
      const net = caseChargeCents(target.locked) + (totals?.adjustmentsCents ?? 0) + amountCents
      if (net < 0) throw new AccountInputError(DISCOUNT_EXCEEDS_CASE, 'monto')
      // Neto con el ajuste nuevo (decisión 1): si lo asignado lo supera, el exceso vuelve a
      // los pagos, de la asignación más reciente a la más antigua (Nelson, 2026-10-08).
      release = releaseExcess(net, target.live)
    }
    const releasedCents = sum(release.map((p) => p.releasedCents))
    // UX5-03: el movimiento del ajuste dice lo que devolvió, con el mismo texto que el
    // historial del trabajo; se guarda con el motivo porque no hay dónde guardar a qué pago.
    const reason =
      releasedCents > 0
        ? `${input.motivo} · $ ${fromCents(releasedCents)} vuelven al saldo a favor`
        : input.motivo
    const { id } = await r.accounts.createAdjustment({
      clinicId: input.clinicaId,
      caseId: input.trabajoId,
      amountCents,
      reason,
      date: input.fecha,
      createdBy: ctx.userId,
    })
    if (target) {
      const c = target.locked
      for (const p of release) await r.accounts.shrinkAllocation(p.id, p.leftCents)
      await r.cases.addEvent({
        caseId: c.id,
        type: 'adjustment_added',
        toValue: fromSignedCents(amountCents),
        reason,
        actorId: ctx.userId,
      })
      await settle(r, [c], ctx.userId)
    }
    const a = await r.accounts.adjustmentById(id)
    if (!a) throw new Error(`El ajuste ${id} no se pudo leer tras crearlo`)
    return {
      id: a.id,
      clinicId: a.clinicId,
      case: a.case,
      amount: fromSignedCents(a.amountCents),
      reason: a.reason,
      date: a.date,
      createdAt: a.createdAt,
      by: a.createdByName,
      released: fromCents(releasedCents),
    }
  }

  async function viewOf(r: UowRepos, paymentId: string): Promise<PaymentView> {
    const p = await r.accounts.paymentById(paymentId)
    if (!p) throw new PaymentNotFoundError()
    return toPaymentView(p)
  }

  /** «Por cobrar» de un resumen: de la entrega más antigua a la más nueva, con los días hasta
   * la fecha del resumen. */
  function openCasesOf(s: ReturnType<typeof summarize>): OpenCase[] {
    return s.open.map((c) => ({
      id: c.id,
      code: c.code,
      patientRef: c.patientRef,
      deliveredAt: c.deliveredAt,
      charge: fromSignedCents(c.chargeCents),
      adjustments: fromSignedCents(c.adjustmentsCents),
      allocated: fromSignedCents(c.allocatedCents),
      outstanding: fromSignedCents(c.outstandingCents),
      days: daysBetween(c.deliveredOn, s.today),
    }))
  }

  return {
    /**
     * Lista de «Cuentas» (CTA-1): las clínicas con saldo o con movimientos (aunque estén
     * inactivas: la deuda no se va con la clínica); con `todas`, también las activas sin
     * nada. De mayor a menor saldo y, a igual saldo, por nombre.
     */
    async list(q: AccountListQuery): Promise<AccountSummary[]> {
      const [clinics, cases, adjustments, payments] = await Promise.all([
        deps.accounts.clinics(),
        deps.accounts.billedCases(),
        deps.accounts.adjustments(),
        deps.accounts.payments(),
      ])
      const byClinic = (c: ClinicRef): Ledger => ({
        cases: cases.filter((x) => x.clinicId === c.id),
        adjustments: adjustments.filter((x) => x.clinicId === c.id),
        payments: payments.filter((x) => x.clinicId === c.id),
      })
      return clinics
        .map((c) => ({ clinic: c, ledger: byClinic(c) }))
        .filter(
          ({ clinic, ledger }) =>
            (q.todas && clinic.active) ||
            ledger.cases.length + ledger.adjustments.length + ledger.payments.length > 0,
        )
        .map(({ clinic, ledger }) => ({ clinic, s: summarize(ledger) }))
        .sort(
          (a, b) =>
            b.s.balanceCents - a.s.balanceCents || a.clinic.name.localeCompare(b.clinic.name),
        )
        .map(({ clinic, s }) => ({
          id: clinic.id,
          name: clinic.name,
          balance: fromSignedCents(s.balanceCents),
          aging: s.aging,
          oldestDays: s.oldestDays,
        }))
    },

    /** Cuenta de una clínica (CTA-1): saldo, saldo a favor, antigüedad, «Por cobrar» (de la
     * entrega más antigua a la más nueva) y movimientos. 404 si la clínica no existe. */
    async clinicAccount(clinicId: string): Promise<ClinicAccount> {
      const clinic = await deps.accounts.clinicById(clinicId)
      if (!clinic) throw new ClinicAccountNotFoundError()
      const [cases, adjustments, payments, allocations] = await Promise.all([
        deps.accounts.billedCases(clinicId),
        deps.accounts.adjustments(clinicId),
        deps.accounts.payments(clinicId),
        deps.accounts.allocations(clinicId),
      ])
      const ledger: Ledger = { cases, adjustments, payments }
      const s = summarize(ledger)
      return {
        clinic: { id: clinic.id, name: clinic.name },
        balance: fromSignedCents(s.balanceCents),
        credit: fromSignedCents(s.creditCents),
        aging: s.aging,
        oldestDays: s.oldestDays,
        openCases: openCasesOf(s),
        movements: movementsOf(ledger, allocations),
      }
    },

    /**
     * Estado de cuenta de una clínica (CTA-5, decisión 12): el saldo al cierre del día anterior
     * a `desde`, los movimientos del rango con su saldo corrido (`accountStatement` de shared:
     * los pagos anulados se listan y no suman), el saldo final y, a la fecha `hasta`, el saldo a
     * favor, la antigüedad y «Por cobrar». Con `hasta` = hoy cuadra con `clinicAccount`. 404 si
     * la clínica no existe.
     */
    async statement(clinicId: string, q: AccountStatementQuery): Promise<AccountStatement> {
      // Con `hasta` futura, la antigüedad y los días de «Por cobrar» saldrían proyectados a esa
      // fecha (I-2 de la revisión final del PR 2): como en pagos y ajustes, no después de hoy.
      if (q.hasta > deps.clock.today()) {
        throw new AccountInputError(STATEMENT_AFTER_TODAY_MESSAGE, 'hasta')
      }
      const clinic = await deps.accounts.clinicHeader(clinicId)
      if (!clinic) throw new ClinicAccountNotFoundError()
      const [cases, adjustments, payments, allocations] = await Promise.all([
        deps.accounts.billedCases(clinicId),
        deps.accounts.adjustments(clinicId),
        deps.accounts.payments(clinicId),
        deps.accounts.allocations(clinicId),
      ])
      const ledger: Ledger = { cases, adjustments, payments }
      const openingDate = previousDay(q.desde)
      const opening = summarize(ledgerAt(ledger, allocations, openingDate), openingDate)
      const closing = summarize(ledgerAt(ledger, allocations, q.hasta), q.hasta)
      // De más antiguo a más nuevo: al revés que la cuenta (CTA-1), para el saldo corrido.
      const movements = movementsOf(ledger, allocations)
        .filter((m) => m.date >= q.desde && m.date <= q.hasta)
        .reverse()
      const running = accountStatement({
        openingCents: opening.balanceCents,
        movements: movements.map((m) => ({
          kind: m.kind,
          cents: toSignedCents(m.amount),
          voided: m.voided !== null,
        })),
      })
      return {
        clinic,
        range: { desde: q.desde, hasta: q.hasta },
        openingDate,
        openingBalance: fromSignedCents(opening.balanceCents),
        movements: movements.map((m, i) => ({
          ...m,
          balance: fromSignedCents(running.balances[i] ?? running.closingCents),
        })),
        totals: Object.fromEntries(
          ACCOUNT_MOVEMENT_KINDS.map((k) => [k, fromSignedCents(running.totals[k])]),
        ) as Record<AccountMovementKind, string>,
        closingBalance: fromSignedCents(running.closingCents),
        credit: fromSignedCents(closing.creditCents),
        aging: closing.aging,
        oldestDays: closing.oldestDays,
        openCases: openCasesOf(closing),
      }
    },

    /**
     * Registra un pago (CTA-2) y su reparto en una sola transacción: bloquea los trabajos,
     * valida la decisión 8 (422 con el campo, sin escribir nada), crea el pago y sus
     * asignaciones, escribe `payment_applied` en cada trabajo y cierra los cubiertos. Lo que no
     * reparte queda a favor de la clínica (decisión 3).
     */
    async registerPayment(input: PaymentInput, ctx: RequestContext): Promise<SettlingPaymentView> {
      assertRole(ACCOUNTS_ROLES, ctx)
      assertNotFuture(input.fecha)
      return deps.uow.run(async (r) => {
        if (!(await r.accounts.clinicById(input.clinicaId))) {
          throw new AccountInputError('La clínica no existe', 'clinicaId')
        }
        const amountCents = toCents(input.monto)
        const { locked, allocations } = await lockAndValidate(
          r,
          input.clinicaId,
          input.asignaciones,
          { cents: amountCents, message: 'Lo asignado no puede superar el monto del pago' },
        )
        const payment = {
          method: input.metodo,
          reference: input.referencia,
        }
        const { id } = await r.accounts.createPayment({
          clinicId: input.clinicaId,
          amountCents,
          ...payment,
          paidOn: input.fecha,
          notes: input.notas,
          createdBy: ctx.userId,
        })
        await allocate(r, { id, ...payment }, allocations, ctx.userId)
        const settled = await settle(r, locked, ctx.userId)
        return { ...(await viewOf(r, id)), settled }
      })
    },

    /**
     * «Aplicar saldo a favor» (decisión 3): reparte lo no asignado de un pago vigente con
     * asignaciones de ese mismo pago, con las validaciones de la decisión 8 y sin pasar de lo
     * que le queda. 404 si no existe; 409 si está anulado.
     */
    async applyCredit(
      paymentId: string,
      input: ApplyCreditInput,
      ctx: RequestContext,
    ): Promise<SettlingPaymentView> {
      assertRole(ACCOUNTS_ROLES, ctx)
      return deps.uow.run(async (r) => {
        const payment = await r.accounts.lockPayment(paymentId)
        if (!payment) throw new PaymentNotFoundError()
        if (payment.voided) {
          throw new PaymentVoidedError('El pago está anulado: no tiene saldo a favor')
        }
        const left =
          payment.amountCents -
          sum((await r.accounts.allocationsOf(paymentId)).map((a) => a.amountCents))
        const { locked, allocations } = await lockAndValidate(
          r,
          payment.clinicId,
          input.asignaciones,
          { cents: left, message: `Supera el saldo a favor de este pago (${fromCents(left)})` },
        )
        await allocate(r, payment, allocations, ctx.userId)
        const settled = await settle(r, locked, ctx.userId)
        return { ...(await viewOf(r, paymentId)), settled }
      })
    },

    /**
     * Anula un pago (decisión 2; solo admin, con motivo): lo marca, sus asignaciones dejan de
     * contar (sin borrarse), escribe `payment_voided` en cada trabajo con lo que le devuelve y
     * vuelve a `entregado` lo que deja de estar cubierto. 404 si no existe; 409 si ya estaba
     * anulado.
     */
    async voidPayment(
      paymentId: string,
      input: VoidPaymentInput,
      ctx: RequestContext,
    ): Promise<PaymentView> {
      assertRole(ACCOUNT_ADMIN_ROLES, ctx)
      return deps.uow.run(async (r) => {
        const payment = await r.accounts.lockPayment(paymentId)
        if (!payment) throw new PaymentNotFoundError()
        if (payment.voided) throw new PaymentVoidedError('El pago ya está anulado')
        // Un trabajo puede tener varias asignaciones del mismo pago (el reparto y un saldo a
        // favor aplicado después): un solo evento con la suma.
        const byCase = new Map<string, number>()
        for (const a of await r.accounts.allocationsOf(paymentId)) {
          byCase.set(a.caseId, (byCase.get(a.caseId) ?? 0) + a.amountCents)
        }
        const locked = await r.cases.lockCases([...byCase.keys()])
        await r.accounts.voidPayment(paymentId, {
          at: deps.clock.now(),
          by: ctx.userId,
          reason: input.motivo,
        })
        for (const [caseId, cents] of byCase) {
          await r.cases.addEvent({
            caseId,
            type: 'payment_voided',
            toValue: fromCents(cents),
            reason: input.motivo,
            actorId: ctx.userId,
          })
        }
        await settle(r, locked, ctx.userId)
        return viewOf(r, paymentId)
      })
    },

    /**
     * Registra un ajuste (CTA-3; solo admin, con motivo). Con trabajo, lo bloquea, valida que
     * sea de la clínica y esté `entregado` o `cobrado` (422 en `trabajoId`) y que no deje su
     * neto por debajo de 0 (422 en `monto`), escribe
     * `adjustment_added` y reevalúa `isSettled` (decisiones 1 y 5): un descuento puede cerrarlo
     * y un recargo reabrir uno cobrado. Sin trabajo («Saldo inicial»), solo mueve el saldo de
     * la clínica y entra en la antigüedad por su fecha.
     */
    async registerAdjustment(input: AdjustmentInput, ctx: RequestContext): Promise<AdjustmentView> {
      assertRole(ACCOUNT_ADMIN_ROLES, ctx)
      assertNotFuture(input.fecha)
      // Si un pago asigna al trabajo entre que se leen sus asignaciones y se bloquea, se vuelve
      // a empezar con ese pago también bloqueado: nunca se bloquea un pago después del trabajo.
      for (let attempt = 1; ; attempt++) {
        try {
          return await deps.uow.run((r) => adjust(r, input, ctx))
        } catch (e) {
          if (e instanceof LockSetChanged && attempt < ADJUSTMENT_ATTEMPTS) continue
          if (e instanceof LockSetChanged) throw new AccountBusyError()
          throw e
        }
      }
    },
  }
}
export type AccountsService = ReturnType<typeof createAccountsService>
