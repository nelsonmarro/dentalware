import type { DeliveryFailInput } from '@dentalware/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { formatDate } from '@/features/cases/date-format'
import { useConflictAwareError } from '@/features/cases/use-cases'
import { failDelivery } from './api'

/** «No se pudo» (ENT-5): cierra la entrega como fallida y la reprograma. Invalida `['trabajos']`,
 * que alcanza la lista de entregas (`queryKeys.deliveries`), el detalle y el historial del
 * trabajo (evento `delivery_failed`); `onSuccess` **espera** la invalidación para que el botón
 * no se rehabilite con la lista vieja en pantalla. Un 409 (ya no estaba pendiente: otra persona
 * la cerró) refresca y luego avisa, como las acciones del trabajo. */
export function useFailDelivery(id: string) {
  const qc = useQueryClient()
  const onError = useConflictAwareError()
  return useMutation({
    mutationFn: (input: DeliveryFailInput) => failDelivery(id, input),
    onSuccess: async (_next, input) => {
      await qc.invalidateQueries({ queryKey: ['trabajos'] })
      toast.success(`Reprogramada para el ${formatDate(input.nuevaFecha)}`)
    },
    onError,
  })
}
