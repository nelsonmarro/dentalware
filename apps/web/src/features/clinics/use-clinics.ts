import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ClinicInput } from '@dentalware/shared'
import { toast } from 'sonner'
import { toastApiError } from '@/lib/api-error'
import { queryKeys } from '@/lib/query-keys'
import { createClinic, fetchClinic, fetchClinics, setClinicActive, updateClinic } from './api'

export function useClinics(inactive: boolean) {
  return useQuery({ queryKey: queryKeys.clinics(inactive), queryFn: () => fetchClinics(inactive) })
}
export function useClinic(id: string) {
  return useQuery({ queryKey: queryKeys.clinic(id), queryFn: () => fetchClinic(id) })
}
function useInvalidateClinics() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['config', 'clinicas'] })
}
export function useSaveClinic() {
  const invalidate = useInvalidateClinics()
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: ClinicInput }) =>
      id ? updateClinic(id, input) : createClinic(input),
    onSuccess: (_c, { id }) => {
      void invalidate()
      toast.success(id ? 'Clínica actualizada' : 'Clínica creada')
    },
    onError: toastApiError,
  })
}
export function useSetClinicActive() {
  const invalidate = useInvalidateClinics()
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => setClinicActive(id, active),
    onSuccess: (_c, { active }) => {
      void invalidate()
      toast.success(active ? 'Clínica activada' : 'Clínica desactivada')
    },
    onError: toastApiError,
  })
}
