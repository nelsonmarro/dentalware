import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { DoctorInput } from '@dentalware/shared'
import { toast } from 'sonner'
import { toastApiError } from '@/lib/api-error'
import { queryKeys } from '@/lib/query-keys'
import { createDoctor, fetchDoctors, setDoctorActive, updateDoctor } from './api'

export function useDoctors(clinicId: string, inactive: boolean, enabled = true) {
  return useQuery({
    queryKey: queryKeys.doctors(clinicId, inactive),
    queryFn: () => fetchDoctors(clinicId, inactive),
    enabled: enabled && clinicId !== '',
  })
}
function useInvalidateDoctors() {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: ['config', 'doctores'] })
    void qc.invalidateQueries({ queryKey: ['config', 'clinicas'] })
  }
}
export function useSaveDoctor() {
  const invalidate = useInvalidateDoctors()
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: DoctorInput }) =>
      id ? updateDoctor(id, input) : createDoctor(input),
    onSuccess: (_d, { id }) => {
      invalidate()
      toast.success(id ? 'Doctor actualizado' : 'Doctor creado')
    },
    onError: toastApiError,
  })
}
export function useSetDoctorActive() {
  const invalidate = useInvalidateDoctors()
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => setDoctorActive(id, active),
    onSuccess: (_d, { active }) => {
      invalidate()
      toast.success(active ? 'Doctor activado' : 'Doctor desactivado')
    },
    onError: toastApiError,
  })
}
