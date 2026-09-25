import {
  assignTechnicianSchema,
  ASSIGN_TECHNICIAN_ROLES,
  CASE_ACTION_ROLES,
  CASE_WRITE_ROLES,
  REMAKE_ROLES,
  caseActionSchema,
  caseInputSchema,
  caseListQuerySchema,
  commentSchema,
  idParamSchema,
  remakeSchema,
  stageChangeSchema,
  STAGE_CHANGE_ROLES,
} from '@dentalware/shared'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { validate } from '../../lib/validate.ts'
import type { AppEnv } from '../auth/session.ts'
import { ctxFrom, requireAuth, requireRole } from '../auth/session.ts'
import { CaseForbiddenError, CaseInputError, CaseNotFoundError, CaseStateError } from './errors.ts'
import type { CasesService } from './service.ts'

// canWrite ya cubre "sin sesión" y "rol incorrecto" con 403 (ver comentario en session.ts):
// no se combina con requireAuth para no dar 401 antes de llegar al chequeo de rol.
// CASE_WRITE_ROLES (shared, I-5 + M-5 + M-9): misma lista que consumen el servicio y la web.
const canWrite = requireRole(...CASE_WRITE_ROLES)

// Unión de los roles de `CASE_TRANSITIONS` (`CASE_ACTION_ROLES`, derivada en shared):
// el rol exacto permitido por acción lo decide `CasesService.action` con `canPerform` (dentro
// de `uow.run`, ver ruling de la Tarea 5 fix 1), pero un guardián por rol en la ruta dobla esa
// defensa (sobrevive a que alguien mueva `canPerform` al refactorizar el servicio) y da 403
// antes del validador de `json`, igual que las demás rutas de escritura, en vez de dejar que
// un anónimo reciba issues de validación como si la ruta le perteneciera.
const canAct = requireRole(...CASE_ACTION_ROLES)

// Cambiar de fase lo hace el técnico además de admin y recepción (Tarea 6); asignar técnico
// responsable, en cambio, es de admin/recepción como cualquier otra escritura (`canWrite`).
// STAGE_CHANGE_ROLES (shared, I-5 + M-5 + M-9): misma lista que consumen el servicio y la web.
const canChangeStage = requireRole(...STAGE_CHANGE_ROLES)

// Asignar técnico y repetir tienen su propia constante aunque hoy valgan lo mismo que
// `CASE_WRITE_ROLES` (ADR 31): si una cambia, la ruta tiene que cambiar con ella, o la web y
// el servicio lo permitirían y la ruta respondería 403 (N-1 de la re-revisión de la ola).
const canAssignTechnician = requireRole(...ASSIGN_TECHNICIAN_ROLES)
const canRemake = requireRole(...REMAKE_ROLES)

/** Traduce los errores de dominio del servicio a la respuesta HTTP que espera la web. */
function toHttp(e: unknown): never {
  if (e instanceof CaseStateError) throw new HTTPException(409, { message: e.message })
  if (e instanceof CaseNotFoundError) throw new HTTPException(404, { message: e.message })
  if (e instanceof CaseForbiddenError) throw new HTTPException(403, { message: e.message })
  throw e
}

export const casesRoutes = (service: CasesService, importRoutes: Hono<AppEnv>) =>
  new Hono<AppEnv>()
    // Montada antes de `/:id` para que el segmento literal "importar" no se confunda
    // con un identificador de trabajo.
    .route('/importar', importRoutes)
    .get('/', requireAuth, validate('query', caseListQuerySchema), async (c) =>
      c.json(await service.list(c.req.valid('query'), ctxFrom(c)), 200),
    )
    // Declarada antes de `/:id` a propósito (ruling de la Tarea 9): si fuera después, el
    // segmento literal "tecnicos" caería en el parámetro `:id` de la ruta de abajo. Solo
    // admin y recepción (`canWrite`, los roles que pueden asignar en `PUT /:id/tecnico`):
    // recepción puede asignar pero no tiene acceso a `GET /api/usuarios` (solo admin), así
    // que este endpoint vive en el router de trabajos, no en el de usuarios.
    .get('/tecnicos', canAssignTechnician, async (c) =>
      c.json({ technicians: await service.technicians(ctxFrom(c)) }, 200),
    )
    .get('/:id', requireAuth, validate('param', idParamSchema), async (c) => {
      try {
        const { case: found, missing } = await service.detail(c.req.valid('param').id, ctxFrom(c))
        return c.json({ case: found, missing }, 200)
      } catch (e) {
        toHttp(e)
      }
    })
    .post('/', canWrite, validate('json', caseInputSchema), async (c) => {
      try {
        const created = await service.create(c.req.valid('json'), ctxFrom(c))
        return c.json({ case: created }, 201)
      } catch (e) {
        if (e instanceof CaseInputError)
          return c.json(
            { message: 'Datos inválidos', issues: [{ path: e.path, message: e.message }] },
            422,
          )
        toHttp(e)
      }
    })
    .put(
      '/:id',
      canWrite,
      validate('param', idParamSchema),
      validate('json', caseInputSchema),
      async (c) => {
        try {
          const updated = await service.update(
            c.req.valid('param').id,
            c.req.valid('json'),
            ctxFrom(c),
          )
          return c.json({ case: updated }, 200)
        } catch (e) {
          if (e instanceof CaseInputError)
            return c.json(
              { message: 'Datos inválidos', issues: [{ path: e.path, message: e.message }] },
              422,
            )
          toHttp(e)
        }
      },
    )
    .get('/:id/eventos', requireAuth, validate('param', idParamSchema), async (c) =>
      c.json({ events: await service.events(c.req.valid('param').id, ctxFrom(c)) }, 200),
    )
    .post(
      '/:id/comentarios',
      requireAuth,
      validate('param', idParamSchema),
      validate('json', commentSchema),
      async (c) => {
        try {
          const event = await service.comment(
            c.req.valid('param').id,
            c.req.valid('json').text,
            ctxFrom(c),
          )
          return c.json({ event }, 201)
        } catch (e) {
          toHttp(e)
        }
      },
    )
    // `canAct` filtra por la unión de roles de `CASE_TRANSITIONS`; el rol exacto por acción
    // (p. ej. admin, recepción y mensajero para `marcar_entregado`, pero no técnico) lo decide
    // `CasesService.action` con `canPerform`, traducido a 403 por `CaseForbiddenError` más abajo.
    .post(
      '/:id/acciones',
      canAct,
      validate('param', idParamSchema),
      validate('json', caseActionSchema),
      async (c) => {
        try {
          const updated = await service.action(
            c.req.valid('param').id,
            c.req.valid('json'),
            ctxFrom(c),
          )
          return c.json({ case: updated }, 200)
        } catch (e) {
          if (e instanceof CaseInputError)
            return c.json(
              { message: 'Datos inválidos', issues: [{ path: e.path, message: e.message }] },
              422,
            )
          toHttp(e)
        }
      },
    )
    .put(
      '/:id/fase',
      canChangeStage,
      validate('param', idParamSchema),
      validate('json', stageChangeSchema),
      async (c) => {
        try {
          const updated = await service.changeStage(
            c.req.valid('param').id,
            c.req.valid('json'),
            ctxFrom(c),
          )
          return c.json({ case: { id: updated.id, currentStageId: updated.currentStageId } }, 200)
        } catch (e) {
          toHttp(e)
        }
      },
    )
    .post(
      '/:id/repetir',
      canRemake,
      validate('param', idParamSchema),
      validate('json', remakeSchema),
      async (c) => {
        try {
          const created = await service.createRemake(
            c.req.valid('param').id,
            c.req.valid('json'),
            ctxFrom(c),
          )
          return c.json({ case: created }, 201)
        } catch (e) {
          toHttp(e)
        }
      },
    )
    .put(
      '/:id/tecnico',
      canAssignTechnician,
      validate('param', idParamSchema),
      validate('json', assignTechnicianSchema),
      async (c) => {
        try {
          const updated = await service.assignTechnician(
            c.req.valid('param').id,
            c.req.valid('json'),
            ctxFrom(c),
          )
          return c.json(
            { case: { id: updated.id, assignedTechnicianId: updated.assignedTechnicianId } },
            200,
          )
        } catch (e) {
          if (e instanceof CaseInputError)
            return c.json(
              { message: 'Datos inválidos', issues: [{ path: e.path, message: e.message }] },
              422,
            )
          toHttp(e)
        }
      },
    )
