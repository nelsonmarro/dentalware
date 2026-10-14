import { z } from 'zod'
import { safeRedirect } from '@/features/auth/safe-redirect'

/** `search` de `/configuracion/clinicas`: `editar` abre el diálogo de esa clínica (AVI-4),
 * `volver` es la ruta interna a la que se regresa al guardar o cancelar (la ficha del trabajo) y
 * `campo` el campo que recibe el foco. Tolerante (`docs/conventions.md` §5): lo inválido se
 * descarta y `volver` pasa por `safeRedirect` (nunca un destino externo). */
const clinicsSearchSchema = z
  .object({
    editar: z.string().min(1).optional().catch(undefined),
    volver: z.string().optional().catch(undefined),
    campo: z.literal('whatsapp').optional().catch(undefined),
  })
  .catch({})

export type ClinicsSearch = { editar?: string; volver?: string; campo?: 'whatsapp' }

export function parseClinicsSearch(input: unknown): ClinicsSearch {
  const { editar, volver, campo } = clinicsSearchSchema.parse(input)
  const safe = safeRedirect(volver) ?? undefined
  // Sin claves `undefined`: la URL queda limpia al navegar.
  return {
    ...(editar ? { editar } : {}),
    ...(safe ? { volver: safe } : {}),
    ...(campo ? { campo } : {}),
  }
}
