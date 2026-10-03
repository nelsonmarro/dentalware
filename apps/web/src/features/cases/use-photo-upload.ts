import { useState } from 'react'
import { toast } from 'sonner'
import { ApiError } from '@/lib/api-error'
import { compressImage } from '@/lib/image-compress'
import { isPhoto } from './attachment-kind'
import { useUploadAttachment } from './use-attachments'

/**
 * Lógica de subida de fotos compartida (Tarea 15, FIC-3 #73): extraída de `PhotoUploader`
 * (ficha completa, cámara + archivo) para que `QuickCase` (ficha corta del QR, solo cámara)
 * la reutilice sin duplicar el bucle de compresión + subida en serie en dos componentes.
 * Comprime cada imagen en el cliente, sube en serie (una mutación por archivo) y avisa con
 * un único toast por archivo que falla; sin `onError` en la mutación (el propio bucle ya
 * maneja el error de cada archivo, ver `use-attachments.ts`). Al terminar, un solo aviso de
 * éxito con las que entraron (UX3-08: con guantes, sin él no se sabía si la foto subió).
 */
export function usePhotoUpload(caseId: string, onUploaded?: () => void) {
  const upload = useUploadAttachment(caseId)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    const files = [...fileList]
    let photos = 0
    let documents = 0
    for (const [index, file] of files.entries()) {
      setProgress({ done: index, total: files.length })
      try {
        const compressed = await compressImage(file)
        const form = new FormData()
        form.append('file', compressed, file.name)
        await upload.mutateAsync(form)
        if (isPhoto({ mime: file.type })) photos += 1
        else documents += 1
      } catch (err) {
        toast.error(
          err instanceof ApiError
            ? `${file.name}: ${err.message}`
            : `No se pudo subir "${file.name}"`,
        )
      }
    }
    setProgress(null)
    const message = uploadedMessage(photos, documents)
    if (message) toast.success(message)
    onUploaded?.()
  }

  return { handleFiles, progress }
}

/** Aviso de éxito según lo que entró (M-1 de la revisión de la Tarea 5): desde la ficha
 * completa también se suben PDF, y «Foto añadida» de un documento era falso. Misma regla de
 * foto que el resto de la web (`isPhoto`, por MIME). `null` si no entró nada. */
function uploadedMessage(photos: number, documents: number): string | null {
  const total = photos + documents
  if (total === 0) return null
  if (documents === 0) return photos === 1 ? 'Foto añadida' : `${photos} fotos añadidas`
  if (photos === 0)
    return documents === 1 ? 'Documento añadido' : `${documents} documentos añadidos`
  return `${total} archivos añadidos`
}
