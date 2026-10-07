import {
  ACCOUNT_ADMIN_ROLES,
  ACCOUNTS_ROLES,
  accountListQuerySchema,
  applyCreditInputSchema,
  idParamSchema,
  paymentInputSchema,
  voidPaymentInputSchema,
} from '@dentalware/shared'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { validate } from '../../lib/validate.ts'
import type { AppEnv } from '../auth/session.ts'
import { ctxFrom, requireAuth, requireRole } from '../auth/session.ts'
import {
  AccountForbiddenError,
  AccountInputError,
  ClinicAccountNotFoundError,
  PaymentNotFoundError,
  PaymentVoidedError,
} from './errors.ts'
import type { AccountsService } from './service.ts'

// «Cuentas», saldo y movimientos: admin y recepción (ADR 31: su propia constante,
// ACCOUNTS_ROLES). Técnico y mensajero nunca ven importes.
// Registrar pagos y aplicar saldo a favor, también ACCOUNTS_ROLES; anular, solo admin
// (ACCOUNT_ADMIN_ROLES, decisión 2).
const canRead = requireRole(...ACCOUNTS_ROLES)
const canVoid = requireRole(...ACCOUNT_ADMIN_ROLES)

/** Cuerpo del 422 de un `AccountInputError`: el mismo contrato que `validate`. */
const inputIssues = (e: AccountInputError) => ({
  message: 'Datos inválidos',
  issues: [{ path: e.path, message: e.message }],
})

/** Traduce los errores de dominio del servicio a la respuesta HTTP que espera la web. */
function toHttp(e: unknown): never {
  if (e instanceof ClinicAccountNotFoundError || e instanceof PaymentNotFoundError) {
    throw new HTTPException(404, { message: 'No encontrado' })
  }
  if (e instanceof PaymentVoidedError) throw new HTTPException(409, { message: e.message })
  if (e instanceof AccountForbiddenError) throw new HTTPException(403, { message: e.message })
  throw e as Error
}

/** `/api/cuentas` (Iteración 5): la lista de «Cuentas» y la cuenta de una clínica (CTA-1), y
 * los pagos con su reparto, el saldo a favor y la anulación (CTA-2). */
export const accountsRoutes = (service: AccountsService) =>
  new Hono<AppEnv>()
    // Todo el router exige sesión antes que rol: sin sesión, 401; con otro rol, 403.
    .use(requireAuth)
    .get('/', canRead, validate('query', accountListQuerySchema), async (c) =>
      c.json({ clinics: await service.list(c.req.valid('query')) }, 200),
    )
    .get('/:id', canRead, validate('param', idParamSchema), async (c) => {
      try {
        return c.json(await service.clinicAccount(c.req.valid('param').id), 200)
      } catch (e) {
        toHttp(e)
      }
    })
    .post('/pagos', canRead, validate('json', paymentInputSchema), async (c) => {
      try {
        return c.json({ pago: await service.registerPayment(c.req.valid('json'), ctxFrom(c)) }, 201)
      } catch (e) {
        if (e instanceof AccountInputError) return c.json(inputIssues(e), 422)
        toHttp(e)
      }
    })
    .post(
      '/pagos/:id/asignaciones',
      canRead,
      validate('param', idParamSchema),
      validate('json', applyCreditInputSchema),
      async (c) => {
        try {
          const pago = await service.applyCredit(
            c.req.valid('param').id,
            c.req.valid('json'),
            ctxFrom(c),
          )
          return c.json({ pago }, 201)
        } catch (e) {
          if (e instanceof AccountInputError) return c.json(inputIssues(e), 422)
          toHttp(e)
        }
      },
    )
    .post(
      '/pagos/:id/anular',
      canVoid,
      validate('param', idParamSchema),
      validate('json', voidPaymentInputSchema),
      async (c) => {
        try {
          const pago = await service.voidPayment(
            c.req.valid('param').id,
            c.req.valid('json'),
            ctxFrom(c),
          )
          return c.json({ pago }, 200)
        } catch (e) {
          toHttp(e)
        }
      },
    )
