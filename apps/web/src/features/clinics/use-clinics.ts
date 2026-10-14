import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ClinicInput } from '@dentalware/shared'
import { toast } from 'sonner'
import { toastApiError } from '@/lib/api-error'
import { queryKeys } from '@/lib/query-keys'
import { createClinic, fetchClinic, fetchClinics, setClinicActive, updateClinic } from './api'

export function useClinics(inactive: boolean) {
  return useQuery({ queryKey: queryKeys.clinics(inactive), queryFn: () => fetchClinics(inactive) })
}
export function useClinic(id: string, enabled = true) {
  return useQuery({ queryKey: queryKeys.clinic(id), queryFn: () => fetchClinic(id), enabled })
}
function useInvalidateClinics() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['config', 'clinicas'] })
}
export function useSaveClinic() {
  const invalidate = useInvalidateClinics()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: ClinicInput; doneText?: string }) =>
      id ? updateClinic(id, input) : createClinic(input),
    onSuccess: (_c, { id, doneText }) => {
      void invalidate()
      // La ficha de un trabajo trae el contacto de su clínica (WhatsApp). Se descarta lo cacheado
      // (no solo se marca vieja): al volver de «Añadir WhatsApp» la ficha monta con datos que ya
      // tienen el número, y `?foco=whatsapp` encuentra el enlace en vez de gastarse con los viejos.
      qc.removeQueries({ queryKey: ['trabajos'] })
      toast.success(doneText ?? (id ? 'Clínica actualizada' : 'Clínica creada'))
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
