import type { RemakeResponsibility } from './schemas/cases.ts'

/**
 * Fecha deseada (`dueDate`) que hereda el hijo de una repetición (CIC-4). Regla pura,
 * sin I/O: se copia la del padre solo si todavía no pasó respecto a `receivedAt` (la fecha de
 * recepción del hijo, "hoy"); el disparador típico de una repetición es que el trabajo salió
 * mal *después* de la fecha comprometida, así que copiarla tal cual metería al hijo en
 * "atrasados" desde que nace. Si ya venció, se devuelve `null`: `missingForAccept` la reclama
 * como "Fecha deseada" y obliga a quien repite a decidir una nueva, que es justo la pregunta
 * que corresponde en ese momento.
 *
 * Única fuente de esta regla (antes vivía duplicada en `repo.ts` y `fakes.ts` de
 * `apps/api/src/features/cases`, y solo la copia del fake tenía test).
 */
export function remakeDueDate(parentDue: string | null, receivedAt: string): string | null {
  return parentDue && parentDue >= receivedAt ? parentDue : null
}

/**
 * Porcentaje que se sugiere cobrar a la clínica al repetir un trabajo, según de quién fue la
 * responsabilidad (UX3-06): si falló el laboratorio no se cobra, si falló la clínica se cobra
 * todo y si fue compartida, la mitad. Es solo la **sugerencia** del formulario «Repetir»:
 * quien repite puede escribir otro valor y la API guarda el que llega (`remakeSchema` lo
 * exige; no hay valor por omisión en el servidor). `Record` exhaustivo: una responsabilidad
 * nueva no compila sin decidir su porcentaje.
 */
export const REMAKE_CHARGE_PCT_BY_RESPONSIBILITY: Record<RemakeResponsibility, number> = {
  laboratorio: 0,
  clinica: 100,
  compartida: 50,
}
