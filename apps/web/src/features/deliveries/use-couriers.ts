import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { fetchCouriers } from './api'

/** Mensajeros activos para los selectores de recogida y envío. `enabled`: solo quien
 * administra entregas la pide (la API responde 403 al resto). */
export function useCouriers(enabled = true) {
  return useQuery({ queryKey: queryKeys.couriers, queryFn: fetchCouriers, enabled })
}
