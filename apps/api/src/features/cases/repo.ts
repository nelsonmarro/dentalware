import type { CaseInput, CaseListQuery } from '@dentalware/shared'
import {
  CASE_PAGE_SIZE,
  canRemake,
  formatCaseCode,
  fromCents,
  isEditableStatus,
  lineTotalCents,
  remakeDueDate,
  sumCents,
  toCents,
} from '@dentalware/shared'
import { and, count, desc, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm'
import type { Db, Tx } from '../../db/index.ts'
import { users } from '../../db/schema/auth.ts'
import { clinics } from '../clinics/schema.ts'
import { doctors } from '../doctors/schema.ts'
import { clinicProductPrices, products } from '../products/schema.ts'
import { stages } from '../stages/schema.ts'
import { CaseInputError, CaseNotFoundError, CaseStateError } from './errors.ts'
import type {
  CasesRepository,
  NewCaseEvent,
  TryinsRepository,
  UnitOfWork,
  UsersQuery,
} from './ports.ts'
import { caseEvents, caseItems, caseTryins, cases, caseSequences } from './schema.ts'

async function nextCaseCode(db: Db | Tx, year: number): Promise<string> {
  const [row] = await db
    .insert(caseSequences)
    .values({ year, last: 1 })
    .onConflictDoUpdate({
      target: caseSequences.year,
      set: { last: sql`${caseSequences.last} + 1` },
    })
    .returning({ last: caseSequences.last })
  return formatCaseCode(year, row!.last)
}

/** Resuelve precio (explícito → especial de la clínica → base) y totales de cada línea. */
async function priceItems(db: Db | Tx, clinicId: string, items: CaseInput['items']) {
  const ids = [...new Set(items.map((i) => i.productId))]
  const found = ids.length
    ? await db
        .select({
          id: products.id,
          basePrice: products.basePrice,
          active: products.active,
          special: clinicProductPrices.price,
        })
        .from(products)
        .leftJoin(
          clinicProductPrices,
          and(
            eq(clinicProductPrices.productId, products.id),
            eq(clinicProductPrices.clinicId, clinicId),
          ),
        )
        .where(inArray(products.id, ids))
    : []
  const byId = new Map(found.map((p) => [p.id, p]))
  return items.map((it, sort) => {
    const p = byId.get(it.productId)
    if (!p || !p.active) {
      throw new CaseInputError('El producto no existe o está inactivo', `items.${sort}.productId`)
    }
    const unitPrice = it.unitPrice ?? p.special ?? p.basePrice
    const lineTotal = fromCents(lineTotalCents(toCents(unitPrice), it.quantity, it.discountPct))
    return {
      productId: it.productId,
      description: it.description,
      quantity: it.quantity,
      teeth: it.teeth,
      unitPrice,
      discountPct: it.discountPct.toFixed(2),
      lineTotal,
      material: it.material,
      notes: it.notes,
      sort,
    }
  })
}
const totalOf = (items: { lineTotal: string }[]) =>
  fromCents(sumCents(items.map((i) => toCents(i.lineTotal))))

function caseColumns(input: CaseInput) {
  return {
    clinicId: input.clinicId,
    doctorId: input.doctorId,
    patientRef: input.patientRef,
    patientAge: input.patientAge,
    patientSex: input.patientSex,
    boxNumber: input.boxNumber,
    priority: input.priority,
    receivedAt: input.receivedAt,
    dueDate: input.dueDate,
    shade: input.shade,
    shadeSystem: input.shadeSystem,
    reference: input.reference,
    checklist: input.checklist,
    observations: input.observations,
    prescription: input.prescription,
    internalNotes: input.internalNotes,
    assignedTechnicianId: input.assignedTechnicianId,
  }
}

async function addEventWith(db: Db | Tx, e: NewCaseEvent): Promise<void> {
  await db.insert(caseEvents).values({
    caseId: e.caseId,
    type: e.type,
    fromValue: e.fromValue ?? null,
    toValue: e.toValue ?? null,
    reason: e.reason ?? null,
    actorId: e.actorId,
  })
}

const ACTIVE_FOR_DATES = ['nuevo', 'en_proceso', 'en_espera', 'en_prueba'] as const
const effectiveDate = sql<string | null>`coalesce(${cases.promisedDate}, ${cases.dueDate})`

const ORDER_COLUMNS = {
  codigo: () => cases.code,
  entrega: () => effectiveDate,
  clinica: () => clinics.name,
  estado: () => cases.status,
} as const

/** Traduce `orden` a columnas SQL; urgentes primero y código desc como desempate siempre. */
function orderFor(orden: CaseListQuery['orden']) {
  const urgentFirst = desc(sql`${cases.priority} = 'urgente'`)
  if (!orden) return [urgentFirst, sql`${effectiveDate} asc nulls last`, desc(cases.code)]
  const [field, dir] = orden.split('-') as [keyof typeof ORDER_COLUMNS, 'desc' | undefined]
  const col = ORDER_COLUMNS[field]()
  return [
    urgentFirst,
    dir === 'desc' ? sql`${col} desc nulls last` : sql`${col} asc nulls last`,
    desc(cases.code),
  ]
}

async function listCasesWith(db: Db | Tx, q: CaseListQuery, today: string) {
  const conds = []
  if (q.vista === 'nuevos') conds.push(eq(cases.status, 'nuevo'))
  if (q.vista === 'en_curso')
    conds.push(inArray(cases.status, ['en_proceso', 'en_espera', 'en_prueba']))
  if (q.vista === 'vencen_hoy') {
    conds.push(
      and(inArray(cases.status, [...ACTIVE_FOR_DATES]), sql`${effectiveDate} = ${today}::date`)!,
    )
  }
  if (q.vista === 'atrasados') {
    conds.push(
      and(inArray(cases.status, [...ACTIVE_FOR_DATES]), sql`${effectiveDate} < ${today}::date`)!,
    )
  }
  if (q.vista === 'listos') conds.push(inArray(cases.status, ['terminado', 'enviado']))
  if (q.estado) conds.push(eq(cases.status, q.estado))
  if (q.clinicId) conds.push(eq(cases.clinicId, q.clinicId))
  if (q.doctorId) conds.push(eq(cases.doctorId, q.doctorId))
  if (q.tecnicoId) conds.push(eq(cases.assignedTechnicianId, q.tecnicoId))
  if (q.desde) conds.push(sql`${cases.receivedAt} >= ${q.desde}::date`)
  if (q.hasta) conds.push(sql`${cases.receivedAt} <= ${q.hasta}::date`)
  if (q.q) {
    const like = `%${q.q}%`
    conds.push(
      or(ilike(cases.code, like), ilike(cases.patientRef, like), ilike(cases.boxNumber, like))!,
    )
  }
  const where = conds.length ? and(...conds) : undefined
  const totalRow = await db.select({ total: count() }).from(cases).where(where)
  const total = totalRow[0]!.total
  const rows = await db
    .select({
      id: cases.id,
      code: cases.code,
      boxNumber: cases.boxNumber,
      patientRef: cases.patientRef,
      status: cases.status,
      priority: cases.priority,
      receivedAt: cases.receivedAt,
      dueDate: cases.dueDate,
      promisedDate: cases.promisedDate,
      total: cases.total,
      clinic: { id: clinics.id, name: clinics.name },
      doctor: { id: doctors.id, name: doctors.name },
      stageName: stages.name,
      stageColor: stages.color,
      technicianName: users.name,
      itemsSummary: sql<string>`(select string_agg(p.name || case when ci.quantity > 1 then ' ×' || ci.quantity else '' end, ', ' order by ci.sort) from case_items ci join products p on p.id = ci.product_id where ci.case_id = ${cases.id})`,
    })
    .from(cases)
    .innerJoin(clinics, eq(clinics.id, cases.clinicId))
    .innerJoin(doctors, eq(doctors.id, cases.doctorId))
    .leftJoin(stages, eq(stages.id, cases.currentStageId))
    .leftJoin(users, eq(users.id, cases.assignedTechnicianId))
    .where(where)
    .orderBy(...orderFor(q.orden))
    .limit(CASE_PAGE_SIZE)
    .offset((q.pagina - 1) * CASE_PAGE_SIZE)
  return {
    cases: rows.map(({ stageName, stageColor, technicianName, ...r }) => ({
      ...r,
      stage: stageName ? { name: stageName, color: stageColor! } : null,
      technician: technicianName ? { name: technicianName } : null,
    })),
    total,
    page: q.pagina,
    pageSize: CASE_PAGE_SIZE,
  }
}

/**
 * Repositorio de trabajos: opera sobre `db` (conexión) o `tx` (transacción abierta) tal cual
 * se le pase. `create` y `update` no abren transacción propia (ADR 19): el llamador que
 * necesite atomicidad lo hace a través de `drizzleUnitOfWork(db).run(...)`.
 */
export function createCasesRepo(db: Db | Tx) {
  return {
    async create(input, actorId) {
      const year = Number(input.receivedAt.slice(0, 4))
      const code = await nextCaseCode(db, year)
      const items = await priceItems(db, input.clinicId, input.items)
      const [row] = await db
        .insert(cases)
        .values({ ...caseColumns(input), code, total: totalOf(items), createdBy: actorId })
        .returning({ id: cases.id })
      await db.insert(caseItems).values(items.map((i) => ({ ...i, caseId: row!.id })))
      await addEventWith(db, { caseId: row!.id, type: 'created', toValue: code, actorId })
      return { id: row!.id, code }
    },

    async update(id, input, actorId) {
      const [current] = await db
        .select({ status: cases.status })
        .from(cases)
        .where(eq(cases.id, id))
        .for('update')
      if (!current) return false
      if (!isEditableStatus(current.status)) {
        throw new CaseStateError(`No se puede editar un trabajo en estado "${current.status}"`)
      }
      const before = await db
        .select({ productId: caseItems.productId, unitPrice: caseItems.unitPrice })
        .from(caseItems)
        .where(eq(caseItems.caseId, id))
      const items = await priceItems(db, input.clinicId, input.items)
      await db
        .update(cases)
        .set({ ...caseColumns(input), total: totalOf(items), updatedAt: new Date() })
        .where(eq(cases.id, id))
      await db.delete(caseItems).where(eq(caseItems.caseId, id))
      await db.insert(caseItems).values(items.map((i) => ({ ...i, caseId: id })))
      await addEventWith(db, { caseId: id, type: 'edited', actorId })
      const beforeMap = new Map(before.map((b) => [b.productId, b.unitPrice]))
      const changed = items.filter(
        (i) => beforeMap.has(i.productId) && beforeMap.get(i.productId) !== i.unitPrice,
      )
      if (changed.length) {
        await addEventWith(db, {
          caseId: id,
          type: 'price_changed',
          fromValue: changed.map((c) => `${c.productId}:${beforeMap.get(c.productId)}`).join(','),
          toValue: changed.map((c) => `${c.productId}:${c.unitPrice}`).join(','),
          actorId,
        })
      }
      return true
    },

    byId: (id) =>
      db.query.cases.findFirst({
        where: { id },
        with: {
          clinic: { columns: { id: true, name: true } },
          doctor: { columns: { id: true, name: true } },
          technician: { columns: { id: true, name: true } },
          stage: { columns: { id: true, name: true, color: true } },
          items: {
            orderBy: { sort: 'asc' },
            with: {
              product: { columns: { id: true, code: true, name: true, pricingUnit: true } },
            },
          },
        },
      }),

    list: (q, today) => listCasesWith(db, q, today),

    events: (caseId) =>
      db.query.caseEvents.findMany({
        where: { caseId },
        orderBy: { createdAt: 'asc' },
        with: { actor: { columns: { id: true, name: true } } },
      }),

    addEvent: (e) => addEventWith(db, e),

    async applyTransition(id, patch) {
      await db
        .update(cases)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(cases.id, id))
    },

    async turnaroundFor(caseId) {
      const rows = await db
        .select({ turnaroundDays: products.turnaroundDays })
        .from(caseItems)
        .innerJoin(products, eq(products.id, caseItems.productId))
        .where(eq(caseItems.caseId, caseId))
      return rows.reduce((max, r) => Math.max(max, r.turnaroundDays), 0)
    },

    async createRemake(parentId, input, actorId) {
      // `FOR UPDATE` sobre el padre: mismo patrón que `update`. Protege contra otra
      // `createRemake` concurrente sobre el mismo padre (la segunda espera a que la primera
      // libere la fila antes de leer el estado); no protege contra `action()`, que lee con
      // `cases.byId(id)` sin `FOR UPDATE` — una acción concurrente puede seguir colándose
      // entre esta lectura y el insert. El bloqueo sigue siendo necesario y correcto para lo
      // que sí cubre; el comentario anterior prometía más de lo que da.
      const [parent] = await db.select().from(cases).where(eq(cases.id, parentId)).for('update')
      if (!parent) throw new CaseNotFoundError()
      if (!canRemake(parent.status)) {
        throw new CaseStateError(`No se puede repetir un trabajo en estado "${parent.status}"`)
      }
      const parentItems = await db
        .select()
        .from(caseItems)
        .where(eq(caseItems.caseId, parentId))
        .orderBy(caseItems.sort)

      const year = Number(input.receivedAt.slice(0, 4))
      const code = await nextCaseCode(db, year)
      // I-3 (ronda de fixes 1, corregido en la ola de fixes del PR 1): la regla vive en
      // `remakeDueDate` (shared), no aquí — antes estaba duplicada a mano en este archivo y en
      // `fakes.ts`, y solo la copia del fake tenía test (ver `cases.test.ts`, «una fecha
      // deseada ya vencida…», que sí ejercita este adaptador contra Postgres).
      const dueDate = remakeDueDate(parent.dueDate, input.receivedAt)
      const [row] = await db
        .insert(cases)
        .values({
          // Copiado del padre: mismo paciente/clínica/doctor, mismos datos clínicos de
          // referencia (color, prescripción, notas). El hijo parte de ahí para no reescribir
          // a mano lo que ya se sabía del trabajo original.
          clinicId: parent.clinicId,
          doctorId: parent.doctorId,
          patientRef: parent.patientRef,
          patientAge: parent.patientAge,
          patientSex: parent.patientSex,
          boxNumber: parent.boxNumber,
          priority: parent.priority,
          dueDate,
          shade: parent.shade,
          shadeSystem: parent.shadeSystem,
          reference: parent.reference,
          observations: parent.observations,
          prescription: parent.prescription,
          internalNotes: parent.internalNotes,
          // Reiniciado a propósito: es una producción nueva. `checklist` se omite (usa el
          // default de la tabla, todo sin verificar): no se puede asumir que "antagonista"
          // o "fotos" del trabajo original todavía apliquen. Sin fase ni técnico: quien
          // repite decide después quién la hace, no se asume el mismo técnico responsable
          // del original (la responsabilidad de la repetición puede ser justo suya).
          code,
          receivedAt: input.receivedAt,
          // `checklist` se omite: usa el default de la tabla (todo sin verificar, ver el
          // comentario de arriba).
          parentCaseId: parentId,
          remakeReason: input.motivo,
          remakeResponsibility: input.responsabilidad,
          remakeChargePct: input.cobroPct.toFixed(2),
          total: totalOf(parentItems),
          createdBy: actorId,
        })
        .returning({ id: cases.id })
      const childId = row!.id
      await db.insert(caseItems).values(
        parentItems.map((i, sort) => ({
          caseId: childId,
          productId: i.productId,
          description: i.description,
          quantity: i.quantity,
          teeth: i.teeth,
          unitPrice: i.unitPrice,
          discountPct: i.discountPct,
          lineTotal: i.lineTotal,
          material: i.material,
          notes: i.notes,
          sort,
        })),
      )
      await addEventWith(db, {
        caseId: parentId,
        type: 'remake_created',
        fromValue: parent.code,
        toValue: code,
        reason: input.motivo,
        actorId,
      })
      await addEventWith(db, {
        caseId: childId,
        type: 'remake_created',
        fromValue: parent.code,
        toValue: code,
        reason: input.motivo,
        actorId,
      })
      return { id: childId, code }
    },
  } satisfies CasesRepository
}

/** Pruebas en boca (`case_tryins`): mismo patrón `db | tx` que `createCasesRepo`, sobre la
 * misma tabla que le pertenece a esta feature (no es una feature aparte). */
export function createTryinsRepo(db: Db | Tx): TryinsRepository {
  return {
    async open(caseId) {
      const [row] = await db
        .select()
        .from(caseTryins)
        .where(and(eq(caseTryins.caseId, caseId), isNull(caseTryins.returnedAt)))
        .limit(1)
      return row
    },
    async create(caseId, sentAt, note) {
      await db.insert(caseTryins).values({ caseId, sentAt, note })
    },
    async close(id, returnedAt) {
      await db.update(caseTryins).set({ returnedAt }).where(eq(caseTryins.id, id))
    },
  }
}

/** Puerto `UsersQuery` (ADR 24: lectura de solo lectura de la tabla `users` de otra feature,
 * sin importar su `repo.ts`): técnicos activos, para validar `assignTechnician` y para listar
 * `id`+`name` en `GET /api/trabajos/tecnicos` (Tarea 9) sin exponer correo, rol ni baneo. */
export function createUsersQuery(db: Db | Tx): UsersQuery {
  return {
    async activeTechnicians() {
      return db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(and(eq(users.role, 'tecnico'), or(eq(users.banned, false), isNull(users.banned))))
    },
  }
}

export const drizzleUnitOfWork = (db: Db): UnitOfWork => ({
  run: (fn) =>
    db.transaction((tx) => fn({ cases: createCasesRepo(tx), tryins: createTryinsRepo(tx) })),
})
