import { z } from 'zod'

/** `search` de `/trabajos/$caseId`: `foco=whatsapp` enfoca «Avisar por WhatsApp» al volver de
 * añadir el WhatsApp de la clínica; la ficha lo quita de la URL. Tolerante (`docs/conventions.md`
 * §5): cualquier otro valor se descarta. */
const caseSearchSchema = z.object({
  foco: z.literal('whatsapp').optional().catch(undefined),
})

export type CaseSearch = { foco?: 'whatsapp' }

export function parseCaseSearch(input: unknown): CaseSearch {
  const { foco } = caseSearchSchema.catch({}).parse(input)
  // Sin claves `undefined`: la URL queda limpia al navegar.
  return foco ? { foco } : {}
}
