import {
  addBusinessDays,
  CASE_VIEWS,
  caseInputSchema,
  canRemake,
  fromCents,
  isActiveForDates,
  isEditableStatus,
  notEditableMessage,
  notRemakeableMessage,
  isEnCurso,
  remakeDueDate,
  sumCents,
  toCents,
  toIsoDate,
} from '@dentalware/shared'
import type {
  AttachmentKind,
  CaseInput,
  CaseListQuery,
  CaseSummary,
  CaseView,
  DeliveryStatus,
  DeliveryType,
  StageRef,
} from '@dentalware/shared'
import { CaseInputError, CaseNotFoundError, CaseStateError } from './errors.ts'
import type {
  AttachmentsQuery,
  CaseAccountQuery,
  CaseDeliveriesQuery,
  CaseDetail,
  CaseEventRow,
  CasesRepository,
  CouriersLookup,
  DeliveryLog,
  Named,
  NewCaseEvent,
  StagesQuery,
  TryinRow,
  TryinsRepository,
  UnitOfWork,
  UsersQuery,
} from './ports.ts'

/** Turnaround por defecto que usan las fixtures (mismo default que `products.turnaroundDays`
 * en el schema): las pruebas de `action('aceptar')` no necesitan variarlo por caso. */
const DEFAULT_TURNAROUND_DAYS = 5

const CLINIC_ID = '11111111-1111-4111-8111-111111111111'
const DOCTOR_ID = '22222222-2222-4222-8222-222222222222'
const PRODUCT_ID = '33333333-3333-4333-8333-333333333333'

export function caseDetailFixture(over: Partial<CaseDetail> = {}): CaseDetail {
  const base = {
    id: 'c1',
    code: '26-00001',
    boxNumber: null,
    clinicId: CLINIC_ID,
    doctorId: DOCTOR_ID,
    patientRef: 'Paciente 1',
    patientAge: null,
    patientSex: null,
    status: 'nuevo',
    currentStageId: null,
    assignedTechnicianId: null,
    priority: 'normal',
    receivedAt: '2026-09-09',
    dueDate: '2026-09-16',
    promisedDate: null,
    finishedAt: null,
    shippedAt: null,
    deliveredAt: null,
    paidAt: null,
    shade: 'A2',
    shadeSystem: null,
    reference: null,
    checklist: { antagonista: false, mordida: false, color: false, fotos: false },
    observations: null,
    prescription: 'Rx',
    internalNotes: 'nota interna',
    holdReason: null,
    parentCaseId: null,
    remakeReason: null,
    remakeResponsibility: null,
    remakeChargePct: null,
    total: '90.00',
    createdBy: 'u1',
    createdAt: new Date('2026-09-09T12:00:00Z'),
    updatedAt: new Date('2026-09-09T12:00:00Z'),
    clinic: {
      id: CLINIC_ID,
      name: 'Sonrisa',
      address: 'Av. Amazonas N34-12',
      city: 'Quito',
      phone: '02 255 1234',
    },
    doctor: { id: DOCTOR_ID, name: 'Dr. Pérez' },
    technician: null,
    stage: null,
    parentCase: null,
    items: [
      {
        id: 'i1',
        caseId: 'c1',
        productId: PRODUCT_ID,
        description: null,
        quantity: 2,
        teeth: [11, 12],
        unitPrice: '45.00',
        discountPct: '0.00',
        lineTotal: '90.00',
        material: null,
        notes: null,
        sort: 0,
        product: { id: PRODUCT_ID, code: 'ZR', name: 'Zirconio', pricingUnit: 'por_pieza' },
      },
    ],
  } satisfies CaseDetail
  return { ...base, ...over }
}

/**
 * Campos escalares de `CaseInput` (todo menos `items`, que no se traduce 1:1 al ítem
 * persistido: le faltan `id`/`lineTotal`). Mismo patrón que `caseColumns` en `repo.ts`.
 */
function caseFields(input: CaseInput) {
  const {
    clinicId,
    doctorId,
    patientRef,
    patientAge,
    patientSex,
    boxNumber,
    priority,
    receivedAt,
    dueDate,
    shade,
    shadeSystem,
    reference,
    checklist,
    observations,
    prescription,
    internalNotes,
    assignedTechnicianId,
  } = input
  return {
    clinicId,
    doctorId,
    patientRef,
    patientAge,
    patientSex,
    boxNumber,
    priority,
    receivedAt,
    dueDate,
    shade,
    shadeSystem,
    reference,
    checklist,
    observations,
    prescription,
    internalNotes,
    assignedTechnicianId,
  }
}

export function caseInputFixture(over: Partial<CaseInput> = {}): CaseInput {
  return caseInputSchema.parse({
    clinicId: CLINIC_ID,
    doctorId: DOCTOR_ID,
    patientRef: 'Paciente 1',
    receivedAt: '2026-09-09',
    items: [{ productId: PRODUCT_ID, quantity: 1 }],
    ...over,
  })
}

/**
 * Aproximación en memoria de `viewCondition` (`repo.ts`, T10): el fake no ejecuta SQL, así que
 * no puede reutilizar esa función directamente. Es una sola definición dentro de `fakes.ts`
 * (T11, #68): `list` filtra con ella y `summary` cuenta llamando a `list`, así que no hay una
 * segunda copia de "qué es atrasado" dentro de este archivo (la lección cara del PR 1). La
 * garantía de que coincide con `viewCondition` la da el test de integración contra Postgres
 * (`cases.test.ts`), no este fake: los tests de servicio con fakes prueban la orquestación.
 * `isActiveForDates`/`isEnCurso` vienen de `shared` (M-2, ola de fixes del PR 2): antes eran
 * listas escritas a mano aquí y en `repo.ts`, que podían divergir en silencio.
 */
function matchesView(view: CaseView | undefined, today: string, r: CaseDetail): boolean {
  if (!view || view === 'todos') return true
  const effectiveDate = r.promisedDate ?? r.dueDate
  const activeForDates = isActiveForDates(r.status)
  switch (view) {
    case 'nuevos':
      return r.status === 'nuevo'
    case 'en_curso':
      return isEnCurso(r.status)
    case 'vencen_hoy':
      return activeForDates && effectiveDate === today
    case 'vencen_manana': {
      // Mismo cálculo que `viewCondition` (`repo.ts`, CAL-2, UX4-04): hasta el siguiente día
      // *hábil*, sin incluir hoy.
      const siguienteDiaHabil = toIsoDate(addBusinessDays(new Date(`${today}T00:00:00`), 1, []))
      return (
        activeForDates &&
        effectiveDate !== null &&
        effectiveDate > today &&
        effectiveDate <= siguienteDiaHabil
      )
    }
    case 'atrasados':
      return activeForDates && effectiveDate !== null && effectiveDate < today
    case 'en_prueba':
      return r.status === 'en_prueba'
    case 'listos':
      return r.status === 'terminado' || r.status === 'enviado'
  }
}

/** Repositorio en memoria: suficiente para probar orquestación, enmascarado y errores. */
export function fakeCasesRepo(seed: CaseDetail[] = []) {
  const rows = new Map(seed.map((r) => [r.id, r]))
  const events: CaseEventRow[] = []
  let seq = seed.length
  let lastListQuery: Parameters<CasesRepository['list']>[0] | undefined
  const repo: CasesRepository = {
    async create(input, actorId, initialStatus = 'nuevo') {
      if (input.items.some((i) => i.productId === 'inexistente'))
        throw new CaseInputError('El producto no existe o está inactivo', 'items.0.productId')
      seq += 1
      const id = `c${seq}`
      const code = `26-0000${seq}`
      // El fake conserva las líneas de la fixture (suficientes para probar orquestación):
      // `items` no se traduce 1:1 al ítem persistido, que además lleva `id`/`lineTotal`.
      rows.set(
        id,
        caseDetailFixture({
          id,
          code,
          ...caseFields(input),
          status: initialStatus,
          createdBy: actorId,
        }),
      )
      await repo.addEvent({ caseId: id, type: 'created', toValue: code, actorId })
      return { id, code }
    },
    async update(id, input, actorId) {
      const cur = rows.get(id)
      if (!cur) return false
      if (!isEditableStatus(cur.status)) throw new CaseStateError(notEditableMessage(cur.status))
      rows.set(id, { ...cur, ...caseFields(input) })
      await repo.addEvent({ caseId: id, type: 'edited', actorId })
      return true
    },
    byId: async (id) => rows.get(id),
    // En memoria no hay concurrencia que serializar: el bloqueo de fila (#97) lo prueba el
    // test de integración de `cases.test.ts` contra Postgres.
    byIdForUpdate: async (id) => rows.get(id),
    byCode: async (code) => [...rows.values()].find((r) => r.code === code),
    list: async (q, today) => {
      lastListQuery = q
      const filtered = [...rows.values()].filter((r) => matchesView(q.vista, today, r))
      return {
        cases: filtered.map((r) => ({
          id: r.id,
          code: r.code,
          boxNumber: r.boxNumber,
          patientRef: r.patientRef,
          status: r.status,
          priority: r.priority,
          receivedAt: r.receivedAt,
          dueDate: r.dueDate,
          promisedDate: r.promisedDate,
          total: r.total,
          clinic: r.clinic,
          doctor: r.doctor,
          stage: null,
          technician: null,
          itemsSummary: 'Zirconio ×2',
        })),
        total: filtered.length,
        page: q.pagina,
        pageSize: 20,
      }
    },
    // T11 (#68): deriva de `repo.list` por vista (llamar y contar), no reescribe "qué es
    // atrasado" en una segunda copia (ver el comentario de `matchesView` arriba).
    async summary(today) {
      const entries = await Promise.all(
        CASE_VIEWS.map(async (v) => {
          const page = await repo.list({ vista: v, pagina: 1 } as CaseListQuery, today)
          return [v, page.total] as const
        }),
      )
      return Object.fromEntries(entries) as CaseSummary
    },
    events: async (caseId) =>
      events
        .filter((e) => e.caseId === caseId)
        .map((e) => ({
          ...e,
          // Mismo criterio que `repo.ts`: resuelve por código el id del trabajo relacionado
          // de un `remake_created` contra las filas conocidas del fake.
          relatedCaseId:
            e.type === 'remake_created' && e.toValue
              ? ([...rows.values()].find((r) => r.code === e.toValue)?.id ?? null)
              : null,
        })),
    async addEvent(e: NewCaseEvent) {
      events.push({
        id: `e${events.length + 1}`,
        caseId: e.caseId,
        type: e.type,
        fromValue: e.fromValue ?? null,
        toValue: e.toValue ?? null,
        reason: e.reason ?? null,
        actorId: e.actorId,
        createdAt: new Date(),
        actor: e.actorId ? { id: e.actorId, name: 'Actor' } : null,
        // Placeholder: `events()` lo recalcula por código en cada lectura (ver arriba), igual
        // que `repo.ts` lo resuelve con un `select` al leer en vez de guardarlo.
        relatedCaseId: null,
        // El fake no conoce nombres de usuarios: los nombres de `assigned` (UX3-13) son un
        // `select` sobre `users` en `repo.ts`, probado contra Postgres en `cases.test.ts`.
        fromName: null,
        toName: null,
      })
    },
    async applyTransition(id, patch) {
      const cur = rows.get(id)
      if (!cur) return
      rows.set(id, { ...cur, ...patch })
    },
    // Mismo valor para todas las fixtures (ver DEFAULT_TURNAROUND_DAYS): a las pruebas de
    // `action('aceptar')` les basta un turnaround fijo, no el de un producto real.
    turnaroundFor: async () => DEFAULT_TURNAROUND_DAYS,
    async createRemake(parentId, input, actorId) {
      const parent = rows.get(parentId)
      if (!parent) throw new CaseNotFoundError()
      if (!canRemake(parent.status)) {
        throw new CaseStateError(notRemakeableMessage(parent.status))
      }
      seq += 1
      const id = `c${seq}`
      const code = `26-0000${seq}`
      const items = parent.items.map((i, sort) => ({
        ...i,
        id: `${id}-i${sort}`,
        caseId: id,
        sort,
      }))
      // I-3 (ronda de fixes 1): misma regla que `repo.ts`, ahora en `remakeDueDate` (shared)
      // en vez de duplicada a mano en cada adaptador.
      const dueDate = remakeDueDate(parent.dueDate, input.receivedAt)
      rows.set(
        id,
        caseDetailFixture({
          id,
          code,
          clinicId: parent.clinicId,
          doctorId: parent.doctorId,
          patientRef: parent.patientRef,
          patientAge: parent.patientAge,
          patientSex: parent.patientSex,
          boxNumber: parent.boxNumber,
          priority: parent.priority,
          status: 'nuevo',
          currentStageId: null,
          assignedTechnicianId: null,
          receivedAt: input.receivedAt,
          dueDate,
          promisedDate: null,
          finishedAt: null,
          shippedAt: null,
          deliveredAt: null,
          paidAt: null,
          shade: parent.shade,
          shadeSystem: parent.shadeSystem,
          reference: parent.reference,
          checklist: { antagonista: false, mordida: false, color: false, fotos: false },
          observations: parent.observations,
          prescription: parent.prescription,
          internalNotes: parent.internalNotes,
          holdReason: null,
          parentCaseId: parentId,
          remakeReason: input.motivo,
          remakeResponsibility: input.responsabilidad,
          remakeChargePct: input.cobroPct.toFixed(2),
          // M-5 (ronda de fixes 1): recalculado de las líneas copiadas, igual que `totalOf` en
          // `repo.ts` — no una segunda copia manual de `parent.total` (que además ya no
          // coincidiría si algún día el hijo pudiera copiar un subconjunto de líneas).
          total: fromCents(sumCents(items.map((i) => toCents(i.lineTotal)))),
          createdBy: actorId,
          clinic: parent.clinic,
          doctor: parent.doctor,
          technician: null,
          stage: null,
          parentCase: { code: parent.code },
          items,
        }),
      )
      await repo.addEvent({
        caseId: parentId,
        type: 'remake_created',
        fromValue: parent.code,
        toValue: code,
        reason: input.motivo,
        actorId,
      })
      await repo.addEvent({
        caseId: id,
        type: 'remake_created',
        fromValue: parent.code,
        toValue: code,
        reason: input.motivo,
        actorId,
      })
      return { id, code }
    },
    // Mismo criterio que `repo.ts`: solo los hijos de primer grado, de la más reciente a la
    // más antigua. El `Map` conserva el orden de inserción (ascendente); `.reverse()` lo
    // vuelve el orden de creación descendente que pide el puerto, sin un `createdAt` propio.
    async remakesOf(parentId) {
      return [...rows.values()]
        .filter((r) => r.parentCaseId === parentId)
        .reverse()
        .map((r) => ({
          id: r.id,
          code: r.code,
          status: r.status,
          receivedAt: r.receivedAt,
          remakeReason: r.remakeReason,
        }))
    },
  }
  return { repo, rows, events, lastListQuery: () => lastListQuery }
}

/** Pruebas en boca en memoria: una prueba abierta por trabajo como mucho, ids autoincrementales. */
export function fakeTryins(seed: TryinRow[] = []): TryinsRepository {
  const rows = new Map(seed.map((r) => [r.id, r]))
  let seq = seed.length
  return {
    async open(caseId) {
      return [...rows.values()].find((r) => r.caseId === caseId && r.returnedAt === null)
    },
    async create(caseId, sentAt, note) {
      seq += 1
      const id = `t${seq}`
      rows.set(id, { id, caseId, sentAt, returnedAt: null, note, createdAt: new Date() })
    },
    async close(id, returnedAt) {
      const cur = rows.get(id)
      if (cur) rows.set(id, { ...cur, returnedAt })
    },
  }
}

/** Un adjunto tal como lo ve `cases` al comprobar la constancia de una entrega (ENT-4). */
export type FakeAttachment = { id: string; caseId: string; mime: string; kind: AttachmentKind }

/** `AttachmentsQuery` en memoria: `hasDocument` fijo y los adjuntos que `constancia` puede
 * encontrar. Solo devuelve un adjunto si es del trabajo pedido, igual que el repo real. */
export const fakeAttachmentsQuery = (
  hasDocument = true,
  attachments: FakeAttachment[] = [],
): AttachmentsQuery => ({
  hasDocument: async () => hasDocument,
  constancia: async (caseId, attachmentId) => {
    const found = attachments.find((a) => a.id === attachmentId && a.caseId === caseId)
    return found && { mime: found.mime, kind: found.kind }
  },
})

const DEFAULT_STAGES: StageRef[] = [{ id: 'f1', sort: 1, active: true }]
export const fakeStagesQuery = (stages: StageRef[] = DEFAULT_STAGES): StagesQuery => ({
  active: async () => stages,
})

/** Técnicos activos en memoria, para `assignTechnician` y para `CasesService.technicians`.
 * Vacío por defecto: los llamadores que no prueban esas rutas no necesitan declarar ningún
 * técnico. */
export const fakeUsersQuery = (technicians: Named[] = []): UsersQuery => ({
  activeTechnicians: async () => technicians,
})

/** Una fila de entrega/recogida tal como la ve `cases` (el puerto `DeliveryLog`). */
export type FakeDelivery = {
  id: string
  caseId: string
  type: DeliveryType
  courierId: string
  scheduledFor: string
  status: DeliveryStatus
  doneAt: Date | null
  proofAttachmentId: string | null
  /** Solo en las cerradas sin hacer (`markFailed`). */
  failedReason?: string
}

/** `DeliveryLog` en memoria (Iteración 4): suficiente para probar que el servicio programa,
 * encuentra y cierra la entrega pendiente. El repositorio completo de entregas y su fake viven
 * en la feature `deliveries`; aquí solo lo que el puerto de `cases` necesita. */
export function fakeDeliveryLog(
  seed: FakeDelivery[] = [],
  /** Nombre de cada mensajero por id; sin él, el nombre es el id. */
  courierNames: Record<string, string> = {},
) {
  const rows = new Map(seed.map((r) => [r.id, r]))
  let seq = seed.length
  const nameOf = (id: string) => courierNames[id] ?? id
  // Un mismo almacén en memoria cumple el puerto de escritura (`DeliveryLog`) y la lectura de
  // la ficha (`CaseDeliveriesQuery`), como en la API los cumple la misma tabla.
  const log: DeliveryLog & CaseDeliveriesQuery = {
    async deliveryInfo(caseId) {
      const mine = [...rows.values()].filter((r) => r.caseId === caseId)
      const pending = mine.find((r) => r.status === 'pendiente')
      const lastDone = (type: DeliveryType) =>
        mine
          .filter((r) => r.type === type && r.status === 'hecha' && r.doneAt)
          .sort((a, b) => b.doneAt!.getTime() - a.doneAt!.getTime())[0]
      const last = lastDone('entrega')
      const picked = lastDone('recogida')
      return {
        pending: pending
          ? {
              id: pending.id,
              type: pending.type,
              courierId: pending.courierId,
              courierName: nameOf(pending.courierId),
              scheduledFor: pending.scheduledFor,
            }
          : null,
        lastDelivered: last
          ? {
              doneAt: last.doneAt!,
              courierName: nameOf(last.courierId),
              proofAttachmentId: last.proofAttachmentId,
            }
          : null,
        lastPickedUp: picked
          ? { doneAt: picked.doneAt!, courierName: nameOf(picked.courierId) }
          : null,
      }
    },
    async create(d) {
      seq += 1
      const id = `d${seq}`
      rows.set(id, { id, ...d, status: 'pendiente', doneAt: null, proofAttachmentId: null })
      return { id }
    },
    async pendingFor(caseId, type) {
      return [...rows.values()].find(
        (r) => r.caseId === caseId && r.type === type && r.status === 'pendiente',
      )
    },
    // Mismo contrato condicional que `deliveries/repo.ts`: solo cierra una entrega `pendiente`.
    async markDone(id, doneAt, proofAttachmentId) {
      const cur = rows.get(id)
      if (cur?.status !== 'pendiente') return false
      rows.set(id, { ...cur, status: 'hecha', doneAt, proofAttachmentId })
      return true
    },
    async markFailed(id, reason, at) {
      const cur = rows.get(id)
      if (cur?.status !== 'pendiente') return false
      rows.set(id, { ...cur, status: 'fallida', doneAt: at, failedReason: reason })
      return true
    },
  }
  return { log, rows }
}

/** `CaseAccountQuery` en memoria (Iteración 5): Σ ajustes y Σ asignaciones vigentes por
 * trabajo (0 si no se dan). `calls` guarda los trabajos consultados, para probar que a quien no
 * ve la cuenta ni se le consulta. */
export function fakeCaseAccountQuery(
  totals: Record<string, { adjustmentsCents: number; allocatedCents: number }> = {},
) {
  const calls: string[] = []
  const query: CaseAccountQuery = {
    async caseTotals(caseIds) {
      calls.push(...caseIds)
      return caseIds.map((caseId) => ({
        caseId,
        adjustmentsCents: totals[caseId]?.adjustmentsCents ?? 0,
        allocatedCents: totals[caseId]?.allocatedCents ?? 0,
      }))
    },
  }
  return { query, calls }
}

/** Mensajeros activos en memoria para `CouriersLookup`. Vacío por defecto: quien no prueba la
 * recogida no necesita declarar ninguno. */
export const fakeCouriersLookup = (couriers: Named[] = []): CouriersLookup => ({
  findActiveCourier: async (userId) => couriers.find((c) => c.id === userId),
})

// `tryins` y `deliveries` por defecto para llamadores que no los necesitan (p. ej.
// `import.service.test.ts`, que solo usa `cases` dentro de `uow.run`): evita tocar sus
// fixtures al ampliar el puerto.
export const fakeUow = (
  cases: CasesRepository,
  tryins: TryinsRepository = fakeTryins(),
  deliveries: DeliveryLog = fakeDeliveryLog().log,
): UnitOfWork => ({
  run: (fn) => fn({ cases, tryins, deliveries }),
})
export const fixedClock = (today = '2026-09-09') => ({
  today: () => today,
  now: () => new Date(`${today}T12:00:00Z`),
})
