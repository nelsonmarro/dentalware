import { ACCOUNTS_ROLES, accountListQuerySchema, idParamSchema } from '@dentalware/shared'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { validate } from '../../lib/validate.ts'
import type { AppEnv } from '../auth/session.ts'
import { requireAuth, requireRole } from '../auth/session.ts'
import { ClinicAccountNotFoundError } from './errors.ts'
import type { AccountsService } from './service.ts'

// «Cuentas», saldo y movimientos: admin y recepción (ADR 31: su propia constante,
// ACCOUNTS_ROLES). Técnico y mensajero nunca ven importes.
const canRead = requireRole(...ACCOUNTS_ROLES)

/** Traduce los errores de dominio del servicio a la respuesta HTTP que espera la web. */
function toHttp(e: unknown): never {
  if (e instanceof ClinicAccountNotFoundError) {
    throw new HTTPException(404, { message: 'No encontrado' })
  }
  throw e as Error
}

/** `/api/cuentas` (Iteración 5, CTA-1): la lista de «Cuentas» y la cuenta de una clínica. */
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
