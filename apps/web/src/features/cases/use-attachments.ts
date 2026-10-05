import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ApiError, toastApiError } from '@/lib/api-error'
import { queryKeys } from '@/lib/query-keys'
import { deleteAttachment, fetchAttachments, uploadAttachment } from './attachments-api'

export function useAttachments(caseId: string) {
  return useQuery({
    queryKey: queryKeys.attachments(caseId),
    queryFn: () => fetchAttachments(caseId),
    // La ficha corta monta el hook antes de saber el id (lo resuelve por código).
    enabled: caseId !== '',
  })
}

export function useUploadAttachment(caseId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (form: FormData) => uploadAttachment(caseId, form),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.attachments(caseId) })
      void qc.invalidateQueries({ queryKey: queryKeys.caseEvents(caseId) })
    },
    // Sin `onError`: `PhotoUploader` sube en serie y ya muestra un toast por archivo
    // (con el nombre del archivo y el mensaje del servidor) en su propio `catch`; un
    // `onError` aquí duplicaría el aviso.
  })
}

export function useDeleteAttachment(caseId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteAttachment(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.attachments(caseId) })
      void qc.invalidateQueries({ queryKey: queryKeys.caseEvents(caseId) })
      toast.success('Adjunto eliminado')
    },
    // Convención §5: un 409 (la constancia quedó ligada a una entrega hecha) espera el refresco
    // de los adjuntos y después avisa, para que la lista ya no ofrezca borrarla.
    onError: async (error) => {
      if (error instanceof ApiError && error.status === 409) {
        await qc.invalidateQueries({ queryKey: queryKeys.attachments(caseId) })
      }
      toastApiError(error)
    },
  })
}
