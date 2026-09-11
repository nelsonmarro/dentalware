import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { fetchHealth } from './api'

export function useHealth() {
  return useQuery({ queryKey: queryKeys.health, queryFn: fetchHealth })
}
