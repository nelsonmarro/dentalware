import { useIsMutating } from '@tanstack/react-query'
import { mutationKeys } from '@/lib/query-keys'

/**
 * Si la cuenta de la clínica tiene una mutación en curso (`busy`) y si alguna espera la señal
 * (`queued`): sin red, TanStack Query la deja en pausa y la envía al volver. Mientras tanto la
 * pantalla no deja registrar otro pago ni otro ajuste, aunque el diálogo se cerrara con «Volver».
 */
export function useAccountBusy(clinicId: string) {
  const mutationKey = mutationKeys.account(clinicId)
  const busy = useIsMutating({ mutationKey }) > 0
  const queued = useIsMutating({ mutationKey, predicate: (m) => m.state.isPaused }) > 0
  return { busy, queued }
}
