import { isoDate } from '@dentalware/shared'
import { z } from 'zod'

/** `search` de `/cuentas/$clinicaId/estado` (CTA-5): el rango en fechas de negocio. Tolerante
 * (`docs/conventions.md` §5): cada fecha que no es válida se descarta por separado. */
const statementSearchSchema = z.object({
  desde: isoDate.optional().catch(undefined),
  hasta: isoDate.optional().catch(undefined),
})

export type StatementSearch = { desde?: string; hasta?: string }

export function parseStatementSearch(input: unknown): StatementSearch {
  const { desde, hasta } = statementSearchSchema.catch({}).parse(input)
  // Sin claves `undefined`: la URL queda limpia.
  return { ...(desde && { desde }), ...(hasta && { hasta }) }
}

/** Primer día del mes de una fecha `YYYY-MM-DD`. */
const monthStart = (date: string) => `${date.slice(0, 8)}01`

/**
 * El rango que se pide a la API: el de la URL, y lo que falta, por omisión (el mes en curso, del
 * día 1 a `today`; solo con `hasta`, desde el día 1 de su mes; solo con `desde`, hasta hoy). Una
 * fecha final posterior a hoy se corta en hoy, y un rango al revés no se pide: vuelve al mes en
 * curso.
 */
export function statementRange(
  search: StatementSearch,
  today: string,
): { desde: string; hasta: string } {
  // La API no da el estado de cuenta más allá de hoy (I-2): una fecha final futura se corta.
  const hasta = search.hasta && search.hasta <= today ? search.hasta : today
  const desde = search.desde ?? monthStart(hasta)
  return desde <= hasta ? { desde, hasta } : { desde: monthStart(today), hasta: today }
}
