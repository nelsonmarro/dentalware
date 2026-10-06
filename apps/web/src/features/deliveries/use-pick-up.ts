import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useConflictAwareError } from '@/features/cases/use-cases'
import { mutationKeys } from '@/lib/query-keys'
import { pickUpDelivery } from './api'

/**
 * «Recogido» (#118): el mensajero recogió en la clínica; el trabajo sigue por recoger, ahora en
 * camino al laboratorio. Invalida `['trabajos']`, que alcanza «Entregas», la ficha y el historial
 * (evento `picked_up`), y `onSuccess` **espera** la invalidación para que el botón no se
 * rehabilite con la recogida aún pendiente en pantalla. Cuelga de `mutationKeys.case`: sin red,
 * `useCaseBusy` no deja repetirla (M-4). Un 409 (otra persona la cerró) refresca y luego avisa.
 */
export function usePickUp(id: string, caseId: string) {
  const qc = useQueryClient()
  const onError = useConflictAwareError()
  return useMutation({
    mutationKey: mutationKeys.pickUp(caseId),
    mutationFn: () => pickUpDelivery(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['trabajos'] })
      toast.success('Recogida registrada')
    },
    onError,
  })
}
