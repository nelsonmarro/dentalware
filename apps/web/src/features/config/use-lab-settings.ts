import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { toastApiError } from '@/lib/api-error'
import { queryKeys } from '@/lib/query-keys'
import { fetchLabSettings, saveLabSettings } from './api'

/** `enabled = false` para quien no usa los datos (la ficha solo los pide a quien avisa). */
export function useLabSettings(enabled = true) {
  return useQuery({ queryKey: queryKeys.labSettings, queryFn: fetchLabSettings, enabled })
}

export function useSaveLabSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: saveLabSettings,
    onSuccess: (settings) => {
      qc.setQueryData(queryKeys.labSettings, settings)
      toast.success('Datos del laboratorio guardados')
    },
    onError: toastApiError,
  })
}
