import {
  caseInputSchema,
  canRemake,
  fromCents,
  isEditableStatus,
  remakeDueDate,
  sumCents,
  toCents,
} from '@dentalware/shared'
import type { CaseInput, StageRef } from '@dentalware/shared'
import { CaseInputError, CaseNotFoundError, CaseStateError } from './errors.ts'
import type {
  CaseDetail,
  CaseEventRow,
  CasesRepository,
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
    clinic: { id: CLINIC_ID, name: 'Sonrisa' },
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

/** Repositorio en memoria: suficiente para probar orquestación, enmascarado y errores. */
export function fakeCasesRepo(seed: CaseDetail[] = []) {
  const rows = new Map(seed.map((r) => [r.id, r]))
  const events: CaseEventRow[] = []
  let seq = seed.length
  let lastListQuery: Parameters<CasesRepository['list']>[0] | undefined
  const repo: CasesRepository = {
    async create(input, actorId) {
      if (input.items.some((i) => i.productId === 'inexistente'))
        throw new CaseInputError('El producto no existe o está inactivo', 'items.0.productId')
      seq += 1
      const id = `c${seq}`
      const code = `26-0000${seq}`
      // El fake conserva las líneas de la fixture (suficientes para probar orquestación):
      // `items` no se traduce 1:1 al ítem persistido, que además lleva `id`/`lineTotal`.
      rows.set(id, caseDetailFixture({ id, code, ...caseFields(input), createdBy: actorId }))
      await repo.addEvent({ caseId: id, type: 'created', toValue: code, actorId })
      return { id, code }
    },
    async update(id, input, actorId) {
      const cur = rows.get(id)
      if (!cur) return false
      if (!isEditableStatus(cur.status))
        throw new CaseStateError(`No se puede editar un trabajo en estado "${cur.status}"`)
      rows.set(id, { ...cur, ...caseFields(input) })
      await repo.addEvent({ caseId: id, type: 'edited', actorId })
      return true
    },
    byId: async (id) => rows.get(id),
    list: async (q) => {
      lastListQuery = q
      return {
        cases: [...rows.values()].map((r) => ({
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
        total: rows.size,
        page: q.pagina,
        pageSize: 20,
      }
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
        throw new CaseStateError(`No se puede repetir un trabajo en estado "${parent.status}"`)
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

// `tryins` por defecto para llamadores que no lo necesitan (p. ej. `import.service.test.ts`,
// que solo usa `cases` dentro de `uow.run`): evita tocar sus fixtures al ampliar el puerto.
export const fakeUow = (
  cases: CasesRepository,
  tryins: TryinsRepository = fakeTryins(),
): UnitOfWork => ({
  run: (fn) => fn({ cases, tryins }),
})
export const fixedClock = (today = '2026-09-09') => ({
  today: () => today,
  now: () => new Date(`${today}T12:00:00Z`),
})
