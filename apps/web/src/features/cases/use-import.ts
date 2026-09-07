import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { toastApiError } from '@/lib/api-error'
import { commitImport, validateImport } from './api'

export function useValidateImport() {
  return useMutation({
    mutationFn: (file: File) => validateImport(file),
    onError: toastApiError,
  })
}

export function useImportCases() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => commitImport(file),
    onSuccess: (report) => {
      void qc.invalidateQueries({ queryKey: ['trabajos'] })
      toast.success(
        report.cases === 1 ? 'Se importó 1 trabajo' : `Se importaron ${report.cases} trabajos`,
      )
    },
    onError: toastApiError,
  })
}
