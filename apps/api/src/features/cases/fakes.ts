import { caseInputSchema, isEditableStatus } from '@dentalware/shared'
import type { CaseInput } from '@dentalware/shared'
import { CaseInputError, CaseStateError } from './errors.ts'
import type {
  CaseDetail,
  CaseEventRow,
  CasesRepository,
  NewCaseEvent,
  UnitOfWork,
} from './ports.ts'

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
    list: async (q) => ({
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
    }),
    events: async (caseId) => events.filter((e) => e.caseId === caseId),
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
      })
    },
  }
  return { repo, rows, events }
}

export const fakeUow = (cases: CasesRepository): UnitOfWork => ({ run: (fn) => fn({ cases }) })
export const fixedClock = (today = '2026-09-09') => ({
  today: () => today,
  now: () => new Date(`${today}T12:00:00Z`),
})
