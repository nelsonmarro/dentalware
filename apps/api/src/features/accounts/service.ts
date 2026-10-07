import {
  AGING_BUCKETS,
  agingBuckets,
  caseChargeCents,
  caseOutstandingCents,
  daysBetween,
  fromSignedCents,
  oldestOpenDays,
  toIsoDate,
} from '@dentalware/shared'
import type { AccountListQuery, AgingBucket, PaymentMethod } from '@dentalware/shared'
import type { Clock } from '../../lib/clock.ts'
import { ClinicAccountNotFoundError } from './errors.ts'
import type {
  AccountsRepository,
  AdjustmentEntry,
  BilledCase,
  ClinicRef,
  PaymentEntry,
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
  kind: 'cargo' | 'ajuste' | 'pago'
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

type Ledger = { cases: BilledCase[]; adjustments: AdjustmentEntry[]; payments: PaymentEntry[] }

const sum = (list: readonly number[]) => list.reduce((a, b) => a + b, 0)

/**
 * Cuentas por clínica (CTA-1, Iteración 5): saldo, saldo a favor, antigüedad, «Por cobrar» y
 * movimientos. Solo lectura: el repo trae los datos y todas las reglas salen de `shared`
 * (`caseChargeCents`, `caseOutstandingCents`, `agingBuckets`, `oldestOpenDays`). El saldo se
 * calcula, no se guarda (`docs/architecture.md` §5).
 */
export function createAccountsService(deps: { accounts: AccountsRepository; clock: Clock }) {
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
  }
}
export type AccountsService = ReturnType<typeof createAccountsService>
