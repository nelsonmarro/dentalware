import {
  ACCOUNT_ADMIN_ROLES,
  ACCOUNTS_ROLES,
  AGING_BUCKETS,
  agingBuckets,
  caseChargeCents,
  caseOutstandingCents,
  daysBetween,
  fromCents,
  fromSignedCents,
  hasRole,
  isSettled,
  oldestOpenDays,
  PAYMENT_METHOD_LABEL,
  toCents,
  toIsoDate,
} from '@dentalware/shared'
import type {
  AccountListQuery,
  AccountMovementKind,
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
  ClinicRef,
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
  voided: { at: Date; by: string; reason: string } | null
}

export type ClinicAccount = {
  clinic: { id: string; name: string }
  balance: string
  /** Saldo a favor: lo no asignado de los pagos vigentes (decisión 3). */
  credit: string
  aging: Record<AgingBucket, string>
  oldestDays: number | null
  openCases: OpenCase[]
  movements: AccountMovement[]
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

type Ledger = { cases: BilledCase[]; adjustments: AdjustmentEntry[]; payments: PaymentEntry[] }

const sum = (list: readonly number[]) => list.reduce((a, b) => a + b, 0)

type UowRepos = Parameters<Parameters<AccountsUnitOfWork['run']>[0]>[0]

function toPaymentView(p: PaymentEntry): PaymentView {
  return {
    id: p.id,
    clinicId: p.clinicId,
    amount: fromCents(p.amountCents),
    allocated: fromCents(p.allocatedCents),
    credit: fromSignedCents(p.voided ? 0 : p.amountCents - p.allocatedCents),
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
  function summarize(ledger: Ledger) {
    const today = deps.clock.today()
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
    const creditCents = sum(vigentes.map((p) => p.amountCents - p.allocatedCents))
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

  function movementsOf(ledger: Ledger): AccountMovement[] {
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
   * `entregado`. `CaseSettlement.setPaid` escribe el `status_changed`.
   */
  async function settle(r: UowRepos, locked: readonly SettlementCase[], actorId: string) {
    const outstanding = await outstandingOf(r, locked)
    for (const c of locked) {
      const settled = isSettled(outstanding.get(c.id) ?? 0)
      if (settled && c.status === 'entregado') {
        await r.cases.setPaid(c.id, deps.clock.now(), actorId)
      } else if (!settled && c.status === 'cobrado') {
        await r.cases.setPaid(c.id, null, actorId)
      }
    }
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

  async function viewOf(r: UowRepos, paymentId: string): Promise<PaymentView> {
    const p = await r.accounts.paymentById(paymentId)
    if (!p) throw new PaymentNotFoundError()
    return toPaymentView(p)
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
      const [cases, adjustments, payments] = await Promise.all([
        deps.accounts.billedCases(clinicId),
        deps.accounts.adjustments(clinicId),
        deps.accounts.payments(clinicId),
      ])
      const ledger: Ledger = { cases, adjustments, payments }
      const s = summarize(ledger)
      return {
        clinic: { id: clinic.id, name: clinic.name },
        balance: fromSignedCents(s.balanceCents),
        credit: fromSignedCents(s.creditCents),
        aging: s.aging,
        oldestDays: s.oldestDays,
        openCases: s.open.map((c) => ({
          id: c.id,
          code: c.code,
          patientRef: c.patientRef,
          deliveredAt: c.deliveredAt,
          charge: fromSignedCents(c.chargeCents),
          adjustments: fromSignedCents(c.adjustmentsCents),
          allocated: fromSignedCents(c.allocatedCents),
          outstanding: fromSignedCents(c.outstandingCents),
          days: daysBetween(c.deliveredOn, s.today),
        })),
        movements: movementsOf(ledger),
      }
    },

    /**
     * Registra un pago (CTA-2) y su reparto en una sola transacción: bloquea los trabajos,
     * valida la decisión 8 (422 con el campo, sin escribir nada), crea el pago y sus
     * asignaciones, escribe `payment_applied` en cada trabajo y cierra los cubiertos. Lo que no
     * reparte queda a favor de la clínica (decisión 3).
     */
    async registerPayment(input: PaymentInput, ctx: RequestContext): Promise<PaymentView> {
      assertRole(ACCOUNTS_ROLES, ctx)
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
        await settle(r, locked, ctx.userId)
        return viewOf(r, id)
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
    ): Promise<PaymentView> {
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
        await settle(r, locked, ctx.userId)
        return viewOf(r, paymentId)
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
  }
}
export type AccountsService = ReturnType<typeof createAccountsService>
