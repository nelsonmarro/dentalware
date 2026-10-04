import {
  addBusinessDays,
  applyAction,
  ASSIGN_TECHNICIAN_ROLES,
  canAssignTechnician,
  canChangeStage,
  canPerform,
  CASE_WRITE_ROLES,
  CONSTANCIA_INVALIDA,
  DELIVERY_MANAGE_ROLES,
  DELIVERY_TYPES,
  firstStage,
  hasRole,
  hidesPrices,
  isLastStage,
  missingForAccept,
  notReassignableMessage,
  nextStage,
  previousStage,
  REMAKE_ROLES,
  STAGE_CHANGE_BLOCKED_REASON,
  STAGE_MOVE_BLOCKED_REASON,
  STAGE_CHANGE_ROLES,
  toIsoDate,
  type AssignTechnicianInput,
  type CaseActionInput,
  type CaseEditInput,
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
  CouriersLookup,
  Named,
  StagesQuery,
  UnitOfWork,
  UsersQuery,
} from './ports.ts'

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
  recibir: 'picked_up',
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
  couriers: CouriersLookup
  uow: UnitOfWork
  clock: Clock
}) {
  const mustGet = async (id: string) => {
    const found = await deps.cases.byId(id)
    if (!found) throw new CaseNotFoundError()
    return found
  }
  /** Forma y enmascarado de `detail`/`detailByCode` (Tarea 15, FIC-2 #72): ambos llegan a un
   * `CaseDetail` ya resuelto (por id o por código) y comparten esta única función, así que
   * `detailByCode` no duplica `stripPrices` ni el cálculo de `missing`. */
  const toDetail = async (found: CaseDetail, ctx: RequestContext) => {
    const hasDoc = await deps.attachments.hasDocument(found.id)
    return {
      case: hidesPrices(ctx.role) ? stripPrices(found) : found,
      missing: readiness(found, hasDoc),
    }
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
    /**
     * Contador por vista rápida (INI-1, T11, #68): sin dinero, así que no se enmascara por rol
     * (a diferencia de `list`/`detail`) ni necesita `ctx` — cualquier persona autenticada lo ve
     * igual, incluido un técnico (`requireAuth` en la ruta ya cubre "sin sesión", con 401, no
     * el 403 uniforme de `requireRole`).
     */
    async summary() {
      return deps.cases.summary(deps.clock.today())
    },
    async detail(id: string, ctx: RequestContext) {
      return toDetail(await mustGet(id), ctx)
    },
    /** `GET /api/trabajos/codigo/:code` (Tarea 15, FIC-2 #72): ficha corta del QR, resuelta por
     * código en vez de id. Misma forma y enmascarado que `detail` (`toDetail`, arriba). */
    async detailByCode(code: string, ctx: RequestContext) {
      const found = await deps.cases.byCode(code)
      if (!found) throw new CaseNotFoundError()
      return toDetail(found, ctx)
    },
    /**
     * Crea un trabajo. Con `input.recogida` (ENT-1, «Programar recogida»), el trabajo nace en
     * `por_recoger` y, en la misma transacción, se programa su recogida pendiente y se escribe
     * el evento `pickup_scheduled` (fecha en `toValue`, nombre del mensajero en `reason`: el
     * historial muestra nombres). La fecha no puede ser anterior a hoy y el mensajero debe
     * estar activo; ambas validaciones van antes de abrir la transacción.
     */
    async create(input: CaseInput, ctx: RequestContext) {
      const pickup = input.recogida
      let courier: Named | undefined
      if (pickup) {
        if (pickup.fecha < deps.clock.today()) {
          throw new CaseInputError(
            'La fecha de recogida no puede ser anterior a hoy.',
            'recogida.fecha',
          )
        }
        courier = await deps.couriers.findActiveCourier(pickup.mensajeroId)
        if (!courier) throw new CaseInputError('Elige un mensajero activo.', 'recogida.mensajeroId')
      }
      const { id } = await deps.uow.run(async ({ cases, deliveries }) => {
        if (!pickup || !courier) return cases.create(input, ctx.userId)
        const created = await cases.create(input, ctx.userId, 'por_recoger')
        await deliveries.create({
          caseId: created.id,
          type: 'recogida',
          courierId: courier.id,
          scheduledFor: pickup.fecha,
        })
        await cases.addEvent({
          caseId: created.id,
          type: 'pickup_scheduled',
          toValue: pickup.fecha,
          reason: courier.name,
          actorId: ctx.userId,
        })
        return created
      })
      return mustGet(id)
    },
    async update(id: string, input: CaseEditInput, ctx: RequestContext) {
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
     * Ejecuta una acción de estado: recibir (ENT-1), aceptar, pausar/reanudar, enviar/recibir
     * prueba en boca, finalizar, marcar enviado/entregado o cancelar (CIC-1/CIC-3). Todo corre
     * dentro de `uow.run` (ADR 19): el permiso por rol, la transición, el `applyTransition` y su
     * `case_event` son atómicos, y el trabajo se lee con `byIdForUpdate` (#97): una segunda
     * acción simultánea espera a que la primera confirme y valida contra el estado nuevo (409)
     * en vez de pisarla. `marcar_enviado` programa la entrega pendiente (ENT-3) y
     * `marcar_entregado` la cierra con la foto de constancia (ENT-4). Devuelve el detalle
     * enmascarado por rol (técnico y mensajero pueden ejecutar acciones sin ver precios:
     * `finalizar`, `recibir`, `marcar_enviado`/`marcar_entregado`).
     */
    async action(id: string, input: CaseActionInput, ctx: RequestContext) {
      await deps.uow.run(async ({ cases, tryins, deliveries }) => {
        if (!canPerform(ctx.role, input.accion)) throw new CaseForbiddenError()
        const found = await cases.byIdForUpdate(id)
        if (!found) throw new CaseNotFoundError()
        const result = applyAction(found.status, input.accion)
        if (!result.ok) throw new CaseStateError(result.reason)

        const patch: CaseTransitionPatch = { status: result.status }
        // Lo que el evento guarda además del estado de origen: por omisión el estado nuevo y el
        // motivo; el envío y la entrega lo sustituyen por su fecha y su constancia.
        const event: { toValue: string; reason: string | null } = {
          toValue: result.status,
          reason: input.motivo,
        }
        switch (input.accion) {
          case 'recibir': {
            // ENT-1: el mensajero solo recibe la recogida que tiene asignada (decisión 4 del
            // plan); admin y recepción, cualquiera. Sin recogida pendiente (datos anteriores a
            // la Iteración 4) se recibe igual —tolerancia deliberada, como `recibir_prueba`—,
            // pero solo quien administra entregas: a un mensajero no le consta como suya.
            const pending = await deliveries.pendingFor(id, 'recogida')
            if (!hasRole(DELIVERY_MANAGE_ROLES, ctx.role) && pending?.courierId !== ctx.userId) {
              throw new CaseForbiddenError()
            }
            if (pending) await deliveries.markDone(pending.id, deps.clock.now(), null)
            break
          }
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
          case 'marcar_enviado': {
            // ENT-3: el envío nace con su entrega pendiente (mensajero y fecha). El mensajero
            // solo se asigna a sí mismo (decisión 4 del plan); admin y recepción, a cualquiera.
            const envio = input.envio
            if (!envio) throw new CaseInputError('Elige mensajero y fecha', 'envio')
            if (!hasRole(DELIVERY_MANAGE_ROLES, ctx.role) && envio.mensajeroId !== ctx.userId) {
              throw new CaseForbiddenError()
            }
            if (envio.fecha < deps.clock.today()) {
              throw new CaseInputError(
                'La fecha de entrega no puede ser anterior a hoy.',
                'envio.fecha',
              )
            }
            const courier = await deps.couriers.findActiveCourier(envio.mensajeroId)
            if (!courier)
              throw new CaseInputError('Elige un mensajero activo.', 'envio.mensajeroId')
            await deliveries.create({
              caseId: id,
              type: 'entrega',
              courierId: courier.id,
              scheduledFor: envio.fecha,
            })
            patch.shippedAt = deps.clock.now()
            // El historial muestra nombres: fecha de entrega en `toValue`, mensajero en `reason`
            // (mismo criterio que `pickup_scheduled` en `create`).
            event.toValue = envio.fecha
            event.reason = courier.name
            break
          }
          case 'marcar_entregado': {
            // ENT-4: la foto de constancia es obligatoria para todos los roles y debe ser un
            // adjunto `constancia` de este trabajo y una imagen.
            const constanciaId = input.constanciaId
            if (!constanciaId) {
              throw new CaseInputError('Añade la foto de constancia', 'constanciaId')
            }
            // Mismo criterio que `recibir`: el mensajero solo cierra la entrega que tiene
            // asignada. Un trabajo enviado sin entrega pendiente (enviado antes de la
            // Iteración 4) se entrega igual —tolerancia deliberada— y la constancia queda solo
            // en el evento; pero solo quien administra entregas: a un mensajero no le consta.
            // El permiso va antes que la constancia (rol antes que datos, como `marcar_enviado`):
            // a otro mensajero se le responde 403 sin decirle nada de la foto.
            const pending = await deliveries.pendingFor(id, 'entrega')
            if (!hasRole(DELIVERY_MANAGE_ROLES, ctx.role) && pending?.courierId !== ctx.userId) {
              throw new CaseForbiddenError()
            }
            const proof = await deps.attachments.constancia(id, constanciaId)
            if (proof?.kind !== 'constancia' || !proof.mime.startsWith('image/')) {
              throw new CaseInputError(CONSTANCIA_INVALIDA, 'constanciaId')
            }
            const now = deps.clock.now()
            if (pending) await deliveries.markDone(pending.id, now, constanciaId)
            patch.deliveredAt = now
            event.toValue = constanciaId
            break
          }
          case 'cancelar': {
            // Un trabajo cancelado no se recoge ni se entrega: su recogida o entrega pendiente
            // (por recoger o enviado) se cierra en la misma transacción con el motivo, para que
            // no quede «pendiente» para siempre en la lista del mensajero. El motivo es
            // obligatorio al cancelar (`REASON_REQUIRED_FOR_ACTION`).
            const now = deps.clock.now()
            for (const type of DELIVERY_TYPES) {
              const pending = await deliveries.pendingFor(id, type)
              if (pending) {
                await deliveries.markFailed(pending.id, `Trabajo cancelado: ${input.motivo}`, now)
              }
            }
            break
          }
        }

        await cases.applyTransition(id, patch)
        await cases.addEvent({
          caseId: id,
          type: EVENT_TYPE_FOR_ACTION[input.accion],
          fromValue: found.status,
          ...event,
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
     * `uow.run` (ADR 19): el permiso, el trabajo, la fase y su evento son atómicos; la fila del
     * trabajo queda bloqueada (`byIdForUpdate`, #97), así que dos avances simultáneos no dan el
     * mismo salto dos veces.
     */
    async changeStage(id: string, input: StageChangeInput, ctx: RequestContext) {
      await deps.uow.run(async ({ cases }) => {
        if (!(STAGE_CHANGE_ROLES as readonly UserRole[]).includes(ctx.role)) {
          throw new CaseForbiddenError()
        }
        const found = await cases.byIdForUpdate(id)
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
            throw new CaseStateError(STAGE_MOVE_BLOCKED_REASON.desconocida)
          }
          if (input.direccion === 'avanzar' && isLastStage(activeStages, found.currentStageId)) {
            throw new CaseStateError(STAGE_MOVE_BLOCKED_REASON.ultima)
          }
          throw new CaseStateError(STAGE_MOVE_BLOCKED_REASON.primera)
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
     * técnico anterior y el nuevo. Lee el trabajo con `byIdForUpdate` (#97), igual que `action` y
     * `changeStage`: una acción simultánea no se cuela entre la validación del estado y la
     * escritura, y el «antes» del evento es el técnico que dejó la operación anterior.
     */
    async assignTechnician(id: string, input: AssignTechnicianInput, ctx: RequestContext) {
      await deps.uow.run(async ({ cases }) => {
        if (!(ASSIGN_TECHNICIAN_ROLES as readonly UserRole[]).includes(ctx.role)) {
          throw new CaseForbiddenError()
        }
        const found = await cases.byIdForUpdate(id)
        if (!found) throw new CaseNotFoundError()
        if (!canAssignTechnician(found.status)) {
          throw new CaseStateError(notReassignableMessage(found.status))
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
