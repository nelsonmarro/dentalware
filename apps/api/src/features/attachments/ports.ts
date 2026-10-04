import type { AttachmentKind, DeliveryType } from '@dentalware/shared'
// Solo tipos: la forma de fila se deriva del schema (mismo ruling que en `cases/ports.ts`).
import type { Readable } from 'node:stream'
import type { attachments } from './schema.ts'

export type AttachmentRecord = typeof attachments.$inferSelect & {
  uploader: { id: string; name: string } | null
}
export type NewAttachment = Omit<typeof attachments.$inferInsert, 'createdAt'> & { id: string }

export interface AttachmentsRepository {
  insert(row: NewAttachment): Promise<AttachmentRecord>
  byId(id: string): Promise<AttachmentRecord | undefined>
  byCase(caseId: string): Promise<AttachmentRecord[]>
  remove(id: string): Promise<void>
}

export interface ImageProcessor {
  /** Normaliza (rota, redimensiona, recodifica). Lanza si `input` no es una imagen válida. */
  normalize(input: Uint8Array): Promise<{ data: Uint8Array; width: number; height: number }>
  thumbnail(input: Uint8Array): Promise<Uint8Array>
}

/** Puerto de OTRA feature (trabajos): se inyecta en la raíz de composición. */
export interface CasesQuery {
  exists(caseId: string): Promise<boolean>
}

/** Puerto de OTRA feature (trabajos): registra el evento en la misma transacción/flujo. */
export interface CaseEventLog {
  add(e: {
    caseId: string
    type: 'attachment_added' | 'attachment_removed'
    fromValue?: string | null
    toValue?: string | null
    actorId: string
  }): Promise<void>
}

/** Puerto de OTRA feature (entregas, ADR 34): la entrega pendiente de un tipo para un trabajo,
 * con su mensajero, para decidir con `canActOnDelivery` quién sube la constancia (UX4-01). */
export interface PendingDeliveryLookup {
  pendingFor(caseId: string, type: DeliveryType): Promise<{ courierId: string } | undefined>
}

/** Puerto de OTRA feature (entregas, ADR 34), de solo lectura: los ids de las constancias de un
 * trabajo que referencia una entrega hecha (`proof_attachment_id`). Esas son «de la entrega» y
 * no se borran; el resto son constancias sin usar (UX4-06). */
export interface DeliveryProofLookup {
  linkedProofIds(caseId: string): Promise<string[]>
}

/** Un adjunto con lo que la web necesita saber de su papel en las entregas (UX4-06). */
export type AttachmentView = AttachmentRecord & { linkedToDelivery: boolean }

export type UploadInput = {
  caseId: string
  filename: string
  mime: string
  size: number
  bytes: Uint8Array
  kind: AttachmentKind | null
}

export type OpenedFile = { stream: Readable; mime: string; filename: string }
