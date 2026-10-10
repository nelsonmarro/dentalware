import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { fetchAccountStatement } from './api'

/** El estado de cuenta de una clínica por rango (CTA-5). */
export function useAccountStatement(clinicId: string, range: { desde: string; hasta: string }) {
  return useQuery({
    queryKey: queryKeys.accounts.statement(clinicId, range.desde, range.hasta),
    queryFn: () => fetchAccountStatement(clinicId, range),
  })
}
