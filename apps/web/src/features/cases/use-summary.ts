import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { fetchSummary } from './api'

/** `GET /api/trabajos/resumen` (Tarea 11, #68): un contador por vista rápida para el panel de
 * inicio (`<SummaryCards />`). La clave vive bajo el prefijo `['trabajos']`
 * (`queryKeys.summary`), así que cualquier mutación de un trabajo que ya invalida por ese
 * prefijo (`useInvalidateCases` en `use-cases.ts`) también refresca los contadores. */
export function useSummary() {
  return useQuery({ queryKey: queryKeys.summary, queryFn: fetchSummary })
}
