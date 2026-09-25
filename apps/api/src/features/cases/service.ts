import {
  addBusinessDays,
  applyAction,
  ASSIGN_TECHNICIAN_ROLES,
  canAssignTechnician,
  canChangeStage,
  canPerform,
  CASE_WRITE_ROLES,
  firstStage,
  isLastStage,
  missingForAccept,
  nextStage,
  previousStage,
  REMAKE_ROLES,
  STAGE_CHANGE_BLOCKED_REASON,
  STAGE_CHANGE_ROLES,
  toIsoDate,
  type AssignTechnicianInput,
  type CaseActionInput,
  type CaseEventType,
  type CaseInput,
  type CaseListQuery,
  type RemakeInput,
  type StageChangeInput,
  type StageRef,
  type UserRole,
} from '@dentalware/shared'
import type { Clock } from '../../lib/clock.ts'
import type { RequestContext } from '../../lib/request-context.ts'
import { CaseForbiddenError, CaseInputError, CaseNotFoundError, CaseStateError } from './errors.ts'
import type {
  AttachmentsQuery,
  CaseDetail,
  CaseListRow,
  CasesRepository,
  CaseTransitionPatch,
  StagesQuery,
  UnitOfWork,
  UsersQuery,
} from './ports.ts'

const hidesPrices = (role: UserRole) => role === 'tecnico' || role === 'mensajero'

type Priced = {
  total: string | null
  internalNotes: string | null
  remakeChargePct: string | null
  items: { unitPrice: string | null; lineTotal: string | null; discountPct: string | null }[]
}
/** Oculta precios, notas internas y el porcentaje de cobro de una repetición a quien no debe
 * verlos (técnico/mensajero). `remakeChargePct` es política de cobro a la clínica (M-7, ola de
 * fixes del PR 1): `docs/conventions.md` §4 dice que técnico y mensajero no reciben precios. */
export function stripPrices<T extends Priced>(row: T): T {
  return {
    ...row,
    total: null,
    internalNotes: null,
    remakeChargePct: null,
    items: row.items.map((i) => ({ ...i, unitPrice: null, lineTotal: null, discountPct: null })),
  }
}

/** Oculta los valores de los eventos `price_changed` (llevan "productId:precio") a quien no debe ver precios. */
export function maskPriceEvents<
  T extends { type: string; fromValue: string | null; toValue: string | null },
>(events: T[], hide: boolean): T[] {
  if (!hide) return events
  return events.map((e) =>
    e.type === 'price_changed' ? { ...e, fromValue: null, toValue: null } : e,
  )
}

function readiness(
  c: CaseDetail,
  hasPrescriptionDocument: boolean,
): ReturnType<typeof missingForAccept> {
  return missingForAccept({
    clinicId: c.clinicId,
    doctorId: c.doctorId,
    patientRef: c.patientRef,
    dueDate: c.dueDate,
    shade: c.shade,
    prescription: c.prescription,
    hasPrescriptionDocument,
    checklist: c.checklist,
    items: c.items.map((i) => ({ pricingUnit: i.product!.pricingUnit, teeth: i.teeth })),
  })
}

/** Evento que registra cada acción de estado (CIC-1/CIC-3). */
const EVENT_TYPE_FOR_ACTION: Record<CaseActionInput['accion'], CaseEventType> = {
  aceptar: 'status_changed',
  pausar: 'hold',
  reanudar: 'resumed',
  enviar_prueba: 'tryin_sent',
  recibir_prueba: 'tryin_returned',
  finalizar: 'status_changed',
  marcar_enviado: 'shipped',
  marcar_entregado: 'delivered',
  cancelar: 'cancelled',
}

/**
 * Único estado en el que un trabajo tiene una fase de producción en curso: `aceptar` deja la
 * fase inicial y desde `en_proceso` se finaliza (CIC-2). Lista blanca, no negra (ronda de
 * fixes 1, I-1): antes de este fix la lista negra (`en_espera`/`en_prueba`) dejaba pasar
 * `terminado`/`enviado`/`entregado`/`cancelado`, y como `finalizar` no limpia `currentStageId`,
 * un trabajo ya cerrado seguía cambiando de fase (evento `stage_changed` espurio en su
 * historial). `canChangeStage` y `STAGE_CHANGE_BLOCKED_REASON` viven en `shared`
 * (I-5 + M-5 + M-9, ola de fixes del PR 1): antes de ese fix era una copia local de un `Record`
 * que también duplicaba la web, con las mismas claves y texto casi idéntico.
 */

/** Distingue "la fase actual es la última/primera de las activas" de "no se sabe cuál es la
 * fase actual" (currentStageId nulo, o una fase que se desactivó con el trabajo todavía en
 * ella) — ronda de fixes 1, M-1: antes de este fix ambos casos daban el mismo mensaje
 * ("usa finalizar"), que induce a un técnico a cerrar un trabajo que en realidad sigue a
 * mitad de una fase desactivada. */
function stagePositionKnown(activeStages: readonly StageRef[], currentStageId: string | null) {
  return currentStageId !== null && activeStages.some((s) => s.id === currentStageId)
}

export function createCasesService(deps: {
  cases: CasesRepository
  attachments: AttachmentsQuery
  stages: StagesQuery
  users: UsersQuery
  uow: UnitOfWork
  clock: Clock
}) {
  const mustGet = async (id: string) => {
    const found = await deps.cases.byId(id)
    if (!found) throw new CaseNotFoundError()
    return found
  }
  return {
    async list(q: CaseListQuery, ctx: RequestContext) {
      const page = await deps.cases.list(q, deps.clock.today())
      if (!hidesPrices(ctx.role)) return page
      return {
        ...page,
        cases: page.cases.map((r): CaseListRow => ({ ...r, total: null })),
      }
    },
    async detail(id: string, ctx: RequestContext) {
      const found = await mustGet(id)
      const hasDoc = await deps.attachments.hasDocument(id)
      return {
        case: hidesPrices(ctx.role) ? stripPrices(found) : found,
        missing: readiness(found, hasDoc),
      }
    },
    async create(input: CaseInput, ctx: RequestContext) {
      const { id } = await deps.uow.run(({ cases }) => cases.create(input, ctx.userId))
      return mustGet(id)
    },
    async update(id: string, input: CaseInput, ctx: RequestContext) {
      const ok = await deps.uow.run(({ cases }) => cases.update(id, input, ctx.userId))
      if (!ok) throw new CaseNotFoundError()
      return mustGet(id)
    },
    async events(caseId: string, ctx: RequestContext) {
      return maskPriceEvents(await deps.cases.events(caseId), hidesPrices(ctx.role))
    },
    async comment(caseId: string, text: string, ctx: RequestContext) {
      await mustGet(caseId)
      await deps.cases.addEvent({ caseId, type: 'comment', toValue: text, actorId: ctx.userId })
      const events = maskPriceEvents(await deps.cases.events(caseId), hidesPrices(ctx.role))
      return events[events.length - 1]!
    },
    /**
     * Ejecuta una acción de estado: aceptar, pausar/reanudar, enviar/recibir prueba en boca,
     * finalizar, marcar enviado/entregado o cancelar (CIC-1/CIC-3). Todo corre dentro de
     * `uow.run` (ADR 19): el permiso por rol, la transición, el `applyTransition` y su
     * `case_event` son atómicos. Devuelve el detalle enmascarado por rol (técnico y mensajero
     * pueden ejecutar acciones sin ver precios: `finalizar`, `marcar_enviado`/`marcar_entregado`).
     */
    async action(id: string, input: CaseActionInput, ctx: RequestContext) {
      await deps.uow.run(async ({ cases, tryins }) => {
        if (!canPerform(ctx.role, input.accion)) throw new CaseForbiddenError()
        const found = await cases.byId(id)
        if (!found) throw new CaseNotFoundError()
        const result = applyAction(found.status, input.accion)
        if (!result.ok) throw new CaseStateError(result.reason)

        const patch: CaseTransitionPatch = { status: result.status }
        switch (input.accion) {
          case 'aceptar': {
            const hasDoc = await deps.attachments.hasDocument(id)
            const missing = readiness(found, hasDoc)
            if (missing.length) {
              throw new CaseInputError(`Faltan datos para aceptar: ${missing.join(', ')}`)
            }
            const turnaround = await cases.turnaroundFor(id)
            const start = new Date(`${deps.clock.today()}T00:00:00`)
            // El sistema no registra feriados (`lab_settings` no los tiene y el MVP no lo pide):
            // solo se saltan fines de semana.
            patch.promisedDate = toIsoDate(addBusinessDays(start, turnaround, []))
            patch.currentStageId = firstStage(await deps.stages.active())?.id ?? null
            break
          }
          case 'pausar':
            patch.holdReason = input.motivo
            break
          case 'reanudar':
            patch.holdReason = null
            break
          case 'enviar_prueba':
            await tryins.create(id, deps.clock.today(), input.motivo)
            break
          case 'recibir_prueba': {
            const open = await tryins.open(id)
            // Sin prueba abierta no hay nada que cerrar: tolerancia deliberada, no un error.
            if (open) await tryins.close(open.id, deps.clock.today())
            break
          }
          case 'finalizar':
            patch.finishedAt = deps.clock.now()
            break
          case 'marcar_enviado':
            patch.shippedAt = deps.clock.now()
            break
          case 'marcar_entregado':
            patch.deliveredAt = deps.clock.now()
            break
          case 'cancelar':
            break
        }

        await cases.applyTransition(id, patch)
        await cases.addEvent({
          caseId: id,
          type: EVENT_TYPE_FOR_ACTION[input.accion],
          fromValue: found.status,
          toValue: result.status,
          reason: input.motivo,
          actorId: ctx.userId,
        })
      })
      const updated = await mustGet(id)
      return hidesPrices(ctx.role) ? stripPrices(updated) : updated
    },
    /**
     * Cambia la fase de producción del trabajo (CIC-2/CIC-5), sin tocar su estado: avanza o
     * retrocede una posición entre las fases activas (`shared/stages.ts`). Solo un trabajo
     * `en_proceso` cambia de fase (lista blanca, ver `STAGE_CHANGE_BLOCKED_REASON`); avanzar
     * desde la última fase activa no hace nada: el cliente debe usar la acción "finalizar".
     * Retroceder exige motivo (el schema ya lo garantiza) y queda en el evento `stage_changed`.
     * Solo admin, recepción y técnico pueden cambiar de fase (defensa en profundidad: la ruta
     * ya filtra por rol con `canChangeStage` en `routes.ts`, pero un test de servicio con
     * fakes no pasa por la ruta — mismo patrón que `assignTechnician`). Todo corre dentro de
     * `uow.run` (ADR 19): el permiso, el trabajo, la fase y su evento son atómicos.
     */
    async changeStage(id: string, input: StageChangeInput, ctx: RequestContext) {
      await deps.uow.run(async ({ cases }) => {
        if (!(STAGE_CHANGE_ROLES as readonly UserRole[]).includes(ctx.role)) {
          throw new CaseForbiddenError()
        }
        const found = await cases.byId(id)
        if (!found) throw new CaseNotFoundError()
        if (!canChangeStage(found.status)) {
          throw new CaseStateError(STAGE_CHANGE_BLOCKED_REASON[found.status])
        }
        const activeStages = await deps.stages.active()
        const target =
          input.direccion === 'avanzar'
            ? nextStage(activeStages, found.currentStageId)
            : previousStage(activeStages, found.currentStageId)
        if (!target) {
          if (!stagePositionKnown(activeStages, found.currentStageId)) {
            throw new CaseStateError(
              'No se pudo determinar la fase actual del trabajo: puede que esté desactivada',
            )
          }
          if (input.direccion === 'avanzar' && isLastStage(activeStages, found.currentStageId)) {
            throw new CaseStateError(
              'El trabajo ya está en la última fase: usa "finalizar" para terminarlo',
            )
          }
          throw new CaseStateError('El trabajo ya está en la primera fase')
        }
        await cases.applyTransition(id, { status: found.status, currentStageId: target.id })
        await cases.addEvent({
          caseId: id,
          type: 'stage_changed',
          fromValue: found.currentStageId,
          toValue: target.id,
          reason: input.motivo,
          actorId: ctx.userId,
        })
      })
      const updated = await mustGet(id)
      return hidesPrices(ctx.role) ? stripPrices(updated) : updated
    },
    /**
     * Asigna o quita (con `tecnicoId: null`) el técnico responsable del trabajo (CIC-5). Solo
     * admin y recepción pueden asignar (defensa en profundidad: la ruta ya filtra por rol, ver
     * `canWrite` en `routes.ts`, pero un test de servicio con fakes no pasa por la ruta). No se
     * puede reasignar un trabajo ya cerrado (`canAssignTechnician`, shared); el resto de
     * estados sí lo permite. El técnico debe estar activo (`UsersQuery.activeTechnicians`,
     * puerto de la feature `users`); si no, `CaseInputError`. Deja el evento `assigned` con el
     * técnico anterior y el nuevo.
     */
    async assignTechnician(id: string, input: AssignTechnicianInput, ctx: RequestContext) {
      await deps.uow.run(async ({ cases }) => {
        if (!(ASSIGN_TECHNICIAN_ROLES as readonly UserRole[]).includes(ctx.role)) {
          throw new CaseForbiddenError()
        }
        const found = await cases.byId(id)
        if (!found) throw new CaseNotFoundError()
        if (!canAssignTechnician(found.status)) {
          throw new CaseStateError(
            `No se puede reasignar el técnico de un trabajo en estado "${found.status}"`,
          )
        }
        if (input.tecnicoId) {
          const technicians = await deps.users.activeTechnicians()
          if (!technicians.some((t) => t.id === input.tecnicoId)) {
            throw new CaseInputError('El técnico no existe o no está activo', 'tecnicoId')
          }
        }
        await cases.applyTransition(id, {
          status: found.status,
          assignedTechnicianId: input.tecnicoId,
        })
        await cases.addEvent({
          caseId: id,
          type: 'assigned',
          fromValue: found.assignedTechnicianId,
          toValue: input.tecnicoId,
          actorId: ctx.userId,
        })
      })
      const updated = await mustGet(id)
      return hidesPrices(ctx.role) ? stripPrices(updated) : updated
    },
    /**
     * Repite un trabajo (CIC-4): crea un hijo con las líneas y el odontograma del original,
     * listo para empezar de cero. Solo desde `terminado`, `enviado` o `entregado`
     * (`repo.createRemake`, con `FOR UPDATE` sobre el padre dentro de `uow.run`). Encadenable:
     * repetir una repetición fija `parentCaseId` al padre inmediato, no al ancestro original; se
     * puede repetir el mismo trabajo más de una vez, cada hijo es independiente. El hijo nace en
     * `nuevo`, sin fase ni técnico asignado (la responsabilidad de la repetición puede no ser la
     * misma persona) y sin fotos ni documentos adjuntos (pertenecen a la ficha original, no a la
     * producción nueva). Solo admin y recepción (defensa en profundidad: la ruta ya filtra por
     * rol con `canWrite`, pero un test de servicio con fakes no pasa por la ruta). Solo admin y
     * recepción ven el resultado sin enmascarar (mismo criterio que `create`/`update`: la ruta
     * ya les impide llegar aquí a técnico o mensajero).
     */
    async createRemake(parentId: string, input: RemakeInput, ctx: RequestContext) {
      if (!(REMAKE_ROLES as readonly UserRole[]).includes(ctx.role)) {
        throw new CaseForbiddenError()
      }
      const { id } = await deps.uow.run(({ cases }) =>
        cases.createRemake(parentId, { ...input, receivedAt: deps.clock.today() }, ctx.userId),
      )
      return mustGet(id)
    },
    /**
     * Técnicos activos para el combobox de `assignTechnician` en la web (Tarea 9): mismo
     * puerto `UsersQuery.activeTechnicians` que valida la asignación, pero expuesto de
     * lectura para que recepción pueda elegir a quién asignar (hoy solo puede asignar, no
     * listar: `GET /api/usuarios` es de admin únicamente, ver ruling de la Tarea 9). Solo
     * admin y recepción (`canWrite` en `routes.ts`; defensa en profundidad igual que el
     * resto de métodos de este servicio, un test con fakes no pasa por la ruta). Sin
     * enmascarar: `Named` ya no lleva correo, rol ni estado de baneo.
     */
    async technicians(ctx: RequestContext) {
      if (!(CASE_WRITE_ROLES as readonly UserRole[]).includes(ctx.role)) {
        throw new CaseForbiddenError()
      }
      return deps.users.activeTechnicians()
    },
  }
}
export type CasesService = ReturnType<typeof createCasesService>
