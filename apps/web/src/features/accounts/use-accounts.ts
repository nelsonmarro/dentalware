import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { fetchAccounts } from './api'

/** La lista de «Cuentas» (CTA-1). Con `todas`, también las clínicas activas sin saldo ni
 * movimientos. */
export function useAccounts(todas: boolean) {
  return useQuery({
    queryKey: queryKeys.accounts.list(todas),
    queryFn: () => fetchAccounts({ todas }),
  })
}
