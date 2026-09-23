import type {
  CaseEventType,
  CaseInput,
  CaseListQuery,
  CasePriority,
  CaseStatus,
  PricingUnit,
  RemakeInput,
  StageRef,
} from '@dentalware/shared'
// Solo tipos: las formas de fila se derivan del schema (ruling del plan; ESLint allowTypeImports).
import type { caseEvents, caseItems, caseTryins, cases } from './schema.ts'

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
export type TryinRow = typeof caseTryins.$inferSelect
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
/**
 * `RemakeInput` (shared) más `receivedAt`: el repo necesita la fecha de recepción del hijo
 * ("hoy") para elegir el año de su código, pero esa fecha la decide el reloj y el reloj es
 * del servicio (nunca `new Date()` en el repo para un dato de negocio, ADR 20) — así que el
 * servicio la resuelve con `Clock.today()` y la añade aquí antes de llamar al repo.
 */
export type RemakeCreateInput = RemakeInput & { receivedAt: string }

export type NewCaseEvent = {
  caseId: string
  type: CaseEventType
  fromValue?: string | null
  toValue?: string | null
  reason?: string | null
  actorId: string | null
}

/**
 * Campos que cambia una transición de estado (acción). Una propiedad ausente no se toca;
 * `null` la limpia explícitamente (p. ej. `reanudar` limpia `holdReason` con `null`).
 */
export type CaseTransitionPatch = {
  status: CaseStatus
  currentStageId?: string | null
  assignedTechnicianId?: string | null
  promisedDate?: string | null
  holdReason?: string | null
  finishedAt?: Date | null
  shippedAt?: Date | null
  deliveredAt?: Date | null
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
  /** Aplica los campos que cambia una acción de estado (ver `CaseTransitionPatch`). */
  applyTransition(id: string, patch: CaseTransitionPatch): Promise<void>
  /** Días hábiles máximos de los productos del trabajo, para la fecha comprometida al aceptar. */
  turnaroundFor(caseId: string): Promise<number>
  /**
   * Crea el trabajo hijo de una repetición (CIC-4): copia clínica, doctor, paciente, prioridad,
   * color, referencia, observaciones, prescripción y notas internas del padre; copia sus líneas
   * y el odontograma (`case_items`, con las piezas FDI que ya llevan); fija `parentCaseId` al
   * padre (encadenable: repetir una repetición apunta al padre inmediato, no al ancestro
   * original), el motivo, la responsabilidad y el porcentaje de cobro del `input`. El hijo nace
   * en `nuevo`, sin fase ni técnico asignado (la responsabilidad de la repetición puede no ser
   * la misma persona) y con el checklist sin verificar (es una producción nueva). Dos eventos
   * `remake_created`, uno en cada ficha. Lanza `CaseNotFoundError` si el padre no existe;
   * `CaseStateError` si su estado no es `terminado`, `enviado` ni `entregado`.
   *
   * **`dueDate`** (ronda de fixes 1, I-3): solo se copia si todavía no pasó respecto a
   * `input.receivedAt` (la fecha de recepción del hijo, "hoy"); si ya venció —el disparador
   * típico de una repetición es que el trabajo salió mal *después* de la fecha comprometida—
   * queda en `null`, así el hijo no nace en la vista "atrasados" y `missingForAccept` exige una
   * fecha nueva al aceptar, que es la pregunta que corresponde en ese momento.
   *
   * **`prescription`/adjuntos** (ronda de fixes 1, I-2): solo se copia el texto de
   * `prescription`; los adjuntos (fotos, documentos, incluida una receta escaneada) del padre
   * **no** se copian ni se referencian desde el hijo — son evidencia de esa producción
   * específica, y duplicar el archivo en disco (o hacer que dos trabajos referencien el mismo)
   * es un cambio del modelo de `attachments`, fuera del alcance de esta feature. Si el padre se
   * aceptó con `prescription: null` y la orden solo como documento adjunto (caso cotidiano:
   * receta escaneada), el hijo nace sin prescripción de ningún tipo y `missingForAccept` la
   * reclama (texto o documento) al intentar aceptarlo — quien repite debe escribir el texto o
   * volver a subir el documento.
   *
   * **`remakeChargePct`** (ronda de fixes 1, I-4): se guarda como dato informativo; `total` del
   * hijo es el 100 % de las líneas copiadas (el precio del trabajo, no lo que se le cobra a la
   * clínica). `remakeChargePct` es un **modificador diferido**: quien calcule el saldo de la
   * clínica (`docs/architecture.md` §4) tiene que leerlo y aplicarlo aparte — esta capa no
   * descuenta nada de `total` ni de ningún cálculo de cuenta corriente.
   */
  createRemake(
    parentId: string,
    input: RemakeCreateInput,
    actorId: string,
  ): Promise<{ id: string; code: string }>
}

/** Puerto de OTRA feature (adjuntos): se inyecta en la raíz de composición. */
export interface AttachmentsQuery {
  hasDocument(caseId: string): Promise<boolean>
}

/** Puerto de OTRA feature (fases): se inyecta en la raíz de composición. */
export interface StagesQuery {
  active(): Promise<StageRef[]>
}

/** Puerto de OTRA feature (usuarios): valida a quién se puede asignar como técnico responsable
 * y, con `id` y `name`, alimenta el combobox de `TechnicianSelect` en la web (Tarea 9) sin
 * exponer correo, rol ni estado de baneo. */
export interface UsersQuery {
  activeTechnicians(): Promise<Named[]>
}

/** Pruebas en boca (`case_tryins`): abiertas por trabajo, cerradas al recibirlas de vuelta. */
export interface TryinsRepository {
  open(caseId: string): Promise<TryinRow | undefined>
  create(caseId: string, sentAt: string, note: string | null): Promise<void>
  close(id: string, returnedAt: string): Promise<void>
}

/** Atomicidad sin conocer db.transaction (ADR 19): repos re-creados sobre la misma tx. */
export interface UnitOfWork {
  run<T>(
    fn: (repos: { cases: CasesRepository; tryins: TryinsRepository }) => Promise<T>,
  ): Promise<T>
}
