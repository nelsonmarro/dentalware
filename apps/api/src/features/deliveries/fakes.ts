import type { CasePriority, CaseStatus } from '@dentalware/shared'
import type {
  CaseEventLog,
  CouriersQuery,
  DeliveriesRepository,
  DeliveriesUnitOfWork,
  DeliveryRow,
  Named,
} from './ports.ts'

/** Lo que `listForDay` necesita de un trabajo para construir su fila (ADR 24 en memoria: el
 * join que hace `repo.ts` contra `cases`/`clinics`, aquí resuelto por consulta a un mapa). */
export type DeliveryCaseRef = {
  code: string
  patientRef: string | null
  status: CaseStatus
  priority: CasePriority
  clinic: {
    id: string
    name: string
    address: string | null
    city: string | null
    phone: string | null
  }
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
    async byIdWithCourier(id) {
      const row = rows.get(id)
      return row && { ...row, courierName: couriers.get(row.courierId) ?? 'Mensajero' }
    },
    async pendingFor(caseId, type) {
      return [...rows.values()].find(
        (r) => r.caseId === caseId && r.type === type && r.status === 'pendiente',
      )
    },
    async linkedProofIds(caseId) {
      return [...rows.values()].flatMap((r) =>
        r.caseId === caseId && r.status === 'hecha' && r.proofAttachmentId
          ? [r.proofAttachmentId]
          : [],
      )
    },
    // Mismo contrato condicional que `repo.ts`: solo cierra una entrega `pendiente`.
    async markDone(id, doneAt, proofAttachmentId) {
      const cur = rows.get(id)
      if (cur?.status !== 'pendiente') return false
      rows.set(id, { ...cur, status: 'hecha', doneAt, proofAttachmentId })
      return true
    },
    async markFailed(id, reason, at) {
      const cur = rows.get(id)
      if (cur?.status !== 'pendiente') return false
      rows.set(id, { ...cur, status: 'fallida', failedReason: reason, doneAt: at })
      return true
    },
    async listForDay(q) {
      const matches = [...rows.values()].filter((r) => {
        if (q.courierId && r.courierId !== q.courierId) return false
        if (r.scheduledFor === q.day) return true
        if (!q.includeOverdue) return false
        // Pendiente atrasada, o recogida hecha cuyo trabajo sigue por recoger (en camino, #118),
        // sea cual sea su fecha.
        if (r.status === 'pendiente') return r.scheduledFor < q.day
        return (
          r.type === 'recogida' &&
          r.status === 'hecha' &&
          cases.get(r.caseId)?.status === 'por_recoger'
        )
      })
      // Mismo criterio que `repo.ts` (UX4-18): la siguiente del mismo trabajo y tipo, creada
      // después (aquí, el orden de inserción del mapa).
      const all = [...rows.values()]
      const rescheduledFor = (r: DeliveryRow) =>
        r.status === 'fallida'
          ? (all.slice(all.indexOf(r) + 1).find((n) => n.caseId === r.caseId && n.type === r.type)
              ?.scheduledFor ?? null)
          : null
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
            rescheduledFor: rescheduledFor(r),
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

/** Evento del trabajo en memoria (para `service.test.ts` de `fail` y `pickUp`, sin Postgres):
 * guarda cada `delivery_failed` y `picked_up` que escribe el servicio, visible para el test. */
export function fakeCaseEventLog() {
  const events: Parameters<CaseEventLog['addEvent']>[0][] = []
  const log: CaseEventLog = {
    async addEvent(e) {
      events.push(e)
    },
  }
  return { log, events }
}

/** `DeliveriesUnitOfWork` en memoria: sin transacción real, solo re-usa el mismo repo y log
 * (mismo criterio que el `uow` en memoria de `cases/fakes.ts`). */
export function fakeDeliveriesUnitOfWork(
  repo: DeliveriesRepository,
  events: CaseEventLog,
): DeliveriesUnitOfWork {
  return { run: (fn) => fn({ deliveries: repo, events }) }
}
