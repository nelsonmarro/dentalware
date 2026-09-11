// Política pura de subidas (sin `sharp`, sin I/O): el hexágono la consume directo,
// sin cargar el binario nativo de `lib/images.ts` (ADR 17, docs/architecture.md §3.5 I-1).
export const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024

export const isImage = (mime: string) => mime.startsWith('image/')
