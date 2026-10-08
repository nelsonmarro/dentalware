import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { fetchClinicAccount } from './api'

/** La cuenta de una clínica (CTA-1): saldo, antigüedad, «Por cobrar» y movimientos. */
export function useClinicAccount(clinicId: string) {
  return useQuery({
    queryKey: queryKeys.accounts.clinic(clinicId),
    queryFn: () => fetchClinicAccount(clinicId),
  })
}
