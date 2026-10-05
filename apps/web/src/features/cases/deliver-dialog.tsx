import { hidesPrices, type UserRole } from '@dentalware/shared'
import { Camera, RefreshCcw } from 'lucide-react'
import { useRef } from 'react'
import { FormDialog } from '@/components/form-dialog'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api-error'
import { useLocalFile } from '@/lib/use-local-file'
import type { CaseDetail } from './api'
import type { Attachment } from './attachments-api'
import { useCaseAction } from './use-cases'
import { QueuedNotice } from './queued-notice'
import { useCaseBusy } from './use-case-busy'
import { isProofRejected, useUploadProof } from './use-upload-proof'

/**
 * «Marcar entregado» (ENT-4): la entrega se cierra con una foto de constancia, obligatoria
 * para todos los roles. Un botón grande abre la cámara trasera (`capture="environment"`).
 *
 * La foto se sube **solo al confirmar** (UX4-06): elegirla muestra su miniatura local, y
 * «Marcar entregado» la sube como adjunto `constancia` y después cierra la entrega con su id.
 * Así «Volver», Escape o «Cambiar foto» no dejan constancias huérfanas, y la entrega avisa una
 * sola vez (UX4-15). Si la acción falla después de subir (sin red), reintentar reutiliza la
 * constancia ya subida de esa misma foto, salvo que la API la rechace (422 en `constanciaId`):
 * entonces el reintento la vuelve a subir.
 *
 * Un 409 de la acción, o un 403/409 de la subida (la entrega ya no es suya o el trabajo cambió),
 * avisa una vez y cierra el diálogo (UX4-05); cualquier otro fallo avisa y deja reintentar.
 */
/** 422 de la acción en `constanciaId`: la constancia subida ya no vale. */
function isProofInvalid(err: unknown): boolean {
  return (
    err instanceof ApiError &&
    err.status === 422 &&
    err.issues.some((issue) => issue.path === 'constanciaId')
  )
}

export function DeliverDialog({
  case: c,
  role,
  open,
  onOpenChange,
}: {
  /** Lo que el diálogo nombra (UX4-12): también la abre «Entregas» (ENT-5), que no carga la
   * ficha completa. */
  case: Pick<CaseDetail, 'id' | 'code'> & { clinic: Pick<CaseDetail['clinic'], 'name'> }
  /** A quien no ve dinero (el mensajero) no se le habla de la cuenta de la clínica (UX4-12). */
  role: UserRole
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const action = useCaseAction(c.id)
  const upload = useUploadProof(c.id)
  const { file: photo, url: preview, choose } = useLocalFile()
  // La constancia ya subida de la foto elegida: un reintento tras un fallo de la acción no
  // vuelve a subirla.
  const uploaded = useRef<{ photo: File; proof: Attachment } | null>(null)
  // M-4: también cuenta lo de este trabajo que lanzó otro diálogo ya cerrado y espera la señal.
  const { busy, queued } = useCaseBusy(c.id)

  async function submit() {
    if (!photo || busy) return
    let proof = uploaded.current?.photo === photo ? uploaded.current.proof : null
    if (!proof) {
      try {
        proof = await upload.mutateAsync(photo)
      } catch (err) {
        if (isProofRejected(err)) onOpenChange(false)
        return
      }
      uploaded.current = { photo, proof }
    }
    action.mutate(
      { accion: 'marcar_entregado', motivo: null, constanciaId: proof.id },
      {
        onSuccess: () => onOpenChange(false),
        // UX4-05: un 409 dice que otra persona canceló o cerró el trabajo. `useCaseAction` ya
        // refrescó y avisó (una vez); el diálogo no sigue abierto sobre el estado nuevo.
        onError: (err) => {
          if (err instanceof ApiError && err.status === 409) onOpenChange(false)
          // M-3: la API ya no acepta esa constancia (p. ej. recepción borró la «sin usar» tras un
          // fallo anterior): el siguiente toque vuelve a subir la foto.
          if (isProofInvalid(err)) uploaded.current = null
        },
      },
    )
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Marcar entregado"
      context={{ code: c.code, label: c.clinic.name }}
      description={
        hidesPrices(role)
          ? 'Se registrará la entrega con la fecha de hoy. No hay ninguna acción para deshacerlo.'
          : 'Se registrará la entrega con la fecha de hoy y el trabajo pasará a la cuenta de la clínica. No hay ninguna acción para deshacerlo.'
      }
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Volver
          </Button>
          <Button type="button" disabled={!photo || busy} onClick={() => void submit()}>
            {busy ? 'Guardando…' : 'Marcar entregado'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {photo ? (
          <div className="flex items-center gap-4 rounded-xl border border-border bg-muted/40 p-3">
            {preview && (
              <img
                src={preview}
                alt="Foto de constancia"
                className="size-24 shrink-0 rounded-lg object-cover"
              />
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div>
                <p className="text-sm font-medium">Foto lista</p>
                <p className="text-sm text-muted-foreground">Se sube al marcar entregado.</p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                disabled={busy}
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
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            <Camera className="size-6" />
            Tomar foto de constancia
          </Button>
        )}
        {queued ? (
          <QueuedNotice />
        ) : (
          upload.isPending && (
            <p role="status" className="text-sm text-muted-foreground">
              Subiendo foto…
            </p>
          )
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
            const [chosen] = e.target.files ?? []
            if (chosen) choose(chosen)
            e.target.value = ''
          }}
        />
      </div>
    </FormDialog>
  )
}
