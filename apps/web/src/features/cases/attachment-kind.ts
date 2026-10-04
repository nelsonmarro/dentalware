import type { Attachment } from './attachments-api'

/** Una sola regla de «foto» para toda la web (I-1 de la revisión de la Tarea 5): la que usa la
 * API para derivar `kind` al subir (`isImage` en `apps/api/src/lib/upload-policy.ts`, el MIME
 * real). No se usa `kind` porque el cliente lo puede forzar (un escaneo es imagen; un PDF
 * podría llegar como `photo`). La consumen la ficha corta («Fotos: N»), la grilla de
 * `PhotosTab` y el aviso de `usePhotoUpload`. */
export function isPhoto(a: Pick<Attachment, 'mime'>): boolean {
  return a.mime.startsWith('image/')
}

/** Rótulo de la pestaña de adjuntos de la ficha: cuenta exactamente lo que la pestaña muestra,
 * fotos **y** documentos (con la orden en PDF, «Fotos (1)» contaba un documento). */
export function attachmentsTabLabel(count: number): string {
  return `Adjuntos (${count})`
}
