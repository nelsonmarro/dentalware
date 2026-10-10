import { z } from 'zod'

/** `search` de `/cuentas`: `todas=1` muestra también las clínicas activas sin saldo ni
 * movimientos (`GET /api/cuentas?todas=1`). El router lee `?todas=1` como número; se acepta
 * también como texto. Tolerante (`docs/conventions.md` §5): cualquier otro valor se descarta. */
const accountsSearchSchema = z.object({
  todas: z
    .union([z.literal(1), z.literal('1')])
    .transform(() => 1 as const)
    .optional()
    .catch(undefined),
})

export type AccountsSearch = { todas?: 1 }

export function parseAccountsSearch(input: unknown): AccountsSearch {
  const { todas } = accountsSearchSchema.catch({}).parse(input)
  // Sin claves `undefined`: la URL queda limpia al navegar con `search: (prev) => …`.
  return todas ? { todas } : {}
}
