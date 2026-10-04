import type { CaseInput, CaseListQuery, CaseSummary, CaseView } from '@dentalware/shared'
import {
  ACTIVE_FOR_DATES_STATUSES,
  addBusinessDays,
  CASE_PAGE_SIZE,
  CASE_VIEWS,
  canRemake,
  EN_CURSO_STATUSES,
  formatCaseCode,
  fromCents,
  isEditableStatus,
  notEditableMessage,
  notRemakeableMessage,
  lineTotalCents,
  remakeDueDate,
  sumCents,
  toCents,
  toIsoDate,
} from '@dentalware/shared'
import { and, asc, count, desc, eq, ilike, inArray, isNull, or, sql, type SQL } from 'drizzle-orm'
import type { Db, Tx } from '../../db/index.ts'
import { users } from '../../db/schema/auth.ts'
import { clinics } from '../clinics/schema.ts'
import { doctors } from '../doctors/schema.ts'
import { clinicProductPrices, products } from '../products/schema.ts'
import { stages } from '../stages/schema.ts'
import { CaseInputError, CaseNotFoundError, CaseStateError } from './errors.ts'
import type {
  CasesRepository,
  DeliveryLog,
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

const effectiveDate = sql<string | null>`coalesce(${cases.promisedDate}, ${cases.dueDate})`

const ORDER_COLUMNS = {
  codigo: () => cases.code,
  entrega: () => effectiveDate,
  clinica: () => clinics.name,
  estado: () => cases.status,
} as const

/**
 * Condición SQL de cada vista rápida, en un `Record<CaseView, …>` exhaustivo (T10, #68): una
 * vista nueva en `CASE_VIEWS` no compila aquí sin su condición. Única definición de "qué cae
 * en cada vista": la usa `listCasesWith` para filtrar la lista y la Tarea 11 la reutiliza en
 * `count(*) filter (where …)` para el resumen (INI-1 exige que cada contador coincida con el
 * total de su lista; dos definiciones podrían divergir en silencio).
 */
function viewCondition(view: CaseView, today: string): SQL | undefined {
  // CAL-2 (#80) y UX4-04: "mañana" llega hasta el siguiente día *hábil* (ADR 30), calculado en
  // JS con el mismo helper que usa `promisedDate` al aceptar un trabajo — nunca en SQL, para no
  // duplicar la regla de fin de semana/feriados en dos lenguajes. Es un rango (`hoy <` fecha
  // `≤ siguiente hábil`) y no una igualdad: así lo que vence el sábado sale el viernes.
  const siguienteDiaHabil = toIsoDate(addBusinessDays(new Date(`${today}T00:00:00`), 1, []))
  const conditionByView: Record<CaseView, SQL | undefined> = {
    nuevos: eq(cases.status, 'nuevo'),
    en_curso: inArray(cases.status, [...EN_CURSO_STATUSES]),
    vencen_hoy: and(
      inArray(cases.status, [...ACTIVE_FOR_DATES_STATUSES]),
      sql`${effectiveDate} = ${today}::date`,
    ),
    vencen_manana: and(
      inArray(cases.status, [...ACTIVE_FOR_DATES_STATUSES]),
      sql`${effectiveDate} > ${today}::date and ${effectiveDate} <= ${siguienteDiaHabil}::date`,
    ),
    atrasados: and(
      inArray(cases.status, [...ACTIVE_FOR_DATES_STATUSES]),
      sql`${effectiveDate} < ${today}::date`,
    ),
    en_prueba: eq(cases.status, 'en_prueba'),
    listos: inArray(cases.status, ['terminado', 'enviado']),
    todos: undefined,
  }
  return conditionByView[view]
}

/**
 * Un contador por vista, un solo viaje a la BD (T11, #68): reutiliza `viewCondition` (misma
 * condición que filtra `listCasesWith`) agregada con `count(*) filter (where …)`; `todos`
 * (`viewCondition` devuelve `undefined`) cuenta sin filtro. Ninguna condición se reescribe aquí.
 */
async function summaryWith(db: Db | Tx, today: string): Promise<CaseSummary> {
  const selection = Object.fromEntries(
    CASE_VIEWS.map((view) => {
      const cond = viewCondition(view, today)
      return [
        view,
        cond
          ? sql<number>`count(*) filter (where ${cond})`.mapWith(Number)
          : sql<number>`count(*)`.mapWith(Number),
      ]
    }),
  )
  const [row] = await db.select(selection).from(cases)
  // Un agregado sin `GROUP BY` devuelve siempre exactamente una fila, aunque no haya ningún
  // trabajo (los `count` valen 0), así que `row` no puede faltar. Se comprueba de todos modos
  // en vez de descartar el `| undefined` con el cast: si alguien añade un `GROUP BY`, esto
  // falla en voz alta en lugar de devolver `undefined` como resumen.
  if (!row) throw new Error('El resumen de trabajos no devolvió ninguna fila')
  // `Object.fromEntries` pierde el literal de las claves; salen de `CASE_VIEWS`, la misma lista
  // de la que se deriva `CaseView`, así que no pueden faltar ni sobrar.
  return row as CaseSummary
}

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
  const vista = viewCondition(q.vista, today)
  if (vista) conds.push(vista)
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
 * necesite atomicidad lo hace a través de `drizzleUnitOfWork(db, …).run(...)`.
 */
export function createCasesRepo(db: Db | Tx) {
  const byId = (id: string) =>
    db.query.cases.findFirst({
      where: { id },
      with: {
        clinic: { columns: { id: true, name: true, address: true, city: true, phone: true } },
        doctor: { columns: { id: true, name: true } },
        technician: { columns: { id: true, name: true } },
        stage: { columns: { id: true, name: true, color: true } },
        parentCase: { columns: { code: true } },
        items: {
          orderBy: { sort: 'asc' },
          with: {
            product: { columns: { id: true, code: true, name: true, pricingUnit: true } },
          },
        },
      },
    })

  return {
    async create(input, actorId, initialStatus = 'nuevo') {
      const year = Number(input.receivedAt.slice(0, 4))
      const code = await nextCaseCode(db, year)
      const items = await priceItems(db, input.clinicId, input.items)
      const [row] = await db
        .insert(cases)
        .values({
          ...caseColumns(input),
          status: initialStatus,
          code,
          total: totalOf(items),
          createdBy: actorId,
        })
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
        throw new CaseStateError(notEditableMessage(current.status))
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

    byId,

    // #97: bloquea la fila del trabajo hasta el fin de la transacción y después lee el detalle
    // con `byId`. Las consultas relacionales de Drizzle (`db.query`) no admiten `.for(...)`,
    // así que el bloqueo va en un `select` aparte sobre la misma conexión (`tx`). Es
    // `FOR NO KEY UPDATE`, no `FOR UPDATE`: sigue serializando acciones, fase y técnico (y choca
    // con el `FOR UPDATE` de `update`/`createRemake`), pero no hace esperar a los inserts de
    // otras transacciones que solo referencian el trabajo por FK (comentarios, adjuntos,
    // eventos), que toman `FOR KEY SHARE`.
    async byIdForUpdate(id) {
      const [locked] = await db
        .select({ id: cases.id })
        .from(cases)
        .where(eq(cases.id, id))
        .for('no key update')
      if (!locked) return undefined
      return byId(id)
    },

    // Mismo `with` que `byId` (Tarea 15, FIC-2 #72): la ficha corta del QR necesita el detalle
    // completo, solo cambia la condición de búsqueda (código en vez de id).
    byCode: (code) =>
      db.query.cases.findFirst({
        where: { code },
        with: {
          clinic: { columns: { id: true, name: true, address: true, city: true, phone: true } },
          doctor: { columns: { id: true, name: true } },
          technician: { columns: { id: true, name: true } },
          stage: { columns: { id: true, name: true, color: true } },
          parentCase: { columns: { code: true } },
          items: {
            orderBy: { sort: 'asc' },
            with: {
              product: { columns: { id: true, code: true, name: true, pricingUnit: true } },
            },
          },
        },
      }),

    list: (q, today) => listCasesWith(db, q, today),

    summary: (today) => summaryWith(db, today),

    async events(caseId) {
      const rows = await db.query.caseEvents.findMany({
        where: { caseId },
        orderBy: { createdAt: 'asc' },
        with: { actor: { columns: { id: true, name: true } } },
      })
      // `relatedCaseId` (I-2, ola de fixes del PR 1, lote B): solo `remake_created` lleva un
      // código de trabajo en `toValue`; se resuelve a un id con un join de solo lectura sobre
      // el propio schema (mismo patrón que cualquier `repo.ts`, sin cruzar features). En la
      // ficha del padre resuelve al hijo; en la del hijo, a sí mismo (la web lo ignora ahí).
      const codes = [
        ...new Set(
          rows
            .filter(
              (r): r is typeof r & { toValue: string } =>
                r.type === 'remake_created' && !!r.toValue,
            )
            .map((r) => r.toValue),
        ),
      ]
      const related = codes.length
        ? await db
            .select({ id: cases.id, code: cases.code })
            .from(cases)
            .where(inArray(cases.code, codes))
        : []
      const idByCode = new Map(related.map((c) => [c.code, c.id]))
      // UX3-13: nombres de origen y destino de cada `assigned`, con un join de solo lectura
      // sobre `users` (como `actor`). Sin filtrar por `banned`: un técnico que ya no está
      // activo sigue teniendo nombre en el historial.
      const userIds = [
        ...new Set(
          rows
            .filter((r) => r.type === 'assigned')
            .flatMap((r) => [r.fromValue, r.toValue])
            .filter((v): v is string => !!v),
        ),
      ]
      const named = userIds.length
        ? await db
            .select({ id: users.id, name: users.name })
            .from(users)
            .where(inArray(users.id, userIds))
        : []
      const nameById = new Map(named.map((u) => [u.id, u.name]))
      const nameOf = (r: (typeof rows)[number], id: string | null) =>
        r.type === 'assigned' && id ? (nameById.get(id) ?? null) : null
      return rows.map((r) => ({
        ...r,
        relatedCaseId:
          r.type === 'remake_created' && r.toValue ? (idByCode.get(r.toValue) ?? null) : null,
        fromName: nameOf(r, r.fromValue),
        toName: nameOf(r, r.toValue),
      }))
    },

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
      // `createRemake` concurrente sobre el mismo padre y, desde #97, también contra `action()`,
      // `changeStage()` y `assignTechnician()`, que leen con `byIdForUpdate` dentro de su
      // transacción: la operación que llega segunda espera a que la primera libere la fila y
      // valida contra el estado que dejó.
      const [parent] = await db.select().from(cases).where(eq(cases.id, parentId)).for('update')
      if (!parent) throw new CaseNotFoundError()
      if (!canRemake(parent.status)) {
        throw new CaseStateError(notRemakeableMessage(parent.status))
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

    // #96, Tarea 9: solo los hijos de primer grado (`where parentCaseId = :id`, sin recursión:
    // ver el JSDoc del puerto), de la más reciente a la más antigua por fecha de creación real
    // (no por `receivedAt`, que puede repetirse el mismo día entre varias repeticiones).
    async remakesOf(parentId) {
      return db.query.cases.findMany({
        where: { parentCaseId: parentId },
        orderBy: { createdAt: 'desc' },
        columns: { id: true, code: true, status: true, receivedAt: true, remakeReason: true },
      })
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
        .orderBy(asc(users.name))
    },
  }
}

/**
 * Unidad de trabajo de los trabajos (ADR 19): re-crea sobre la misma `tx` los repositorios de
 * `cases` y, desde la Iteración 4, el registro de entregas. La factoría de entregas llega de la
 * raíz de composición (`app.ts`: `createDeliveriesRepo`): este archivo no importa el
 * `repo.ts` de `deliveries` (frontera entre features, `docs/architecture.md` §2).
 */
export const drizzleUnitOfWork = (
  db: Db,
  deps: { deliveries: (tx: Tx) => DeliveryLog },
): UnitOfWork => ({
  run: (fn) =>
    db.transaction((tx) =>
      fn({
        cases: createCasesRepo(tx),
        tryins: createTryinsRepo(tx),
        deliveries: deps.deliveries(tx),
      }),
    ),
})
