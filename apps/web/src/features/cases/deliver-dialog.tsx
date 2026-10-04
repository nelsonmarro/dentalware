import { Camera, RefreshCcw } from 'lucide-react'
import { useRef, useState } from 'react'
import { FormDialog } from '@/components/form-dialog'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api-error'
import type { CaseDetail } from './api'
import type { Attachment } from './attachments-api'
import { useCaseAction } from './use-cases'
import { usePhotoUpload } from './use-photo-upload'

/**
 * «Marcar entregado» (ENT-4): la entrega se cierra con una foto de constancia, obligatoria
 * para todos los roles. Un botón grande abre la cámara trasera (`capture="environment"`); la
 * foto se comprime en el cliente y sube como adjunto `constancia` (`usePhotoUpload`), y solo
 * cuando terminó de subir se habilita «Marcar entregado» con su id. Un fallo de subida avisa
 * una vez (lo hace `usePhotoUpload`) y deja el botón como estaba: sin foto no hay entrega.
 */
export function DeliverDialog({
  case: c,
  open,
  onOpenChange,
}: {
  /** Solo el id: también la abre «Entregas» (ENT-5), que no carga la ficha completa. */
  case: Pick<CaseDetail, 'id'>
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const action = useCaseAction(c.id)
  const { handleFiles, progress } = usePhotoUpload(c.id, { kind: 'constancia' })
  const [proof, setProof] = useState<Attachment | null>(null)
  const uploading = progress !== null

  async function take(files: FileList | null) {
    const [uploaded] = await handleFiles(files)
    if (uploaded) setProof(uploaded)
  }

  function submit() {
    if (!proof) return
    action.mutate(
      { accion: 'marcar_entregado', motivo: null, constanciaId: proof.id },
      {
        onSuccess: () => onOpenChange(false),
        // UX4-05: un 409 dice que otra persona canceló o cerró el trabajo. `useCaseAction` ya
        // refrescó y avisó (una vez); el diálogo no sigue abierto sobre el estado nuevo.
        onError: (err) => {
          if (err instanceof ApiError && err.status === 409) onOpenChange(false)
        },
      },
    )
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Marcar entregado"
      description="Se registrará la entrega con la fecha de hoy y el trabajo pasará a la cuenta de la clínica. No hay ninguna acción para deshacerlo."
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Volver
          </Button>
          <Button type="button" disabled={!proof || uploading || action.isPending} onClick={submit}>
            {action.isPending ? 'Guardando…' : 'Marcar entregado'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {proof ? (
          <div className="flex items-center gap-4 rounded-xl border border-border bg-muted/40 p-3">
            <img
              src={proof.thumbUrl ?? proof.url}
              alt="Foto de constancia"
              className="size-24 shrink-0 rounded-lg object-cover"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <p className="text-sm font-medium">Constancia lista</p>
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                disabled={uploading}
                onClick={() => inputRef.current?.click()}
              >
                <RefreshCcw /> Cambiar foto
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="h-24 w-full flex-col gap-1 border-2 border-dashed text-base"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            <Camera className="size-6" />
            Tomar foto de constancia
          </Button>
        )}
        {uploading && (
          <p role="status" className="text-sm text-muted-foreground">
            Subiendo foto…
          </p>
        )}
        {/* Objetivo táctil real: el botón de arriba (mismo criterio que `PhotoUploader`). */}
        <input
          ref={inputRef}
          type="file"
          aria-label="Foto de constancia"
          aria-hidden="true"
          tabIndex={-1}
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(e) => {
            void take(e.target.files)
            e.target.value = ''
          }}
        />
      </div>
    </FormDialog>
  )
}
