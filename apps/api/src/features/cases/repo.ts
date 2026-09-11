import type { CaseInput, CaseListQuery } from '@dentalware/shared'
import {
  CASE_PAGE_SIZE,
  formatCaseCode,
  fromCents,
  isEditableStatus,
  lineTotalCents,
  sumCents,
  toCents,
} from '@dentalware/shared'
import { and, count, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm'
import type { Db, Tx } from '../../db/index.ts'
import { users } from '../../db/schema/auth.ts'
import { clinics } from '../clinics/schema.ts'
import { doctors } from '../doctors/schema.ts'
import { clinicProductPrices, products } from '../products/schema.ts'
import { stages } from '../stages/schema.ts'
import { CaseInputError, CaseStateError } from './errors.ts'
import type { CasesRepository, NewCaseEvent, UnitOfWork } from './ports.ts'
import { caseEvents, caseItems, cases, caseSequences } from './schema.ts'

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
    .orderBy(
      desc(sql`${cases.priority} = 'urgente'`),
      sql`${effectiveDate} asc nulls last`,
      desc(cases.code),
    )
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
  } satisfies CasesRepository
}

export const drizzleUnitOfWork = (db: Db): UnitOfWork => ({
  run: (fn) => db.transaction((tx) => fn({ cases: createCasesRepo(tx) })),
})
