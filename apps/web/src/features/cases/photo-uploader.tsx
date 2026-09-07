import { Camera, Paperclip } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api-error'
import { compressImage } from '@/lib/image-compress'
import { useUploadAttachment } from './use-attachments'

/**
 * Dos botones abren el mismo tipo de selector con distinto `capture`: "Añadir foto"
 * pide la cámara trasera en móvil (`capture="environment"`), "Subir archivo" abre el
 * selector normal (galería/archivos). El atributo no se puede alternar en un único
 * `<input>` según qué botón se pulsó, así que son dos inputs ocultos.
 */
export function PhotoUploader({ caseId, onUploaded }: { caseId: string; onUploaded?: () => void }) {
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
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

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        className="h-11"
        onClick={() => cameraInputRef.current?.click()}
      >
        <Camera /> Añadir foto
      </Button>
      <Button
        type="button"
        variant="outline"
        className="h-11"
        onClick={() => fileInputRef.current?.click()}
      >
        <Paperclip /> Subir archivo
      </Button>
      {progress && (
        <span role="status" className="text-sm text-muted-foreground">
          {progress.done + 1} de {progress.total}…
        </span>
      )}
      <input
        ref={cameraInputRef}
        type="file"
        aria-label="Añadir foto"
        accept="image/*,application/pdf"
        capture="environment"
        multiple
        className="sr-only"
        onChange={(e) => {
          void handleFiles(e.target.files)
          e.target.value = ''
        }}
      />
      <input
        ref={fileInputRef}
        type="file"
        aria-label="Subir archivo"
        accept="image/*,application/pdf"
        multiple
        className="sr-only"
        onChange={(e) => {
          void handleFiles(e.target.files)
          e.target.value = ''
        }}
      />
    </div>
  )
}
