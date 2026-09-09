import {
  caseInputSchema,
  caseListQuerySchema,
  commentSchema,
  idParamSchema,
  missingForAccept,
  toIsoDate,
} from '@dentalware/shared'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { Db } from '../../db/index.ts'
import { validate } from '../../lib/validate.ts'
import type { AppEnv } from '../auth/session.ts'
import { requireAuth, requireRole } from '../auth/session.ts'
import { CaseInputError, CaseStateError } from './errors.ts'
import { importRoutes } from './import.ts'
import type { CaseDetail } from './ports.ts'
import { createCasesRepo, drizzleUnitOfWork, stripPrices } from './repo.ts'

export const todayIso = () => toIsoDate(new Date())
// canWrite ya cubre "sin sesión" y "rol incorrecto" con 403 (ver comentario en session.ts):
// no se combina con requireAuth para no dar 401 antes de llegar al chequeo de rol.
const canWrite = requireRole('admin', 'recepcion')
const hidesPrices = (role: string | undefined) => role === 'tecnico' || role === 'mensajero'

/** Oculta los valores de los eventos `price_changed` (llevan "productId:precio") a quien no debe ver precios. */
export function maskPriceEvents<
  T extends { type: string; fromValue: string | null; toValue: string | null },
>(events: T[], hide: boolean): T[] {
  if (!hide) return events
  return events.map((e) =>
    e.type === 'price_changed' ? { ...e, fromValue: null, toValue: null } : e,
  )
}

function readiness(c: CaseDetail, hasPrescriptionDocument: boolean) {
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

export const casesRoutes = (db: Db) => {
  const repo = createCasesRepo(db)
  const uow = drizzleUnitOfWork(db)
  return (
    new Hono<AppEnv>()
      // Montada antes de `/:id` para que el segmento literal "importar" no se confunda
      // con un identificador de trabajo.
      .route('/importar', importRoutes(db))
      .get('/', requireAuth, validate('query', caseListQuerySchema), async (c) => {
        const result = await repo.list(c.req.valid('query'), todayIso())
        const hide = hidesPrices(c.var.user?.role)
        return c.json(
          { ...result, cases: result.cases.map((r) => (hide ? { ...r, total: null } : r)) },
          200,
        )
      })
      .get('/:id', requireAuth, validate('param', idParamSchema), async (c) => {
        const found = await repo.byId(c.req.valid('param').id)
        if (!found) throw new HTTPException(404, { message: 'El trabajo no existe' })
        const hasDoc =
          (await db.query.attachments.findFirst({
            where: { caseId: found.id, kind: 'document' },
            columns: { id: true },
          })) !== undefined
        const view = hidesPrices(c.var.user?.role) ? stripPrices(found) : found
        return c.json({ case: view, missing: readiness(found, hasDoc) }, 200)
      })
      .post('/', canWrite, validate('json', caseInputSchema), async (c) => {
        try {
          const { id } = await uow.run(({ cases }) =>
            cases.create(c.req.valid('json'), c.var.user!.id),
          )
          return c.json({ case: (await repo.byId(id))! }, 201)
        } catch (e) {
          if (e instanceof CaseInputError)
            return c.json(
              { message: 'Datos inválidos', issues: [{ path: e.path, message: e.message }] },
              422,
            )
          throw e
        }
      })
      .put(
        '/:id',
        canWrite,
        validate('param', idParamSchema),
        validate('json', caseInputSchema),
        async (c) => {
          const { id } = c.req.valid('param')
          let updated: boolean
          try {
            updated = await uow.run(({ cases }) =>
              cases.update(id, c.req.valid('json'), c.var.user!.id),
            )
          } catch (e) {
            if (e instanceof CaseInputError)
              return c.json(
                { message: 'Datos inválidos', issues: [{ path: e.path, message: e.message }] },
                422,
              )
            if (e instanceof CaseStateError) throw new HTTPException(409, { message: e.message })
            throw e
          }
          if (!updated) throw new HTTPException(404, { message: 'El trabajo no existe' })
          return c.json({ case: (await repo.byId(id))! }, 200)
        },
      )
      .get('/:id/eventos', requireAuth, validate('param', idParamSchema), async (c) =>
        c.json(
          {
            events: maskPriceEvents(
              await repo.events(c.req.valid('param').id),
              hidesPrices(c.var.user?.role),
            ),
          },
          200,
        ),
      )
      .post(
        '/:id/comentarios',
        requireAuth,
        validate('param', idParamSchema),
        validate('json', commentSchema),
        async (c) => {
          const { id } = c.req.valid('param')
          if (!(await repo.byId(id)))
            throw new HTTPException(404, { message: 'El trabajo no existe' })
          await repo.addEvent({
            caseId: id,
            type: 'comment',
            toValue: c.req.valid('json').text,
            actorId: c.var.user!.id,
          })
          const events = maskPriceEvents(await repo.events(id), hidesPrices(c.var.user?.role))
          return c.json({ event: events[events.length - 1]! }, 201)
        },
      )
  )
}
