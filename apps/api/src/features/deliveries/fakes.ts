import type { CasePriority, CaseStatus } from '@dentalware/shared'
import type { CouriersQuery, DeliveriesRepository, DeliveryRow, Named } from './ports.ts'

/** Lo que `listForDay` necesita de un trabajo para construir su fila (ADR 24 en memoria: el
 * join que hace `repo.ts` contra `cases`/`clinics`, aquí resuelto por consulta a un mapa). */
export type DeliveryCaseRef = {
  code: string
  patientRef: string | null
  status: CaseStatus
  priority: CasePriority
  clinic: { id: string; name: string; address: string | null; phone: string | null }
}

/**
 * Mismo comportamiento que `repo.ts` en memoria, para probar `service.ts` (Tarea 3) sin
 * Postgres. `cases` y `couriers` son los datos de otras features que `listForDay` necesita
 * para su join (ADR 24): el llamador los construye a partir de sus propias fixtures (p. ej.
 * `fakeCasesRepo` de `cases/fakes.ts`), esta fake no los inventa ni los duplica.
 */
export function fakeDeliveriesRepo(
  cases: Map<string, DeliveryCaseRef>,
  couriers: Map<string, string> = new Map(),
  seed: DeliveryRow[] = [],
) {
  const rows = new Map(seed.map((r) => [r.id, r]))
  let seq = seed.length

  const repo: DeliveriesRepository = {
    async create(d) {
      seq += 1
      const id = `d${seq}`
      const row: DeliveryRow = {
        id,
        caseId: d.caseId,
        type: d.type,
        status: 'pendiente',
        courierId: d.courierId,
        scheduledFor: d.scheduledFor,
        doneAt: null,
        proofAttachmentId: null,
        failedReason: null,
        createdAt: new Date(),
      }
      rows.set(id, row)
      return row
    },
    async byId(id) {
      return rows.get(id)
    },
    async pendingFor(caseId, type) {
      return [...rows.values()].find(
        (r) => r.caseId === caseId && r.type === type && r.status === 'pendiente',
      )
    },
    async markDone(id, doneAt, proofAttachmentId) {
      const cur = rows.get(id)
      if (!cur) return
      rows.set(id, { ...cur, status: 'hecha', doneAt, proofAttachmentId })
    },
    async markFailed(id, reason, at) {
      const cur = rows.get(id)
      if (!cur) return
      rows.set(id, { ...cur, status: 'fallida', failedReason: reason, doneAt: at })
    },
    async listForDay(q) {
      const matches = [...rows.values()].filter((r) => {
        if (q.courierId && r.courierId !== q.courierId) return false
        if (r.scheduledFor === q.day) return true
        return q.includeOverdue && r.status === 'pendiente' && r.scheduledFor < q.day
      })
      return matches
        .map((r) => {
          const c = cases.get(r.caseId)
          if (!c) throw new Error(`fakeDeliveriesRepo: trabajo ${r.caseId} no existe en el mapa`)
          return {
            id: r.id,
            type: r.type,
            status: r.status,
            scheduledFor: r.scheduledFor,
            doneAt: r.doneAt,
            failedReason: r.failedReason,
            case: {
              id: r.caseId,
              code: c.code,
              patientRef: c.patientRef,
              status: c.status,
              priority: c.priority,
            },
            clinic: c.clinic,
            courier: { id: r.courierId, name: couriers.get(r.courierId) ?? 'Mensajero' },
          }
        })
        .sort(
          (a, b) =>
            a.clinic.name.localeCompare(b.clinic.name) || a.case.code.localeCompare(b.case.code),
        )
    },
  }
  return { repo, rows }
}

/** Mensajeros activos en memoria, mismo patrón que `fakeUsersQuery` de `cases`. */
export const fakeCouriersQuery = (couriers: Named[] = []): CouriersQuery => ({
  activeCouriers: async () => couriers,
})
