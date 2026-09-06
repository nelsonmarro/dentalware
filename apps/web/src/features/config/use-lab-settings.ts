import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { toastApiError } from '@/lib/api-error'
import { queryKeys } from '@/lib/query-keys'
import { fetchLabSettings, saveLabSettings } from './api'

export function useLabSettings() {
  return useQuery({ queryKey: queryKeys.labSettings, queryFn: fetchLabSettings })
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
