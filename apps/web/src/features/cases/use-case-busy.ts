import { useIsMutating } from '@tanstack/react-query'
import { mutationKeys } from '@/lib/query-keys'

/**
 * Si el trabajo tiene una acción en curso (`busy`) y si alguna espera la señal (`queued`, M-4):
 * sin red, TanStack Query deja la mutación en pausa y la envía al volver la señal. Cuenta las de
 * `mutationKeys.case(caseId)` aunque las lanzara un diálogo ya cerrado, así que la tarjeta y la
 * ficha no dejan repetir la misma entrega con otra foto o otro motivo.
 */
export function useCaseBusy(caseId: string) {
  const mutationKey = mutationKeys.case(caseId)
  const busy = useIsMutating({ mutationKey }) > 0
  const queued = useIsMutating({ mutationKey, predicate: (m) => m.state.isPaused }) > 0
  return { busy, queued }
}
