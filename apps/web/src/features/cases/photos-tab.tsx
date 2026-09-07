import type { UserRole } from '@dentalware/shared'
import { FileText, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { EmptyState } from '@/components/empty-state'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { Attachment } from './attachments-api'
import { PhotoUploader } from './photo-uploader'
import { useAttachments, useDeleteAttachment } from './use-attachments'

function isPdf(a: Attachment) {
  return a.mime === 'application/pdf'
}

/** Grilla de miniaturas (clic abre el original en un diálogo) y lista de documentos
 * PDF; "Eliminar" con confirmación solo para admin|recepción. */
export function PhotosTab({ caseId, role }: { caseId: string; role: UserRole }) {
  const attachments = useAttachments(caseId)
  const del = useDeleteAttachment(caseId)
  const canDelete = role === 'admin' || role === 'recepcion'
  const [preview, setPreview] = useState<Attachment | null>(null)
  const [toDelete, setToDelete] = useState<Attachment | null>(null)

  const rows = attachments.data ?? []
  const photos = rows.filter((a) => !isPdf(a))
  const documents = rows.filter(isPdf)

  return (
    <div className="flex flex-col gap-4">
      <PhotoUploader caseId={caseId} />

      {attachments.isSuccess && rows.length === 0 && (
        <EmptyState title="Sin fotos ni documentos todavía" />
      )}

      {photos.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {photos.map((a) => (
            <div
              key={a.id}
              className="relative aspect-square overflow-hidden rounded-lg border border-border"
            >
              <button
                type="button"
                className="absolute inset-0 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                onClick={() => setPreview(a)}
              >
                <img
                  src={a.thumbUrl ?? a.url}
                  alt={a.filename}
                  loading="lazy"
                  className="size-full object-cover"
                />
                <span className="sr-only">Ver {a.filename}</span>
              </button>
              {canDelete && (
                <Button
                  type="button"
                  variant="secondary"
                  size="icon-lg"
                  aria-label={`Eliminar ${a.filename}`}
                  className="absolute top-1 right-1 size-11"
                  onClick={() => setToDelete(a)}
                >
                  <Trash2 />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {documents.length > 0 && (
        <ul className="flex flex-col gap-2">
          {documents.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-border p-3"
            >
              <a
                href={a.url}
                target="_blank"
                rel="noreferrer"
                className="flex min-w-0 items-center gap-2 text-sm hover:underline"
              >
                <FileText className="size-4 shrink-0" aria-hidden />
                <span className="truncate">{a.filename}</span>
              </a>
              {canDelete && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-lg"
                  aria-label={`Eliminar ${a.filename}`}
                  className="size-11 shrink-0"
                  onClick={() => setToDelete(a)}
                >
                  <Trash2 />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <Dialog open={preview !== null} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="sm:max-w-lg">
          {preview && (
            <>
              <DialogHeader>
                <DialogTitle>{preview.filename}</DialogTitle>
              </DialogHeader>
              <img
                src={preview.url}
                alt={preview.filename}
                className="max-h-[70vh] w-full rounded-lg object-contain"
              />
              <DialogFooter>
                <Button asChild variant="outline" className="h-11">
                  <a href={preview.url} target="_blank" rel="noreferrer">
                    Abrir original
                  </a>
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Eliminar adjunto"
        description={`¿Eliminar "${toDelete?.filename}"? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        destructive
        pending={del.isPending}
        onConfirm={() => {
          if (toDelete) del.mutate(toDelete.id, { onSuccess: () => setToDelete(null) })
        }}
      />
    </div>
  )
}
