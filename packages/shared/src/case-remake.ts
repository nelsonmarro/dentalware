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
