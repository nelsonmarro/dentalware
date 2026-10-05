import { aliasedTable, and, asc, desc, eq, isNotNull, isNull, or, sql } from 'drizzle-orm'
import type { Db, Tx } from '../../db/index.ts'
import { isForeignKeyViolation } from '../../db/pg-errors.ts'
import { users } from '../../db/schema/auth.ts'
import { cases } from '../cases/schema.ts'
import { clinics } from '../clinics/schema.ts'
import type { DeliveryType } from '@dentalware/shared'
import type {
  CaseDeliveryInfoQuery,
  CaseEventLog,
  CouriersQuery,
  DeliveriesRepository,
  DeliveriesUnitOfWork,
} from './ports.ts'
import { DeliveryProofMissingError } from './errors.ts'
import { DELIVERY_PROOF_FK, deliveries } from './schema.ts'

/**
 * Repositorio de entregas/recogidas: `createDeliveriesRepo(db | Tx) satisfies
 * DeliveriesRepository` (misma firma que `createCasesRepo`, se puede re-crear sobre una `tx`
 * del `UnitOfWork` de `cases` cuando el servicio de la Tarea 3 necesite atomicidad).
 */
export function createDeliveriesRepo(db: Db | Tx) {
  return {
    async create(d) {
      const [row] = await db.insert(deliveries).values(d).returning()
      return row!
    },

    async byId(id) {
      const [row] = await db.select().from(deliveries).where(eq(deliveries.id, id)).limit(1)
      return row
    },

    async byIdWithCourier(id) {
      const [row] = await db
        .select({ delivery: deliveries, courierName: users.name })
        .from(deliveries)
        .innerJoin(users, eq(deliveries.courierId, users.id))
        .where(eq(deliveries.id, id))
        .limit(1)
      return row && { ...row.delivery, courierName: row.courierName }
    },

    async pendingFor(caseId, type) {
      const [row] = await db
        .select()
        .from(deliveries)
        .where(
          and(
            eq(deliveries.caseId, caseId),
            eq(deliveries.type, type),
            eq(deliveries.status, 'pendiente'),
          ),
        )
        .limit(1)
      return row
    },

    async linkedProofIds(caseId) {
      const rows = await db
        .select({ id: deliveries.proofAttachmentId })
        .from(deliveries)
        .where(
          and(
            eq(deliveries.caseId, caseId),
            eq(deliveries.status, 'hecha'),
            isNotNull(deliveries.proofAttachmentId),
          ),
        )
      return rows.flatMap((r) => (r.id ? [r.id] : []))
    },

    // Cierres condicionales (I-1 de la revisión final del PR 2): solo cierran una entrega que
    // sigue `pendiente`. Si dos transacciones cierran la misma a la vez, la segunda espera el
    // bloqueo de fila de la primera, Postgres re-evalúa el `WHERE` sobre la fila confirmada y no
    // actualiza nada: devuelve `false` en vez de pisar «hecha» con «fallida» (o al revés).
    // Si la constancia se borró entre la lectura del servicio y este UPDATE, la FK salta y se
    // traduce a `DeliveryProofMissingError` (M-2): la otra violación sale tal cual.
    async markDone(id, doneAt, proofAttachmentId) {
      try {
        const rows = await db
          .update(deliveries)
          .set({ status: 'hecha', doneAt, proofAttachmentId })
          .where(and(eq(deliveries.id, id), eq(deliveries.status, 'pendiente')))
          .returning({ id: deliveries.id })
        return rows.length > 0
      } catch (e) {
        if (isForeignKeyViolation(e, DELIVERY_PROOF_FK)) throw new DeliveryProofMissingError()
        throw e
      }
    },

    async markFailed(id, reason, at) {
      const rows = await db
        .update(deliveries)
        .set({ status: 'fallida', failedReason: reason, doneAt: at })
        .where(and(eq(deliveries.id, id), eq(deliveries.status, 'pendiente')))
        .returning({ id: deliveries.id })
      return rows.length > 0
    },

    /**
     * Una sola consulta con joins a `cases`, `clinics` y `users` (ADR 24: `repo.ts` puede leer
     * el `schema.ts` de otra feature para un join de solo lectura), sin N+1. `clinicId` no se
     * guarda en `deliveries` (se obtiene del trabajo, para evitar una fuente doble), así que el
     * join a `clinics` pasa siempre por `cases`.
     */
    async listForDay(q) {
      const before = sql`${deliveries.scheduledFor} < ${q.day}`
      const conds = [
        q.includeOverdue
          ? // `or(...)` solo devuelve `undefined` sin condiciones; con las tres fijas de abajo
            // siempre hay una `SQL` real, así que el `!` no oculta un caso posible.
            or(
              eq(deliveries.scheduledFor, q.day),
              and(eq(deliveries.status, 'pendiente'), before),
              // En camino al laboratorio (#118): recogida hecha antes de hoy cuyo trabajo sigue
              // por recoger; sale de la lista cuando recepción marca «Recibido».
              and(
                eq(deliveries.type, 'recogida'),
                eq(deliveries.status, 'hecha'),
                eq(cases.status, 'por_recoger'),
                before,
              ),
            )!
          : eq(deliveries.scheduledFor, q.day),
      ]
      if (q.courierId) conds.push(eq(deliveries.courierId, q.courierId))

      // UX4-18: la fecha a la que se reprogramó una fallida es la de la siguiente entrega del
      // mismo trabajo y tipo (la que creó «No se pudo» en la misma transacción). La cerrada por
      // la cancelación no tiene siguiente: queda `null`.
      const next = aliasedTable(deliveries, 'next_delivery')
      const nextFrom = sql`${deliveries} as ${sql.identifier('next_delivery')}`
      const rescheduledFor = sql<string | null>`case when ${deliveries.status} = 'fallida' then (
        select ${next.scheduledFor} from ${nextFrom}
        where ${next.caseId} = ${deliveries.caseId}
          and ${next.type} = ${deliveries.type}
          and ${next.createdAt} > ${deliveries.createdAt}
        order by ${next.createdAt} asc
        limit 1
      ) end`

      const rows = await db
        .select({
          id: deliveries.id,
          type: deliveries.type,
          status: deliveries.status,
          scheduledFor: deliveries.scheduledFor,
          doneAt: deliveries.doneAt,
          failedReason: deliveries.failedReason,
          rescheduledFor,
          caseId: cases.id,
          caseCode: cases.code,
          casePatientRef: cases.patientRef,
          caseStatus: cases.status,
          casePriority: cases.priority,
          clinicId: clinics.id,
          clinicName: clinics.name,
          clinicAddress: clinics.address,
          clinicCity: clinics.city,
          clinicPhone: clinics.phone,
          courierId: users.id,
          courierName: users.name,
        })
        .from(deliveries)
        .innerJoin(cases, eq(deliveries.caseId, cases.id))
        .innerJoin(clinics, eq(cases.clinicId, clinics.id))
        .innerJoin(users, eq(deliveries.courierId, users.id))
        .where(and(...conds))
        .orderBy(asc(clinics.name), asc(cases.code))

      return rows.map((r) => ({
        id: r.id,
        type: r.type,
        status: r.status,
        scheduledFor: r.scheduledFor,
        doneAt: r.doneAt,
        failedReason: r.failedReason,
        rescheduledFor: r.rescheduledFor,
        case: {
          id: r.caseId,
          code: r.caseCode,
          patientRef: r.casePatientRef,
          status: r.caseStatus,
          priority: r.casePriority,
        },
        clinic: {
          id: r.clinicId,
          name: r.clinicName,
          address: r.clinicAddress,
          city: r.clinicCity,
          phone: r.clinicPhone,
        },
        courier: { id: r.courierId, name: r.courierName },
      }))
    },
  } satisfies DeliveriesRepository
}

/**
 * Unidad de trabajo de `fail` (ADR 19): re-crea el repositorio de entregas sobre la misma
 * `tx` y recibe el `CaseEventLog` ya adaptado a esa `tx` (`deps.events`), que llega de la raíz
 * de composición como `createCasesRepo(tx).addEvent` (`app.ts`) — este archivo nunca importa
 * `cases/repo.ts` (frontera entre features, `docs/architecture.md` §2).
 */
export const drizzleDeliveriesUnitOfWork = (
  db: Db,
  deps: { events: (tx: Tx) => CaseEventLog },
): DeliveriesUnitOfWork => ({
  run: (fn) =>
    db.transaction((tx) => fn({ deliveries: createDeliveriesRepo(tx), events: deps.events(tx) })),
})

/** Puerto de OTRA feature (usuarios, ADR 24/29): mensajeros activos, mismo criterio que
 * `createUsersQuery` de `cases` (`activeTechnicians`). */
export function createCouriersQuery(db: Db | Tx) {
  return {
    async activeCouriers() {
      return db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(and(eq(users.role, 'mensajero'), or(eq(users.banned, false), isNull(users.banned))))
        .orderBy(asc(users.name))
    },
  } satisfies CouriersQuery
}

/**
 * La entrega pendiente, la última entrega hecha y la última recogida hecha de un trabajo, con el
 * nombre del mensajero (UX4-07/09, #118): tres lecturas con join a `users` (ADR 24, solo lectura).
 * La pendiente es como mucho una (`deliveries_one_pending_idx` por tipo, y un trabajo está por
 * recoger o enviado, no las dos cosas); una recogida hecha no es «entregado», ni al revés.
 */
export function createCaseDeliveryInfoQuery(db: Db | Tx) {
  return {
    async deliveryInfo(caseId) {
      const [pending] = await db
        .select({
          type: deliveries.type,
          courierId: deliveries.courierId,
          courierName: users.name,
          scheduledFor: deliveries.scheduledFor,
        })
        .from(deliveries)
        .innerJoin(users, eq(deliveries.courierId, users.id))
        .where(and(eq(deliveries.caseId, caseId), eq(deliveries.status, 'pendiente')))
        .limit(1)
      // La última hecha de cada tipo: la entrega («Entregado el … por …») y la recogida
      // («Recogido por … a las …», #118).
      const lastDone = async (type: DeliveryType) => {
        const [last] = await db
          .select({
            doneAt: deliveries.doneAt,
            courierName: users.name,
            proofAttachmentId: deliveries.proofAttachmentId,
          })
          .from(deliveries)
          .innerJoin(users, eq(deliveries.courierId, users.id))
          .where(
            and(
              eq(deliveries.caseId, caseId),
              eq(deliveries.type, type),
              eq(deliveries.status, 'hecha'),
              isNotNull(deliveries.doneAt),
            ),
          )
          .orderBy(desc(deliveries.doneAt))
          .limit(1)
        // `doneAt` no es nulo por el `isNotNull` de arriba; Drizzle no estrecha el tipo.
        return last?.doneAt ? { ...last, doneAt: last.doneAt } : null
      }
      const lastDelivered = await lastDone('entrega')
      const lastPickedUp = await lastDone('recogida')
      return {
        pending: pending ?? null,
        lastDelivered,
        lastPickedUp: lastPickedUp && {
          doneAt: lastPickedUp.doneAt,
          courierName: lastPickedUp.courierName,
        },
      }
    },
  } satisfies CaseDeliveryInfoQuery
}
