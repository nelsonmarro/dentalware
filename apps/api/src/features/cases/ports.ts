import type {
  CaseEventType,
  CaseInput,
  CaseListQuery,
  CasePriority,
  CaseStatus,
  PricingUnit,
} from '@dentalware/shared'
// Solo tipos: las formas de fila se derivan del schema (ruling del plan; ESLint allowTypeImports).
import type { caseEvents, caseItems, cases } from './schema.ts'

export type Named = { id: string; name: string }
export type CaseDetail = typeof cases.$inferSelect & {
  // `clinic`/`doctor` van con `optional: false` en `relations.ts` (FK NOT NULL en
  // `cases`): Drizzle Relations v2 los tipa como presentes, no `| null` (ver
  // docs/architecture.md §3.6). `technician`/`stage` sí son opcionales de verdad.
  clinic: Named
  doctor: Named
  technician: Named | null
  stage: { id: string; name: string; color: string } | null
  items: (typeof caseItems.$inferSelect & {
    product: { id: string; code: string; name: string; pricingUnit: PricingUnit } | null
  })[]
}
export type CaseEventRow = typeof caseEvents.$inferSelect & { actor: Named | null }
export type CaseListRow = {
  id: string
  code: string
  boxNumber: string | null
  patientRef: string
  status: CaseStatus
  priority: CasePriority
  receivedAt: string
  dueDate: string | null
  promisedDate: string | null
  total: string | null
  clinic: Named
  doctor: Named
  stage: { name: string; color: string } | null
  technician: { name: string } | null
  itemsSummary: string
}
export type CaseListPage = { cases: CaseListRow[]; total: number; page: number; pageSize: number }
export type NewCaseEvent = {
  caseId: string
  type: CaseEventType
  fromValue?: string | null
  toValue?: string | null
  reason?: string | null
  actorId: string | null
}

export interface CasesRepository {
  /** Lanza CaseInputError si un producto no existe o está inactivo. */
  create(input: CaseInput, actorId: string): Promise<{ id: string; code: string }>
  /** false si no existe; lanza CaseStateError si el estado no es editable; CaseInputError por producto. */
  update(id: string, input: CaseInput, actorId: string): Promise<boolean>
  byId(id: string): Promise<CaseDetail | undefined>
  list(q: CaseListQuery, today: string): Promise<CaseListPage>
  events(caseId: string): Promise<CaseEventRow[]>
  addEvent(e: NewCaseEvent): Promise<void>
}

/** Puerto de OTRA feature (adjuntos): se inyecta en la raíz de composición. */
export interface AttachmentsQuery {
  hasDocument(caseId: string): Promise<boolean>
}

/** Atomicidad sin conocer db.transaction (ADR 19). */
export interface UnitOfWork {
  run<T>(fn: (repos: { cases: CasesRepository }) => Promise<T>): Promise<T>
}
