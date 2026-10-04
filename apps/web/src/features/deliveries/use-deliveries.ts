import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { fetchDeliveries } from './api'

/** Recogidas y entregas de un día (ENT-5). Sin `courierId`: todas (admin y recepción); el
 * mensajero recibe siempre las suyas, lo fuerza la API. */
export function useDeliveries(day: string, courierId?: string) {
  return useQuery({
    queryKey: queryKeys.deliveries.day(day, courierId),
    queryFn: () => fetchDeliveries(courierId ? { dia: day, mensajeroId: courierId } : { dia: day }),
  })
}
