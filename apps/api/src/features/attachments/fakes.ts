import type { DeliveryType } from '@dentalware/shared'
import { Readable } from 'node:stream'
import type { IdGenerator } from '../../lib/ids.ts'
import { assertStorageKey, type Storage } from '../../lib/storage.ts'
import { AttachmentInUseError } from './errors.ts'
import type {
  AttachmentRecord,
  AttachmentsRepository,
  CaseEventLog,
  CasesQuery,
  DeliveryProofLookup,
  ImageProcessor,
  NewAttachment,
  PendingDeliveryLookup,
} from './ports.ts'

/** Almacenamiento en memoria: suficiente para probar el flujo sin disco. Cumple el mismo
 * contrato que los drivers reales (`fakes.test.ts`, #103), claves inválidas incluidas. */
export function memoryStorage(): Storage {
  const files = new Map<string, Uint8Array>()
  return {
    async put(key, data) {
      assertStorageKey(key)
      files.set(key, Uint8Array.from(data))
    },
    async open(key) {
      assertStorageKey(key)
      const data = files.get(key)
      if (!data) throw new Error(`No existe en el storage: ${key}`)
      return Readable.from(Buffer.from(data))
    },
    async remove(key) {
      assertStorageKey(key)
      files.delete(key)
    },
    async exists(key) {
      assertStorageKey(key)
      return files.has(key)
    },
  }
}

/**
 * Procesador de imágenes falso: `normalize` lanza cuando el primer byte es `0x00`, para
 * simular una imagen corrupta sin depender de `sharp`; `thumbnail` devuelve un recorte
 * corto de la entrada (suficiente para comprobar que se guarda algo).
 */
export const fakeImages: ImageProcessor = {
  async normalize(input) {
    if (input[0] === 0x00) throw new Error('no es imagen')
    return { data: input, width: 100, height: 80 }
  },
  async thumbnail(input) {
    return input.subarray(0, 8)
  },
}

export const fixedIds = (ids: string[]): IdGenerator => {
  let i = 0
  return {
    next: () => {
      const id = ids[i]
      i += 1
      return id ?? `id-extra-${i}`
    },
  }
}

/** Repositorio en memoria: suficiente para probar orquestación y errores. `referencedIds` imita
 * la FK `deliveries.proof_attachment_id` (RESTRICT): esos adjuntos no se borran, como en el repo
 * real, que traduce la violación a `AttachmentInUseError`. */
export function fakeAttachmentsRepo(
  seed: AttachmentRecord[] = [],
  { referencedIds = [] }: { referencedIds?: string[] } = {},
): AttachmentsRepository {
  const rows = new Map(seed.map((r) => [r.id, r]))
  return {
    async insert(row: NewAttachment) {
      const record: AttachmentRecord = {
        id: row.id,
        caseId: row.caseId,
        kind: row.kind,
        filename: row.filename,
        mime: row.mime,
        size: row.size,
        width: row.width ?? null,
        height: row.height ?? null,
        storagePath: row.storagePath,
        thumbPath: row.thumbPath ?? null,
        uploadedBy: row.uploadedBy,
        createdAt: new Date(),
        uploader: { id: row.uploadedBy, name: 'Actor' },
      }
      rows.set(record.id, record)
      return record
    },
    async byId(id) {
      return rows.get(id)
    },
    async byCase(caseId) {
      return [...rows.values()].filter((r) => r.caseId === caseId)
    },
    async remove(id) {
      if (referencedIds.includes(id)) throw new AttachmentInUseError()
      rows.delete(id)
    },
  }
}

export const casesQueryWith = (existingIds: string[]): CasesQuery => ({
  exists: async (caseId) => existingIds.includes(caseId),
})

export function recordingEvents() {
  const events: Parameters<CaseEventLog['add']>[0][] = []
  const log: CaseEventLog = {
    async add(e) {
      events.push(e)
    },
  }
  return { log, events }
}

/** Entregas en memoria: las pendientes (como mucho una por trabajo y tipo, igual que la BD) y
 * las constancias que referencian una entrega hecha. */
export const pendingDeliveriesWith = (
  rows: { caseId: string; type: DeliveryType; courierId: string }[],
  proofs: { caseId: string; attachmentId: string }[] = [],
): PendingDeliveryLookup & DeliveryProofLookup => ({
  pendingFor: async (caseId, type) => rows.find((r) => r.caseId === caseId && r.type === type),
  linkedProofIds: async (caseId) =>
    proofs.filter((p) => p.caseId === caseId).map((p) => p.attachmentId),
})
