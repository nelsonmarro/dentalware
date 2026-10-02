import { useState } from 'react'
import { toast } from 'sonner'
import { ApiError } from '@/lib/api-error'
import { compressImage } from '@/lib/image-compress'
import { useUploadAttachment } from './use-attachments'

/**
 * Lógica de subida de fotos compartida (Tarea 15, FIC-3 #73): extraída de `PhotoUploader`
 * (ficha completa, cámara + archivo) para que `QuickCase` (ficha corta del QR, solo cámara)
 * la reutilice sin duplicar el bucle de compresión + subida en serie en dos componentes.
 * Comprime cada imagen en el cliente, sube en serie (una mutación por archivo) y avisa con
 * un único toast por archivo que falla; sin `onError` en la mutación (el propio bucle ya
 * maneja el error de cada archivo, ver `use-attachments.ts`).
 */
export function usePhotoUpload(caseId: string, onUploaded?: () => void) {
  const upload = useUploadAttachment(caseId)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    const files = [...fileList]
    for (const [index, file] of files.entries()) {
      setProgress({ done: index, total: files.length })
      try {
        const compressed = await compressImage(file)
        const form = new FormData()
        form.append('file', compressed, file.name)
        await upload.mutateAsync(form)
      } catch (err) {
        toast.error(
          err instanceof ApiError
            ? `${file.name}: ${err.message}`
            : `No se pudo subir "${file.name}"`,
        )
      }
    }
    setProgress(null)
    onUploaded?.()
  }

  return { handleFiles, progress }
}
