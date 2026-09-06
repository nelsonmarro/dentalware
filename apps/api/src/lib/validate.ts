import { zValidator } from '@hono/zod-validator'
import type { ValidationTargets } from 'hono'
import type { ZodType } from 'zod'

/** zValidator con respuesta 422 en español: { message, issues: [{ path, message }] }. */
export function validate<T extends ZodType, Target extends keyof ValidationTargets>(
  target: Target,
  schema: T,
) {
  return zValidator(target, schema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          message: 'Datos inválidos',
          issues: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        },
        422,
      )
    }
  })
}
