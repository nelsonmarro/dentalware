import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ApiError } from '@/lib/api-error'
import { compressImage } from '@/lib/image-compress'
import { mutationKeys, queryKeys } from '@/lib/query-keys'
import { uploadAttachment } from './attachments-api'

/** La subida dice que la entrega ya no es de quien sube (403) o que el trabajo cambió (409). */
export function isProofRejected(err: unknown): boolean {
  return err instanceof ApiError && (err.status === 403 || err.status === 409)
}

/**
 * Sube la foto de constancia de «Marcar entregado» (UX4-06): solo cuando se confirma la entrega,
 * nunca al elegirla, para que «Volver», Escape o «Cambiar foto» no dejen constancias huérfanas.
 * Comprime en el cliente y sube con `kind=constancia`. No avisa del éxito (UX4-15): el aviso de
 * la entrega es el de la acción. Un fallo avisa una vez; si la API la rechaza porque la entrega
 * ya no es suya o el trabajo cambió (403/409), refresca todo lo del trabajo antes de avisar,
 * igual que `useConflictAwareError`, para que quien la abrió vea el estado real.
 */
export function useUploadProof(caseId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: mutationKeys.proofUpload(caseId),
    mutationFn: async (photo: File) => {
      const form = new FormData()
      form.append('file', await compressImage(photo), photo.name)
      form.append('kind', 'constancia')
      return uploadAttachment(caseId, form)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.attachments(caseId) })
      void qc.invalidateQueries({ queryKey: queryKeys.caseEvents(caseId) })
    },
    onError: async (err) => {
      if (isProofRejected(err)) await qc.invalidateQueries({ queryKey: ['trabajos'] })
      toast.error(err instanceof ApiError ? err.message : 'No se pudo subir la foto de constancia')
    },
  })
}
