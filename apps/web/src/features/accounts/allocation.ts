import { fromCents, suggestAllocation, toSignedCents } from '@dentalware/shared'

/** Lo que el reparto necesita de un trabajo «Por cobrar». */
type OpenCaseRef = { id: string; code: string; deliveredAt: string; outstanding: string }

/** Una fila del reparto en el formulario: vacía si no se le asigna nada. */
export type AllocationRow = { trabajoId: string; monto: string }

/** Los trabajos en el orden del reparto sugerido (decisión 8): de la entrega más antigua a la
 * más nueva y, a igualdad, por código. Así la tabla y el relleno van en el mismo orden. */
export function orderOpenCases<T extends OpenCaseRef>(open: readonly T[]): T[] {
  return [...open].sort(
    (a, b) => a.deliveredAt.localeCompare(b.deliveredAt) || a.code.localeCompare(b.code),
  )
}

/** Una fila por trabajo con lo que le toca de `amountCents` según `suggestAllocation` de shared;
 * sin monto (`null`), todas vacías. `ordered` ya viene en el orden de `orderOpenCases`. */
export function suggestedRows(
  ordered: readonly OpenCaseRef[],
  amountCents: number | null,
): AllocationRow[] {
  const suggestion =
    amountCents === null
      ? []
      : suggestAllocation(
          amountCents,
          ordered.map((c) => ({
            caseId: c.id,
            code: c.code,
            deliveredAt: c.deliveredAt,
            outstandingCents: toSignedCents(c.outstanding),
          })),
        )
  return ordered.map((c) => {
    const cents = suggestion.find((s) => s.caseId === c.id)?.amountCents
    return { trabajoId: c.id, monto: cents ? fromCents(cents) : '' }
  })
}

/**
 * El campo del formulario de un error 422 de la API. El reparto que viaja no lleva las filas
 * vacías: `sent[j]` es la fila del formulario de la asignación `j`. Un error en el trabajo de
 * una asignación se pinta bajo el monto de su fila, que es lo que se ve. `null` si no hay campo.
 */
export function formFieldForIssue(path: string, sent: readonly number[]): string | null {
  const match = /^asignaciones\.(\d+)\.(monto|trabajoId)$/.exec(path)
  if (!match) return path
  const row = sent[Number(match[1])]
  return row === undefined ? null : `asignaciones.${row}.monto`
}

/**
 * Pinta bajo su campo cada error de un 422 de la API: los del reparto en su fila
 * (`formFieldForIssue`), `asignaciones` en el total y el resto si el formulario tiene ese campo
 * (`fields`). Devuelve `true` si alguno no tiene dónde pintarse (o no vino ninguno): entonces el
 * diálogo avisa con un toast.
 */
export function applyIssues(
  issues: readonly { path: string; message: string }[],
  sent: readonly number[],
  fields: readonly string[],
  setError: (field: string, message: string) => void,
): boolean {
  let unmapped = issues.length === 0
  for (const issue of issues) {
    const field = formFieldForIssue(issue.path, sent)
    if (field && (field.startsWith('asignaciones') || fields.includes(field))) {
      setError(field, issue.message)
    } else {
      unmapped = true
    }
  }
  return unmapped
}
