import type { CaseStatus } from '@dentalware/shared'
import type {
  AccountsRepository,
  AdjustmentEntry,
  BilledCase,
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

/**
 * Mismo comportamiento que `repo.ts` en memoria, para probar `service.ts` sin Postgres: filtra
 * los trabajos `entregado`/`cobrado` y suma ajustes y asignaciones como las consultas del repo
 * (las asignaciones de un pago anulado no cuentan para el trabajo; sí para el pago).
 */
export function fakeAccountsRepo(
  seed: {
    clinics?: ClinicRef[]
    cases?: FakeCase[]
    adjustments?: FakeAdjustment[]
    payments?: FakePayment[]
    allocations?: FakeAllocation[]
  } = {},
): AccountsRepository {
  const clinics = seed.clinics ?? []
  const cases = seed.cases ?? []
  const adjustments = seed.adjustments ?? []
  const payments = seed.payments ?? []
  const allocations = seed.allocations ?? []
  const of = <T extends { clinicId: string }>(rows: readonly T[], clinicId?: string) =>
    clinicId === undefined ? [...rows] : rows.filter((r) => r.clinicId === clinicId)
  const sum = (list: readonly number[]) => list.reduce((a, b) => a + b, 0)
  const voided = new Set(payments.filter((p) => p.voided).map((p) => p.id))

  return {
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
          adjustmentsCents: sum(
            adjustments.filter((a) => a.caseId === c.id).map((a) => a.amountCents),
          ),
          allocatedCents: sum(
            allocations
              .filter((a) => a.caseId === c.id && !voided.has(a.paymentId))
              .map((a) => a.amountCents),
          ),
        }))
    },
    async adjustments(clinicId) {
      return of(adjustments, clinicId).map(({ caseId, ...a }) => {
        const found = caseId === null ? undefined : cases.find((c) => c.id === caseId)
        return { ...a, case: found ? { id: found.id, code: found.code } : null }
      })
    },
    async payments(clinicId) {
      return of(payments, clinicId).map((p) => ({
        ...p,
        allocatedCents: sum(
          allocations.filter((a) => a.paymentId === p.id).map((a) => a.amountCents),
        ),
      }))
    },
  }
}
