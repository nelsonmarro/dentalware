import {
  addBusinessDays,
  applyAction,
  canPerform,
  firstStage,
  missingForAccept,
  nextStage,
  previousStage,
  toIsoDate,
  type AssignTechnicianInput,
  type CaseActionInput,
  type CaseEventType,
  type CaseInput,
  type CaseListQuery,
  type StageChangeInput,
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
  items: { unitPrice: string | null; lineTotal: string | null; discountPct: string | null }[]
}
/** Oculta precios y notas internas a quien no debe verlos (técnico/mensajero). */
export function stripPrices<T extends Priced>(row: T): T {
  return {
    ...row,
    total: null,
    internalNotes: null,
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

/** Estados en los que un trabajo tiene su fase en pausa: en espera de algo externo (`en_espera`)
 * o fuera del taller en una prueba en boca (`en_prueba`). CIC-5: no se avanza ni se retrocede
 * de fase mientras el trabajo está en uno de estos dos. */
const STAGE_LOCKED_STATUSES = ['en_espera', 'en_prueba'] as const

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
     * retrocede una posición entre las fases activas (`shared/stages.ts`). Un trabajo en espera
     * o en prueba en boca no cambia de fase, y avanzar desde la última fase activa no hace
     * nada: el cliente debe usar la acción "finalizar". Retroceder exige motivo (el schema ya
     * lo garantiza) y queda en el evento `stage_changed`. Todo corre dentro de `uow.run`
     * (ADR 19): el trabajo, la fase y su evento son atómicos.
     */
    async changeStage(id: string, input: StageChangeInput, ctx: RequestContext) {
      await deps.uow.run(async ({ cases }) => {
        const found = await cases.byId(id)
        if (!found) throw new CaseNotFoundError()
        if ((STAGE_LOCKED_STATUSES as readonly string[]).includes(found.status)) {
          throw new CaseStateError(
            `No se puede cambiar de fase un trabajo en estado "${found.status}"`,
          )
        }
        const activeStages = await deps.stages.active()
        const target =
          input.direccion === 'avanzar'
            ? nextStage(activeStages, found.currentStageId)
            : previousStage(activeStages, found.currentStageId)
        if (!target) {
          throw new CaseStateError(
            input.direccion === 'avanzar'
              ? 'El trabajo ya está en la última fase: usa "finalizar" para terminarlo'
              : 'El trabajo ya está en la primera fase',
          )
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
     * Asigna o quita (con `tecnicoId: null`) el técnico responsable del trabajo (CIC-2). Solo
     * admin y recepción pueden asignar (defensa en profundidad: la ruta ya filtra por rol, ver
     * `canWrite` en `routes.ts`, pero un test de servicio con fakes no pasa por la ruta). El
     * técnico debe estar activo (`UsersQuery.activeTechnicians`, puerto de la feature `users`);
     * si no, `CaseInputError`. Deja el evento `assigned` con el técnico anterior y el nuevo.
     */
    async assignTechnician(id: string, input: AssignTechnicianInput, ctx: RequestContext) {
      await deps.uow.run(async ({ cases }) => {
        if (ctx.role !== 'admin' && ctx.role !== 'recepcion') throw new CaseForbiddenError()
        const found = await cases.byId(id)
        if (!found) throw new CaseNotFoundError()
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
  }
}
export type CasesService = ReturnType<typeof createCasesService>
