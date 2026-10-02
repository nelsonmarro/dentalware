import { Camera, Paperclip } from 'lucide-react'
import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import { usePhotoUpload } from './use-photo-upload'

/**
 * Dos botones abren el mismo tipo de selector con distinto `capture`: "Añadir foto"
 * pide la cámara trasera en móvil (`capture="environment"`), "Subir archivo" abre el
 * selector normal (galería/archivos). El atributo no se puede alternar en un único
 * `<input>` según qué botón se pulsó, así que son dos inputs ocultos. La lógica de subida
 * (compresión + mutación en serie) vive en `usePhotoUpload` (Tarea 15, FIC-3 #73): la
 * comparte `QuickCase`, que solo necesita el botón de cámara.
 */
export function PhotoUploader({ caseId, onUploaded }: { caseId: string; onUploaded?: () => void }) {
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { handleFiles, progress } = usePhotoUpload(caseId, onUploaded)

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
